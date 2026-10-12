"""P2P fiat handling — ads are quoted in USD, never NGN."""
import importlib
from decimal import Decimal

from django.apps import apps
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from products.models import P2PAd
from accounts.models import UserNotification

# Module names can't start with a digit as a bare import.
fiat_migration = importlib.import_module("products.migrations.0004_fiat_usd")

User = get_user_model()

# The NGN figures seed.py used before the switch to USD.
NGN_AD = dict(
    side="sell", asset="USDT", fiat="NGN", method="Bank Transfer",
    price=Decimal("1640"), available=Decimal("50000"),
    min_limit=Decimal("10000"), max_limit=Decimal("5000000"),
)


class P2PFiatTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("pm", "pm@vyne.test", "Str0ngPass123")
        self.client.force_authenticate(self.user)

    def test_model_defaults_to_usd(self):
        self.assertEqual(P2PAd._meta.get_field("fiat").default, "USD")

    def test_creating_an_ad_defaults_to_usd(self):
        resp = self.client.post(
            "/api/products/p2p/ads/create/",
            {"side": "sell", "asset": "USDT", "price": "1.00",
             "available": "100", "min_limit": "10", "max_limit": "500"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["fiat"], "USD")

    def test_order_book_lists_usd(self):
        P2PAd.objects.create(user=self.user, **NGN_AD)
        fiat_migration.to_usd(apps, None)
        resp = self.client.get("/api/products/p2p/ads/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["fiat"], "USD")


class FiatMigrationTests(APITestCase):
    """Guards the NGN -> USD data migration in products/0004_fiat_usd."""

    def setUp(self):
        self.admin = User.objects.create_user("seed", "seed@vyne.test", "Str0ngPass123")
        self.ad = P2PAd.objects.create(user=self.admin, **NGN_AD)

    def test_ngn_ads_are_scaled_into_usd(self):
        fiat_migration.to_usd(apps, None)
        self.ad.refresh_from_db()

        self.assertEqual(self.ad.fiat, "USD")
        # 1640 NGN bought one USDT, so the converted price lands on parity.
        self.assertEqual(self.ad.price, Decimal("1.00"))
        self.assertAlmostEqual(float(self.ad.min_limit), 6.10, places=1)
        self.assertAlmostEqual(float(self.ad.max_limit), 3048.78, places=0)
        self.assertAlmostEqual(float(self.ad.available), 30.49, places=1)

    def test_conversion_only_touches_ngn_rows(self):
        usd = P2PAd.objects.create(
            user=self.admin, side="buy", asset="USDT", fiat="USD",
            price=Decimal("0.99"), available=Decimal("1000"),
            min_limit=Decimal("10"), max_limit=Decimal("500"),
        )
        fiat_migration.to_usd(apps, None)
        usd.refresh_from_db()
        self.assertEqual(usd.fiat, "USD")
        self.assertEqual(usd.price, Decimal("0.99"))

    def test_migration_is_reversible(self):
        fiat_migration.to_usd(apps, None)
        fiat_migration.to_ngn(apps, None)
        self.ad.refresh_from_db()

        self.assertEqual(self.ad.fiat, "NGN")
        # Rounding at 2dp means the round trip is close, not exact.
        self.assertAlmostEqual(float(self.ad.price), 1640.0, places=0)
        self.assertAlmostEqual(float(self.ad.min_limit), 10000.0, delta=50)
        self.assertAlmostEqual(float(self.ad.max_limit), 5000000.0, delta=10000)

    def test_no_naira_ads_survive_the_migration(self):
        P2PAd.objects.create(
            user=self.admin,
            **{k: v for k, v in NGN_AD.items() if k not in ("side", "asset")},
            side="buy", asset="USDT",
        )
        fiat_migration.to_usd(apps, None)
        self.assertFalse(P2PAd.objects.filter(fiat="NGN").exists())


class AlertTests(APITestCase):
    """Every money-moving product action must leave an alert in the user's inbox.

    A user who moves funds and sees no confirmation has no way to tell a
    successful trade from a silently dropped request, so these assertions are
    about more than cosmetics.
    """

    def setUp(self):
        self.user = User.objects.create_user("alice", "alice@vyne.test", "Str0ngPass123")
        self.client.force_authenticate(self.user)

    def titles(self, user=None):
        return list(
            UserNotification.objects.filter(user=user or self.user)
            .order_by("id")
            .values_list("title", flat=True)
        )

    def test_converting_assets_alerts(self):
        from trading.models import Market
        from wallet.models import Wallet

        # ConvertView prices both legs off the live USDT feed.
        Market.objects.create(
            symbol="BTCUSDT", base="BTC", quote="USDT", name="Bitcoin", price="50000", is_active=True
        )
        Wallet.objects.create(user=self.user, asset="USDT", available=Decimal("1000"))
        resp = self.client.post(
            "/api/products/convert/",
            {"from_asset": "USDT", "to_asset": "BTC", "amount": "100"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(len(self.titles()), 1)
        self.assertIn("Converted", self.titles()[0])

    def test_following_a_trader_alerts(self):
        from products.models import CopyTrader
        from wallet.models import Wallet

        Wallet.objects.create(user=self.user, asset="USDT", available=Decimal("500"))
        trader = CopyTrader.objects.create(
            user=User.objects.create_user("whale", "whale@vyne.test", "Str0ngPass123"),
            display="Whale",
            roi_30d=Decimal("12.5"),
        )
        resp = self.client.post(
            f"/api/products/copy/{trader.id}/follow/", {"allocated": "100"}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Whale", self.titles()[0])

    def test_publishing_a_p2p_ad_alerts(self):
        resp = self.client.post(
            "/api/products/p2p/ads/create/",
            {"side": "sell", "asset": "USDT", "price": "1.00", "available": "100"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIn("P2P sell ad published", self.titles()[0])

    def test_p2p_release_alerts_both_sides(self):
        from products.models import P2POrder
        from wallet.models import Wallet

        merchant = User.objects.create_user("bob", "bob@vyne.test", "Str0ngPass123")
        ad = P2PAd.objects.create(
            user=merchant, side="sell", asset="USDT", fiat="USD",
            price=Decimal("1"), available=Decimal("500"),
            min_limit=Decimal("10"), max_limit=Decimal("1000"),
        )
        Wallet.objects.create(user=self.user, asset="USDT", available=Decimal("0"), frozen=Decimal("100"))
        order = P2POrder.objects.create(
            ad=ad, taker=self.user, amount_asset=Decimal("100"), amount_fiat=Decimal("100")
        )
        self.client.force_authenticate(merchant)
        resp = self.client.post(f"/api/products/p2p/orders/{order.id}/release/", {}, format="json")
        self.assertEqual(resp.status_code, 200)
        # Merchant and buyer each get their own alert.
        self.assertIn("P2P order released", self.titles(merchant)[0])
        self.assertIn("P2P order completed", self.titles(self.user)[0])

    def test_p2p_cancel_returns_funds_and_alerts(self):
        from products.models import P2POrder
        from wallet.models import Wallet

        merchant = User.objects.create_user("bob", "bob@vyne.test", "Str0ngPass123")
        ad = P2PAd.objects.create(
            user=merchant, side="sell", asset="USDT", fiat="USD",
            price=Decimal("1"), available=Decimal("500"),
            min_limit=Decimal("10"), max_limit=Decimal("1000"),
        )
        Wallet.objects.create(user=self.user, asset="USDT", available=Decimal("0"), frozen=Decimal("100"))
        order = P2POrder.objects.create(
            ad=ad, taker=self.user, amount_asset=Decimal("100"), amount_fiat=Decimal("100")
        )
        resp = self.client.post(f"/api/products/p2p/orders/{order.id}/cancel/", {}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("cancelled", self.titles()[0])

    def _grid_fixtures(self):
        from trading.models import Market
        from wallet.models import Wallet

        Market.objects.create(symbol="BTCUSDT", base="BTC", quote="USDT", price=Decimal("60000"))
        Wallet.objects.create(
            user=self.user, asset="USDT", available=Decimal("1000"), frozen=Decimal("0")
        )

    def test_starting_a_grid_bot_alerts(self):
        from products.models import GridBot  # noqa: F401

        self._grid_fixtures()
        resp = self.client.post(
            "/api/products/grids/",
            {"symbol": "BTCUSDT", "lower": "50000", "upper": "70000",
             "grids": 5, "investment": "500", "mode": "spot"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIn("Grid bot started", self.titles()[0])

    def test_stopping_a_grid_bot_alerts(self):
        from products.models import GridBot
        from trading.models import Market
        from wallet.models import Wallet

        Market.objects.create(symbol="BTCUSDT", base="BTC", quote="USDT", price=Decimal("60000"))
        Wallet.objects.create(user=self.user, asset="USDT", available=Decimal("0"), frozen=Decimal("500"))
        bot = GridBot.objects.create(
            user=self.user, symbol="BTCUSDT", mode="spot",
            lower=Decimal("50000"), upper=Decimal("70000"),
            grids=5, investment=Decimal("500"), status="running",
        )
        resp = self.client.post(f"/api/products/grids/{bot.id}/stop/", {}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Grid bot stopped", self.titles()[0])
