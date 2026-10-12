"""P2P fiat handling — ads are quoted in USD, never NGN."""
import importlib
from decimal import Decimal

from django.apps import apps
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from products.models import P2PAd

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
