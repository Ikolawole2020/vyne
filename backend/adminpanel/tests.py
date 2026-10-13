"""Admin console: balance editing and throttle behaviour."""
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from wallet.models import Wallet, PlatformDepositAddress, ensure_wallet, ensure_wallets
from wallet.models import DepositRequest, WithdrawalRequest, AdminNotification
from accounts.models import UserNotification

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


class AdminWalletDeleteTests(APITestCase):
    """Deleting a user's wallet from the admin console.

    `ensure_wallets` runs on every wallet-list load and every console poll, so
    the interesting cases here are all about the delete *sticking* and about
    funded wallets refusing to disappear.
    """

    def setUp(self):
        self.target = User.objects.create_user("trader", "trader@vyne.test", "Str0ngPass123")
        self.staff = User.objects.create_user("ops", "ops@vyne.test", "Str0ngPass123", is_staff=True)
        self.client.force_authenticate(self.staff)

    def act(self, action, **extra):
        return self.client.post(
            f"/api/admin/users/{self.target.id}/",
            {"action": action, **extra},
            format="json",
        )

    def test_deleting_a_zero_balance_wallet_works(self):
        resp = self.act("delete_wallet", asset="BTC")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(Wallet.objects.get(user=self.target, asset="BTC").archived)
        # The response no longer lists the deleted wallet as a live balance.
        self.assertNotIn("BTC", resp.data["balances"])

    def test_delete_survives_the_wallet_ensure_poll(self):
        # This is the regression guard: ensure_wallets used to recreate every
        # missing row, so the delete was undone within one console refresh.
        self.act("delete_wallet", asset="BTC")
        ensure_wallets(self.target)
        self.assertTrue(Wallet.objects.get(user=self.target, asset="BTC").archived)

    def test_deleted_wallet_is_hidden_from_the_users_list(self):
        self.act("delete_wallet", asset="BTC")
        rows = {u["id"]: u for u in self.client.get("/api/admin/users/").data}
        self.assertNotIn("BTC", rows[self.target.id]["balances"])
        self.assertIn("BTC", rows[self.target.id]["deleted_wallets"])

    def test_funded_wallet_refuses_to_be_deleted(self):
        available(self.target, "USDT")  # ensure the row exists
        Wallet.objects.filter(user=self.target, asset="USDT").update(available=Decimal("500"))
        resp = self.act("delete_wallet", asset="USDT")
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Wallet.objects.get(user=self.target, asset="USDT").archived)

    def test_wallet_with_reserved_funds_refuses_to_be_deleted(self):
        available(self.target, "USDT")
        Wallet.objects.filter(user=self.target, asset="USDT").update(frozen=Decimal("10"))
        resp = self.act("delete_wallet", asset="USDT")
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Wallet.objects.get(user=self.target, asset="USDT").archived)

    def test_restore_brings_a_deleted_wallet_back(self):
        self.act("delete_wallet", asset="BTC")
        resp = self.act("restore_wallet", asset="BTC")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(Wallet.objects.get(user=self.target, asset="BTC").archived)
        self.assertIn("BTC", resp.data["balances"])

    def test_restore_of_a_live_wallet_is_rejected(self):
        available(self.target, "BTC")
        resp = self.act("restore_wallet", asset="BTC")
        self.assertEqual(resp.status_code, 400)

    def test_unknown_asset_is_rejected(self):
        self.assertEqual(self.act("delete_wallet", asset="NOTACOIN").status_code, 400)

    def test_non_staff_cannot_delete_wallets(self):
        available(self.target, "BTC")
        self.client.force_authenticate(self.target)
        resp = self.act("delete_wallet", asset="BTC")
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(Wallet.objects.get(user=self.target, asset="BTC").archived)


    def test_frozen_balance_is_reported_to_the_console(self):
        # The wallets tab shows a Frozen column so an admin can see why a wallet
        # is refusing to delete: frozen funds are reserved, not free to move.
        available(self.target, "USDT")
        Wallet.objects.filter(user=self.target, asset="USDT").update(frozen=Decimal("25"))
        rows = {u["id"]: u for u in self.client.get("/api/admin/users/").data}
        self.assertEqual(Decimal(rows[self.target.id]["frozen_balances"]["USDT"]), Decimal("25"))


