"""Admin console: balance editing and throttle behaviour."""
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from wallet.models import Wallet, ensure_wallet

User = get_user_model()

PERIODS = {"second": 3600, "minute": 60, "hour": 1, "day": 1440}


def per_hour(rate):
    count, _, period = rate.partition("/")
    return int(count) * PERIODS[period]


def available(user, asset):
    ensure_wallet(user, asset)
    return Wallet.objects.get(user=user, asset=asset).available


class AdminBalanceTests(APITestCase):
    def setUp(self):
        self.target = User.objects.create_user("trader", "trader@vyne.test", "Str0ngPass123")
        self.staff = User.objects.create_user("ops", "ops@vyne.test", "Str0ngPass123", is_staff=True)
        self.client.force_authenticate(self.staff)

    def set_balance(self, **body):
        return self.client.post(
            f"/api/admin/users/{self.target.id}/",
            {"action": "set_balance", **body},
            format="json",
        )

    def test_set_balance_updates_the_wallet(self):
        resp = self.set_balance(asset="USDT", available="1234.50")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(available(self.target, "USDT"), Decimal("1234.50"))
        self.assertEqual(Decimal(resp.data["balances"]["USDT"]), Decimal("1234.50"))

    def test_set_balance_needs_an_explicit_asset_default(self):
        # The console always posts an asset, but the API default must still
        # resolve to a real wallet rather than 404/500.
        resp = self.client.post(
            f"/api/admin/users/{self.target.id}/",
            {"action": "set_balance", "available": "5"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(available(self.target, "USDT"), Decimal("5"))

    def test_blank_amount_is_rejected_without_crashing(self):
        # Decimal("") raises InvalidOperation; the view must turn that into a
        # 400 rather than an unhandled 500.
        resp = self.set_balance(asset="USDT", available="")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(available(self.target, "USDT"), Decimal("0"))

    def test_unknown_asset_and_negatives_are_rejected(self):
        # Not in BASE_ASSETS and not a market base, so listed_assets() rejects it.
        self.assertEqual(self.set_balance(asset="NOTACOIN", available="10").status_code, 400)
        self.assertEqual(self.set_balance(asset="USDT", available="-1").status_code, 400)
        self.assertEqual(available(self.target, "USDT"), Decimal("0"))

    def test_any_tradable_market_base_is_settable(self):
        # listed_assets() is BASE_ASSETS plus every active USDT market base, so
        # the console must be able to credit any coin the exchange trades --
        # not just the hardcoded shortlist it used to offer.
        from trading.models import Market

        Market.objects.create(
            symbol="DOGEUSDT", base="DOGE", quote="USDT", name="Dogecoin", price="0.10", is_active=True
        )
        self.assertEqual(self.set_balance(asset="DOGE", available="42").status_code, 200)
        self.assertEqual(available(self.target, "DOGE"), Decimal("42"))

    def test_delisted_market_does_not_open_a_balance_hole(self):
        from trading.models import Market

        Market.objects.create(
            symbol="GHOSTUSDT", base="GHOST", quote="USDT", name="Ghost", price="1", is_active=False
        )
        self.assertEqual(self.set_balance(asset="GHOST", available="1").status_code, 400)

    def test_non_staff_cannot_edit_balances(self):
        self.client.force_authenticate(self.target)
        self.assertEqual(self.set_balance(asset="USDT", available="999").status_code, 403)
        self.assertEqual(available(self.target, "USDT"), Decimal("0"))


class AdminThrottleTests(APITestCase):
    """The console polls six endpoints every 8s (~2,700 requests/hour per
    admin). Admin views therefore resolve their own `admin` scope instead of
    the shared `user` bucket, which would 429 the whole console after ~90
    seconds.

    If the `admin` scope is missing from DEFAULT_THROTTLE_RATES,
    ScopedRateThrottle raises ImproperlyConfigured and *every* admin endpoint
    returns 500 -- so the smoke test below is the real regression guard.
    """

    ENDPOINTS = [
        "/api/admin/stats/",
        "/api/admin/users/",
        "/api/admin/notifications/",
        "/api/admin/deposits/",
        "/api/admin/withdrawals/",
        "/api/admin/deposit-addresses/",
    ]

    def setUp(self):
        self.staff = User.objects.create_user("ops", "ops@vyne.test", "Str0ngPass123", is_staff=True)
        self.client.force_authenticate(self.staff)

    def test_admin_scope_has_headroom_for_the_poller(self):
        rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        self.assertIn("admin", rates)
        self.assertGreater(per_hour(rates["admin"]), 2700)

    def test_admin_views_declare_their_own_scope(self):
        from adminpanel import views

        names = [
            "UsersView", "UserActionView", "DepositAddressesAdminView", "DepositsAdminView",
            "CreditDepositView", "WithdrawalsAdminView", "ProcessWithdrawView",
            "NotificationsView", "StatsView",
        ]
        for name in names:
            view = getattr(views, name)
            self.assertEqual(view.throttle_scope, "admin", name)
            self.assertEqual([c.__name__ for c in view.throttle_classes], ["ScopedRateThrottle"], name)

    def test_polling_the_console_never_gets_throttled(self):
        for cycle in range(2):
            for url in self.ENDPOINTS:
                resp = self.client.get(url)
                self.assertNotEqual(resp.status_code, 429, f"{url} (cycle {cycle})")
                self.assertEqual(resp.status_code, 200, url)

    def test_non_staff_gets_403_on_admin_endpoints(self):
        self.client.force_authenticate(User.objects.create_user("u", "u@vyne.test", "Str0ngPass123"))
        for url in self.ENDPOINTS:
            self.assertEqual(self.client.get(url).status_code, 403, url)

