"""Futures position tests: margin handling, P&L and liquidation."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from trading.models import Market, Position
from trading.views import liquidate_positions, refresh_unrealized
from wallet.models import Wallet, ensure_wallet

User = get_user_model()


def credit(user, amount):
    ensure_wallet(user, "USDT")
    Wallet.objects.filter(user=user, asset="USDT").update(available=Decimal(amount))


def usdt(user):
    return Wallet.objects.get(user=user, asset="USDT")


class FuturesTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("futures", "f@vyne.test", "Str0ngPass123")
        self.client.force_authenticate(self.user)
        self.market = Market.objects.create(
            symbol="BTCUSDT", base="BTC", quote="USDT", name="Bitcoin",
            price=Decimal("100"), market_cap_rank=1, is_active=True,
        )
        credit(self.user, "10000")

    def open_position(self, side="long", leverage=10, qty="1"):
        return self.client.post("/api/trading/futures/", {
            "symbol": "BTCUSDT", "side": side, "leverage": leverage, "quantity": qty,
        }, format="json")

    def test_open_position_reserves_margin(self):
        resp = self.open_position(qty="1")
        self.assertEqual(resp.status_code, 201)
        # 100 notional / 10x = 10 margin held frozen
        self.assertEqual(usdt(self.user).frozen, Decimal("10"))
        self.assertEqual(Position.objects.count(), 1)

    def test_open_position_requires_margin(self):
        credit(self.user, "5")
        resp = self.open_position(qty="10")  # needs 100 margin
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Position.objects.count(), 0)

    def test_leverage_is_clamped(self):
        resp = self.client.post("/api/trading/futures/", {
            "symbol": "BTCUSDT", "side": "long", "leverage": 5000, "quantity": "1",
        }, format="json")
        self.assertEqual(resp.data["leverage"], 100)

    def test_unrealized_pnl_tracks_price(self):
        self.open_position(qty="1")
        self.market.price = Decimal("110")
        self.market.save()
        refresh_unrealized()
        pos = Position.objects.get()
        self.assertEqual(pos.unrealized, Decimal("10"))
        self.assertEqual(pos.roe, Decimal("100.00"))

    def test_short_position_loses_when_price_rises(self):
        self.open_position(side="short", qty="1")
        self.market.price = Decimal("110")
        self.market.save()
        refresh_unrealized()
        self.assertEqual(Position.objects.get().unrealized, Decimal("-10"))

    def test_liquidation_closes_long_and_burns_margin(self):
        self.open_position(leverage=10, qty="1")
        # liq price for 10x long is 100 * (1 - 0.09) = 91
        self.market.price = Decimal("80")
        self.market.save()
        closed = liquidate_positions()
        self.assertEqual(closed, 1)
        pos = Position.objects.get()
        self.assertEqual(pos.status, "closed")
        self.assertTrue(pos.liquidated)
        self.assertEqual(pos.realized, Decimal("-10"))
        self.assertEqual(usdt(self.user).frozen, Decimal("0"))

    def test_liquidation_closes_short_when_price_rises(self):
        self.open_position(side="short", leverage=10, qty="1")
        self.market.price = Decimal("120")
        self.market.save()
        self.assertEqual(liquidate_positions(), 1)
        self.assertTrue(Position.objects.get().liquidated)

    def test_open_position_is_not_liquidated_above_threshold(self):
        self.open_position(leverage=10, qty="1")
        self.market.price = Decimal("95")
        self.market.save()
        self.assertEqual(liquidate_positions(), 0)
        self.assertEqual(Position.objects.get().status, "open")

    def test_close_releases_margin_and_pays_pnl(self):
        self.open_position(qty="1")
        self.market.price = Decimal("110")
        self.market.save()
        before = usdt(self.user).available
        pos = Position.objects.get()
        resp = self.client.post(f"/api/trading/futures/{pos.id}/close/", {}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(usdt(self.user).frozen, Decimal("0"))
        # 9000 available + 10 profit
        self.assertEqual(usdt(self.user).available, before + Decimal("10"))
        self.assertEqual(Position.objects.get().status, "closed")

    def test_close_cannot_be_called_twice(self):
        self.open_position(qty="1")
        pos = Position.objects.get()
        self.client.post(f"/api/trading/futures/{pos.id}/close/", {}, format="json")
        again = self.client.post(f"/api/trading/futures/{pos.id}/close/", {}, format="json")
        self.assertEqual(again.status_code, 404)