class AdminDepositAddressDeleteTests(APITestCase):
    """Deleting a platform deposit address from the admin console.

    The list endpoint only ever exposed GET and POST, so an address could be
    added and overwritten but never removed -- which is how stale addresses
    accumulate.
    """

    def setUp(self):
        self.staff = User.objects.create_user("ops", "ops@vyne.test", "Str0ngPass123", is_staff=True)
        self.client.force_authenticate(self.staff)
        self.addr = PlatformDepositAddress.objects.create(
            asset="USDT", network="TRC20", address="TStale123", memo=""
        )

    def test_admin_can_delete_a_deposit_address(self):
        resp = self.client.delete(f"/api/admin/deposit-addresses/{self.addr.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(PlatformDepositAddress.objects.filter(pk=self.addr.pk).exists())

    def test_deleting_a_missing_address_404s(self):
        resp = self.client.delete(f"/api/admin/deposit-addresses/{self.addr.id + 999}/")
        self.assertEqual(resp.status_code, 404)

    def test_deleted_address_leaves_the_others_alone(self):
        other = PlatformDepositAddress.objects.create(asset="BTC", network="BTC", address="bc1keep")
        self.client.delete(f"/api/admin/deposit-addresses/{self.addr.id}/")
        self.assertTrue(PlatformDepositAddress.objects.filter(pk=other.pk).exists())

    def test_non_staff_cannot_delete_deposit_addresses(self):
        victim = User.objects.create_user("nope", "nope@vyne.test", "Str0ngPass123")
        self.client.force_authenticate(victim)
        resp = self.client.delete(f"/api/admin/deposit-addresses/{self.addr.id}/")
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(PlatformDepositAddress.objects.filter(pk=self.addr.pk).exists())


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



class AdminActionAlertsTests(APITestCase):
    """Every admin decision on a user's money or status must land in their
    Alerts inbox. These are the actions a user can see the *effect* of but
    cannot explain themselves, so silence reads as "the site took my money".
    """

    def setUp(self):
        self.target = User.objects.create_user("trader", "trader@vyne.test", "Str0ngPass123")
        self.staff = User.objects.create_user("ops", "ops@vyne.test", "Str0ngPass123", is_staff=True)
        self.client.force_authenticate(self.staff)

    def act(self, action, **extra):
        return self.client.post(
            f"/api/admin/users/{self.target.id}/", {"action": action, **extra}, format="json"
        )

    def titles(self):
        return list(UserNotification.objects.filter(user=self.target).values_list("title", flat=True))

    def test_freeze_and_unfreeze_alert_the_user(self):
        self.assertEqual(self.act("freeze", reason="Suspicious activity").status_code, 200)
        self.assertIn("Account restricted", self.titles())
        self.assertEqual(self.act("unfreeze").status_code, 200)
        self.assertIn("Account restored", self.titles())

    def test_balance_edit_alerts_the_user(self):
        self.assertEqual(self.act("set_balance", asset="USDT", available="5").status_code, 200)
        self.assertIn("USDT balance updated", self.titles())

    def test_wallet_delete_and_restore_alert_the_user(self):
        self.assertEqual(self.act("delete_wallet", asset="BTC").status_code, 200)
        self.assertIn("BTC wallet removed", self.titles())
        self.assertEqual(self.act("restore_wallet", asset="BTC").status_code, 200)
        self.assertIn("BTC wallet restored", self.titles())

    def test_kyc_decisions_alert_the_user(self):
        self.assertEqual(self.act("verify_kyc").status_code, 200)
        self.assertIn("Identity verified", self.titles())
        self.assertEqual(self.act("reject_kyc").status_code, 200)
        self.assertIn("Identity verification not approved", self.titles())

    def test_vip_change_alerts_the_user(self):
        self.assertEqual(self.act("set_vip", vip_level=2).status_code, 200)
        self.assertIn("VIP level 2", self.titles())

    def test_crediting_a_deposit_alerts_the_user(self):
        dep = DepositRequest.objects.create(
            user=self.target, asset="USDT", network="TRC20", amount=Decimal("100"), txid="abc123"
        )
        resp = self.client.post(
            f"/api/admin/deposits/{dep.id}/", {"action": "credit", "amount": "100"}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Deposit of 100 USDT credited", self.titles())

    def test_rejecting_a_deposit_alerts_the_user(self):
        dep = DepositRequest.objects.create(
            user=self.target, asset="USDT", network="TRC20", amount=Decimal("100"), txid="abc123"
        )
        resp = self.client.post(
            f"/api/admin/deposits/{dep.id}/", {"action": "reject", "note": "No funds arrived"}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Deposit of 100 USDT rejected", self.titles())

    def test_approving_a_withdrawal_alerts_the_user(self):
        ensure_wallet(self.target, "USDT")
        Wallet.objects.filter(user=self.target, asset="USDT").update(
            available=Decimal("0"), frozen=Decimal("101")
        )
        wr = WithdrawalRequest.objects.create(
            user=self.target, asset="USDT", network="TRC20", amount=Decimal("100"),
            fee=Decimal("1"), address="TXYZ",
        )
        resp = self.client.post(f"/api/admin/withdrawals/{wr.id}/", {"action": "approve"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Withdrawal of 100 USDT sent", self.titles())

    def test_rejecting_a_withdrawal_alerts_the_user(self):
        ensure_wallet(self.target, "USDT")
        Wallet.objects.filter(user=self.target, asset="USDT").update(
            available=Decimal("0"), frozen=Decimal("101")
        )
        wr = WithdrawalRequest.objects.create(
            user=self.target, asset="USDT", network="TRC20", amount=Decimal("100"),
            fee=Decimal("1"), address="TXYZ",
        )
        resp = self.client.post(f"/api/admin/withdrawals/{wr.id}/", {"action": "reject"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Withdrawal of 100 USDT rejected", self.titles())


class KycSubmissionTests(APITestCase):
    """Everything the Settings KYC form sends must reach the admin console,
    and an admin approval must actually open the withdrawal gate."""

    def setUp(self):
        self.target = User.objects.create_user("amy", "amy@vyne.test", "Str0ngPass123")
        self.staff = User.objects.create_user("ops", "ops@vyne.test", "Str0ngPass123", is_staff=True)

    def submit(self, **extra):
        self.client.force_authenticate(self.target)
        body = {
            "first_name": "Amy", "last_name": "Zhang",
            "kyc_name": "Amy Zhang", "kyc_address": "1 Main St, Springfield",
            "kyc_id_image": "data:image/jpeg;base64,AAAA",
            "submit_kyc": True,
        }
        body.update(extra)
        return self.client.patch("/api/auth/me/", body, format="json")

    def test_submit_saves_every_field_the_form_sends(self):
        resp = self.submit()
        self.assertEqual(resp.status_code, 200)
        self.target.refresh_from_db()
        self.assertEqual(self.target.kyc_status, "pending")
        self.assertEqual(self.target.first_name, "Amy")
        self.assertEqual(self.target.last_name, "Zhang")
        self.assertEqual(self.target.kyc_address, "1 Main St, Springfield")
        self.assertEqual(self.target.kyc_id_image, "data:image/jpeg;base64,AAAA")

    def test_admin_alert_carries_the_submitted_details(self):
        self.submit()
        note = AdminNotification.objects.filter(kind="kyc").latest("id")
        self.assertIn("1 Main St, Springfield", note.body)
        self.assertIn("ID card: attached", note.body)

    def test_users_list_strips_the_photo_but_keeps_the_details(self):
        # The console polls /admin/users every 8 seconds; the photo must not
        # ride along on that poll.
        self.submit()
        self.client.force_authenticate(self.staff)
        row = next(r for r in self.client.get("/api/admin/users/").data if r["id"] == self.target.id)
        self.assertEqual(row["kyc_address"], "1 Main St, Springfield")
        self.assertNotIn("kyc_id_image", row)

    def test_get_profile_returns_the_photo_for_the_eye_button(self):
        self.submit()
        self.client.force_authenticate(self.staff)
        resp = self.client.post(
            f"/api/admin/users/{self.target.id}/", {"action": "get_profile"}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["kyc_id_image"], "data:image/jpeg;base64,AAAA")

    def test_resubmit_does_not_wipe_fields_the_form_omits(self):
        # The form no longer sends kyc_id_number; an unconditional
        # request.data.get("kyc_id_number", "") would blank it on every submit.
        User.objects.filter(pk=self.target.pk).update(kyc_id_number="AB123456")
        # force_authenticate reuses the instance it is given, so it must be
        # re-read first or the PATCH would save the stale in-memory copy.
        self.target.refresh_from_db()
        self.submit(kyc_address="2 Other St")
        self.target.refresh_from_db()
        self.assertEqual(self.target.kyc_id_number, "AB123456")
        self.assertEqual(self.target.kyc_address, "2 Other St")

    def test_admin_approval_opens_the_withdrawal_gate(self):
        # Regression for "approved KYC but withdraw still says not verified":
        # the API gate must open the moment the admin verifies.
        self.submit()
        self.client.force_authenticate(self.staff)
        self.client.post(
            f"/api/admin/users/{self.target.id}/", {"action": "verify_kyc"}, format="json"
        )
        # Same instance-reuse caveat as above: re-read before the user makes
        # their own request, or they still carry the pre-approval status.
        self.target.refresh_from_db()
        w = ensure_wallet(self.target, "USDT")
        w.available = Decimal("100")
        w.save()
        self.client.force_authenticate(self.target)
        resp = self.client.post(
            "/api/wallet/withdraw/",
            {"asset": "USDT", "network": "TRC20", "amount": "10", "address": "TXYZ"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)

