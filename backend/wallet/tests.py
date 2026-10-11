"""Tests for deposits, withdrawals and admin approval flows."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from wallet.models import (
    Wallet, PlatformDepositAddress, DepositRequest, WithdrawalRequest, ensure_wallet,
)

User = get_user_model()


def credit(user, asset, amount):
    ensure_wallet(user, asset)
    Wallet.objects.filter(user=user, asset=asset).update(available=Decimal(amount))


def available(user, asset):
    ensure_wallet(user, asset)
    return Wallet.objects.get(user=user, asset=asset).available


def frozen(user, asset):
    ensure_wallet(user, asset)
    return Wallet.objects.get(user=user, asset=asset).frozen


class WalletFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("depositor", "d@vyne.test", "Str0ngPass123")
        self.staff = User.objects.create_user("ops", "ops@vyne.test", "Str0ngPass123", is_staff=True)
        self.client.force_authenticate(self.user)
        PlatformDepositAddress.objects.create(
            asset="USDT", network="TRC20", address="TTestDepositAddress", is_active=True
        )

    def verify_kyc(self):
        self.user.kyc_status = "verified"
        self.user.save()

    def deposit(self, txid="tx-1", amount="100", network="TRC20"):
        return self.client.post("/api/wallet/deposit/", {
            "asset": "USDT", "network": network, "amount": amount, "txid": txid,
        }, format="json")

    def test_deposit_requires_txid_and_configured_address(self):
        resp = self.deposit(txid="")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(DepositRequest.objects.count(), 0)
        # ERC20 has no configured address yet
        self.assertEqual(self.deposit(txid="abc", network="ERC20").status_code, 400)

    def test_deposit_starts_pending_and_does_not_credit(self):
        self.assertEqual(self.deposit().status_code, 201)
        deposit = DepositRequest.objects.get()
        self.assertEqual(deposit.status, "pending")
        self.assertEqual(deposit.to_address, "TTestDepositAddress")
        self.assertEqual(available(self.user, "USDT"), Decimal("0"))

    def test_duplicate_pending_txid_is_rejected(self):
        self.deposit(txid="tx-dup")
        self.deposit(txid="tx-dup")
        self.assertEqual(DepositRequest.objects.count(), 1)

    def test_admin_credit_is_idempotent(self):
        self.deposit(txid="tx-2")
        deposit = DepositRequest.objects.get()
        self.client.force_authenticate(self.staff)
        resp = self.client.post(f"/api/admin/deposits/{deposit.id}/", {"action": "credit"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(available(self.user, "USDT"), Decimal("100"))
        again = self.client.post(f"/api/admin/deposits/{deposit.id}/", {"action": "credit"}, format="json")
        self.assertEqual(again.status_code, 400)
        self.assertEqual(available(self.user, "USDT"), Decimal("100"))

    def test_rejected_deposit_cannot_be_credited(self):
        self.deposit(txid="tx-3")
        deposit = DepositRequest.objects.get()
        self.client.force_authenticate(self.staff)
        self.client.post(f"/api/admin/deposits/{deposit.id}/", {"action": "reject"}, format="json")
        resp = self.client.post(f"/api/admin/deposits/{deposit.id}/", {"action": "credit"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(available(self.user, "USDT"), Decimal("0"))

    def test_withdrawal_requires_kyc(self):
        credit(self.user, "USDT", "500")
        resp = self.client.post("/api/wallet/withdraw/", {
            "asset": "USDT", "network": "TRC20", "amount": "10", "address": "TOut",
        }, format="json")
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(available(self.user, "USDT"), Decimal("500"))

    def test_withdrawal_reserves_amount_plus_fee(self):
        self.verify_kyc()
        credit(self.user, "USDT", "500")
        resp = self.client.post("/api/wallet/withdraw/", {
            "asset": "USDT", "network": "TRC20", "amount": "10", "address": "TOut",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(available(self.user, "USDT"), Decimal("489"))
        self.assertEqual(frozen(self.user, "USDT"), Decimal("11"))
        self.assertEqual(WithdrawalRequest.objects.get().status, "pending")

    def test_withdrawal_rejection_returns_funds(self):
        self.verify_kyc()
        credit(self.user, "USDT", "500")
        self.client.post("/api/wallet/withdraw/", {
            "asset": "USDT", "network": "TRC20", "amount": "10", "address": "TOut",
        }, format="json")
        wr = WithdrawalRequest.objects.get()
        self.client.force_authenticate(self.staff)
        resp = self.client.post(f"/api/admin/withdrawals/{wr.id}/", {"action": "reject"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(available(self.user, "USDT"), Decimal("500"))
        self.assertEqual(frozen(self.user, "USDT"), Decimal("0"))

    def test_withdrawal_approval_is_idempotent(self):
        self.verify_kyc()
        credit(self.user, "USDT", "500")
        self.client.post("/api/wallet/withdraw/", {
            "asset": "USDT", "network": "TRC20", "amount": "10", "address": "TOut",
        }, format="json")
        wr = WithdrawalRequest.objects.get()
        self.client.force_authenticate(self.staff)
        self.client.post(f"/api/admin/withdrawals/{wr.id}/", {"action": "approve"}, format="json")
        again = self.client.post(f"/api/admin/withdrawals/{wr.id}/", {"action": "approve"}, format="json")
        self.assertEqual(again.status_code, 400)
        self.assertEqual(frozen(self.user, "USDT"), Decimal("0"))

    def test_insufficient_balance_blocks_withdrawal(self):
        self.verify_kyc()
        credit(self.user, "USDT", "5")
        resp = self.client.post("/api/wallet/withdraw/", {
            "asset": "USDT", "network": "TRC20", "amount": "10", "address": "TOut",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(WithdrawalRequest.objects.count(), 0)

    def test_admin_cannot_make_balance_negative(self):
        self.client.force_authenticate(self.staff)
        resp = self.client.post(f"/api/admin/users/{self.user.id}/", {
            "action": "adjust_balance", "asset": "USDT", "delta": "-99999",
        }, format="json")
        self.assertEqual(resp.status_code, 400)


class HeldBalancesTests(APITestCase):
    """The assets overview lists only coins the user actually holds."""

    def setUp(self):
        self.user = User.objects.create_user("holder", "h@vyne.test", "Str0ngPass123")
        self.client.force_authenticate(self.user)

    def test_default_returns_every_wallet(self):
        resp = self.client.get("/api/wallet/balances/")
        self.assertEqual(resp.status_code, 200)
        assets = {row["asset"] for row in resp.data}
        self.assertIn("USDT", assets)
        self.assertIn("BTC", assets)
        self.assertGreater(len(assets), 2)

    def test_held_filter_drops_zero_balances(self):
        credit(self.user, "USDT", "25")
        resp = self.client.get("/api/wallet/balances/?held=1")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual({row["asset"] for row in resp.data}, {"USDT"})
        self.assertEqual(Decimal(str(resp.data[0]["total"])), Decimal("25"))

    def test_held_filter_keeps_funds_frozen_in_orders(self):
        # available is zero once an open order or withdrawal locks the funds,
        # but the user still "holds" the coin, so it must stay on screen.
        ensure_wallet(self.user, "BTC")
        Wallet.objects.filter(user=self.user, asset="BTC").update(
            available=Decimal("0"), frozen=Decimal("1.5"),
        )
        resp = self.client.get("/api/wallet/balances/?held=1")
        self.assertEqual({row["asset"] for row in resp.data}, {"BTC"})
        self.assertEqual(Decimal(str(resp.data[0]["frozen"])), Decimal("1.5"))

    def test_other_held_values_keep_the_full_list(self):
        # The trade and withdraw screens resolve a single asset by name and
        # still need zero balances, so the filter stays strictly opt-in.
        credit(self.user, "USDT", "25")
        for flag in ("0", "false", ""):
            resp = self.client.get(f"/api/wallet/balances/?held={flag}")
            self.assertGreater(len(resp.data), 2, f"held={flag} should not filter")

