"""Settlement tests for the trading engine. These guard real balance movement."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from trading.models import Market, Order, Trade
from wallet.models import Wallet, ensure_wallet

User = get_user_model()


def credit(user, asset, amount):
    ensure_wallet(user, asset)
    Wallet.objects.filter(user=user, asset=asset).update(available=Decimal(amount))
    return Wallet.objects.get(user=user, asset=asset)


def balance(user, asset):
    return Wallet.objects.get(user=user, asset=asset).available


def frozen(user, asset):
    return Wallet.objects.get(user=user, asset=asset).frozen


class TradingTestBase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("trader", "t@vyne.test", "Str0ngPass123")
        self.other = User.objects.create_user("maker", "m@vyne.test", "Str0ngPass123")
        self.client.force_authenticate(self.user)
        self.market = Market.objects.create(
            symbol="BTCUSDT", base="BTC", quote="USDT", name="Bitcoin",
            price=Decimal("100"), market_cap_rank=1, is_active=True,
        )

    def test_wallet_is_created_for_new_listing(self):
        """Any coin quoted in the market feed must be tradeable, not just the original ten."""
        Market.objects.create(
            symbol="PEPEUSDT", base="PEPE", quote="USDT", name="Pepe",
            price=Decimal("0.000004"), market_cap_rank=50, is_active=True,
        )
        from wallet.models import ensure_wallets
        ensure_wallets(self.user)
        self.assertTrue(Wallet.objects.filter(user=self.user, asset="PEPE").exists())
        self.assertTrue(Wallet.objects.filter(user=self.user, asset="BTC").exists())

    def test_market_buy_settles_correctly(self):
        credit(self.user, "USDT", "1000")
        resp = self.client.post("/api/trading/order/", {
            "symbol": "BTCUSDT", "side": "buy", "order_type": "market", "quantity": "2",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        # 2 BTC at 100 = 200 notional, 0.1% fee = 0.2
        self.assertEqual(balance(self.user, "USDT"), Decimal("799.8"))
        self.assertEqual(balance(self.user, "BTC"), Decimal("2"))
        self.assertEqual(Order.objects.filter(user=self.user).count(), 1)
        self.assertEqual(Trade.objects.filter(user=self.user).count(), 1)

    def test_market_buy_rejects_insufficient_funds(self):
        credit(self.user, "USDT", "10")
        resp = self.client.post("/api/trading/order/", {
            "symbol": "BTCUSDT", "side": "buy", "order_type": "market", "quantity": "2",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(balance(self.user, "USDT"), Decimal("10"))
        self.assertEqual(Order.objects.count(), 0)

    def test_market_sell_settles_correctly(self):
        credit(self.user, "BTC", "3")
        resp = self.client.post("/api/trading/order/", {
            "symbol": "BTCUSDT", "side": "sell", "order_type": "market", "quantity": "2",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(balance(self.user, "BTC"), Decimal("1"))
        self.assertEqual(balance(self.user, "USDT"), Decimal("199.8"))

    def test_limit_order_reserves_and_cancel_releases(self):
        credit(self.user, "USDT", "1000")
        resp = self.client.post("/api/trading/order/", {
            "symbol": "BTCUSDT", "side": "buy", "order_type": "limit",
            "quantity": "2", "price": "100",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        order_id = resp.data["order"]["id"]
        # 200 notional + 0.2 fee held in frozen, not spent
        self.assertEqual(balance(self.user, "USDT"), Decimal("799.8"))
        self.assertEqual(frozen(self.user, "USDT"), Decimal("200.2"))

        cancel = self.client.post(f"/api/trading/orders/{order_id}/cancel/", {}, format="json")
        self.assertEqual(cancel.status_code, 200)
        self.assertEqual(balance(self.user, "USDT"), Decimal("1000"))
        self.assertEqual(frozen(self.user, "USDT"), Decimal("0"))

    def test_limit_orders_match_across_users(self):
        credit(self.user, "BTC", "2")
        credit(self.other, "USDT", "1000")

        resp = self.client.post("/api/trading/order/", {
            "symbol": "BTCUSDT", "side": "sell", "order_type": "limit",
            "quantity": "2", "price": "100",
        }, format="json")
        self.assertEqual(resp.status_code, 201)

        self.client.force_authenticate(self.other)
        match = self.client.post("/api/trading/order/", {
            "symbol": "BTCUSDT", "side": "buy", "order_type": "limit",
            "quantity": "2", "price": "100",
        }, format="json")
        self.assertEqual(match.status_code, 201)
        self.assertIn("filled", match.data["message"])

        # Seller: base gone, 200 less 0.1% fee received
        self.assertEqual(balance(self.user, "BTC"), Decimal("0"))
        self.assertEqual(balance(self.user, "USDT"), Decimal("199.8"))
        # Buyer: base received, 200 + 0.2 fee paid
        self.assertEqual(balance(self.other, "BTC"), Decimal("2"))
        self.assertEqual(balance(self.other, "USDT"), Decimal("799.8"))
        self.assertEqual(Order.objects.get(user=self.user).status, "filled")

    def test_order_book_reflects_open_orders(self):
        credit(self.user, "USDT", "1000")
        self.client.post("/api/trading/order/", {
            "symbol": "BTCUSDT", "side": "buy", "order_type": "limit",
            "quantity": "1", "price": "90",
        }, format="json")
        book = self.client.get("/api/trading/orderbook/?symbol=BTCUSDT")
        self.assertEqual(book.status_code, 200)
        self.assertEqual(len(book.data["bids"]), 1)
        self.assertEqual(Decimal(book.data["bids"][0]["price"]), Decimal("90"))

    def test_invalid_order_parameters_are_rejected(self):
        credit(self.user, "USDT", "1000")
        for payload in (
            {"symbol": "BTCUSDT", "side": "buy", "order_type": "market", "quantity": "-1"},
            {"symbol": "BTCUSDT", "side": "sideways", "order_type": "market", "quantity": "1"},
            {"symbol": "BTCUSDT", "side": "buy", "order_type": "limit", "quantity": "1"},
            {"symbol": "NOPEUSDT", "side": "buy", "order_type": "market", "quantity": "1"},
        ):
            resp = self.client.post("/api/trading/order/", payload, format="json")
            self.assertEqual(resp.status_code, 400, payload)

    def test_frozen_user_cannot_trade(self):
        self.user.is_frozen = True
        self.user.save()
        credit(self.user, "USDT", "1000")
        resp = self.client.post("/api/trading/order/", {
            "symbol": "BTCUSDT", "side": "buy", "order_type": "market", "quantity": "1",
        }, format="json")
        self.assertEqual(resp.status_code, 403)

