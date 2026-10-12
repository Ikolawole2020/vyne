from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from rest_framework import generics, permissions
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView
from wallet.models import Wallet, ensure_wallets, ensure_wallet
from .marketfeed import refresh_markets, feed_status
from .models import Market, Order, Trade
from .serializers import MarketSerializer, OrderSerializer, TradeSerializer


def active_markets():
    return Market.objects.filter(is_active=True)


class MarketListView(APIView):
    """All listed markets, refreshing from the live feed when it is stale."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            refresh_markets()
        except Exception:  # noqa: BLE001 - never fail the page on feed errors
            pass
        if not active_markets().exists():
            refresh_markets(force=True)
        return Response(MarketSerializer(active_markets().order_by("market_cap_rank", "symbol"), many=True).data)


class FeedStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(feed_status())

    def post(self, request):
        return Response({"updated": refresh_markets(force=True), **feed_status()})


class MarketTickView(APIView):
    """Refresh live prices. Called by the frontend on an interval."""
    permission_classes = [permissions.AllowAny]
    # The frontend polls this every 2s (~30/min per open tab), so it must not be
    # capped by the general `anon` bucket. Setting throttle_classes explicitly is
    # what actually applies the `tick` scope -- DEFAULT_THROTTLE_CLASSES only
    # lists Anon/UserRateThrottle, which ignore throttle_scope entirely.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "tick"

    def post(self, request):
        try:
            refresh_markets()
        except Exception:  # noqa: BLE001
            pass
        try:
            from products.views import process_grid_bots
            process_grid_bots()
        except Exception:
            pass
        try:
            liquidate_positions()
        except Exception:
            pass
        return Response(MarketSerializer(active_markets().order_by("market_cap_rank", "symbol"), many=True).data)

    def get(self, request):
        return Response(MarketSerializer(active_markets().order_by("market_cap_rank", "symbol"), many=True).data)

class PlaceOrderView(APIView):
    def post(self, request):
        user = request.user
        if user.is_frozen:
            return Response({"detail": "Account frozen"}, status=403)
        symbol = request.data.get("symbol", "BTCUSDT")
        side = request.data.get("side", "buy")
        order_type = request.data.get("order_type", "market")
        quantity = Decimal(str(request.data.get("quantity", "0")))
        limit_price = Decimal(str(request.data.get("price") or "0"))
        if quantity <= 0:
            return Response({"detail": "Invalid quantity"}, status=400)
        if side not in {"buy", "sell"} or order_type not in {"market", "limit"}:
            return Response({"detail": "Invalid order side or type"}, status=400)
        if order_type == "limit" and not request.data.get("price"):
            return Response({"detail": "Limit orders require a price"}, status=400)
        market = Market.objects.filter(symbol=symbol).first()
        if not market:
            return Response({"detail": "Unknown market"}, status=400)
        price = market.price if order_type == "market" else limit_price
        if price <= 0:
            return Response({"detail": "Invalid price"}, status=400)
        notional = (price * quantity).quantize(Decimal("0.00000001"))
        fee = (notional * Decimal("0.001")).quantize(Decimal("0.00000001"))
        base, quote = market.base, market.quote
        ensure_wallets(user)
        with transaction.atomic():
            if order_type == "limit":
                asset = quote if side == "buy" else base
                ensure_wallet(user, asset)
                wallet = Wallet.objects.select_for_update().get(user=user, asset=asset)
                reserved = notional + fee if side == "buy" else quantity
                if wallet.available < reserved:
                    return Response({"detail": f"Insufficient {wallet.asset}"}, status=400)
                wallet.available -= reserved
                wallet.frozen += reserved
                wallet.save(update_fields=["available", "frozen"])
                order = Order.objects.create(
                    user=user, symbol=symbol, side=side, order_type=order_type,
                    price=price, quantity=quantity, reserved_amount=reserved, status="open",
                )
                try:
                    from .services import match_order, InsufficientReserved
                    filled = match_order(order, market)
                except InsufficientReserved:
                    filled = Decimal("0")
                order.refresh_from_db()
                if filled > 0 and order.status == "filled":
                    message = f"Order filled: {filled}"
                elif filled > 0:
                    message = f"Order partially filled: {filled} of {quantity}, rest is open"
                else:
                    message = "Order placed in the order book"
                return Response({"order": OrderSerializer(order).data, "message": message}, status=201)
            ensure_wallets(user)
            if side == "buy":
                need = notional + fee
                qw = Wallet.objects.select_for_update().get(user=user, asset=quote)
                if qw.available < need:
                    return Response({"detail": f"Insufficient {quote}. Need {need}"}, status=400)
                qw.available -= need
                qw.save()
                ensure_wallet(user, base)
                bw = Wallet.objects.select_for_update().get(user=user, asset=base)
                bw.available += quantity
                bw.save()
            else:
                bw = Wallet.objects.select_for_update().get(user=user, asset=base)
                if bw.available < quantity:
                    return Response({"detail": f"Insufficient {base}"}, status=400)
                bw.available -= quantity
                bw.save()
                qw = Wallet.objects.select_for_update().get(user=user, asset=quote)
                qw.available += (notional - fee)
                qw.save()
            order = Order.objects.create(
                user=user, symbol=symbol, side=side, order_type=order_type,
                price=price, quantity=quantity, filled_qty=quantity, status="filled",
            )
            trade = Trade.objects.create(
                user=user, order=order, symbol=symbol, side=side,
                price=price, quantity=quantity, fee=fee,
            )
        return Response({"order": OrderSerializer(order).data, "trade": TradeSerializer(trade).data}, status=201)

class MyOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    def get_queryset(self):
        qs = Order.objects.filter(user=self.request.user)
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        return qs.order_by("-id")[:200]

class CancelOrderView(APIView):
    @transaction.atomic
    def post(self, request, pk):
        try:
            order = Order.objects.select_for_update().get(pk=pk, user=request.user, status="open")
        except Order.DoesNotExist:
            return Response({"detail": "Open order not found"}, status=404)
        market = Market.objects.filter(symbol=order.symbol).first()
        if not market:
            return Response({"detail": "Market not found"}, status=400)
        asset = market.quote if order.side == "buy" else market.base
        ensure_wallet(request.user, asset)
        wallet = Wallet.objects.select_for_update().get(user=request.user, asset=asset)
        reserved = order.reserved_amount
        if reserved > 0 and wallet.frozen < reserved:
            return Response({"detail": "Reserved balance is unavailable"}, status=400)
        wallet.frozen -= reserved
        wallet.available += reserved
        wallet.save(update_fields=["frozen", "available"])
        order.reserved_amount = Decimal("0")
        order.status = "cancelled"
        order.save(update_fields=["status", "reserved_amount"])
        return Response(OrderSerializer(order).data)

class OrderBookView(APIView):
    """Aggregated public order book for a symbol."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        symbol = request.query_params.get("symbol", "BTCUSDT")
        market = Market.objects.filter(symbol=symbol, is_active=True).first()
        if not market:
            return Response({"detail": "Unknown market"}, status=404)
        depth = 25

        def aggregate(side):
            rows = (
                Order.objects.filter(symbol=symbol, side=side, order_type="limit", status="open")
                .values("price")
                .annotate(quantity=Sum("quantity") - Sum("filled_qty"))
                .order_by("price" if side == "buy" else "-price")[:depth]
            )
            return [{"price": str(r["price"]), "quantity": str(r["quantity"] or Decimal("0"))} for r in rows]

        return Response({
            "symbol": symbol,
            "bids": aggregate("buy"),
            "asks": aggregate("sell"),
        })


class MyTradesView(generics.ListAPIView):
    serializer_class = TradeSerializer
    def get_queryset(self):
        return Trade.objects.filter(user=self.request.user).order_by("-id")[:100]

from django.utils import timezone
from .models import Position
from .serializers import PositionSerializer


def _pnl_for(pos, price):
    if pos.side == "long":
        return ((price - pos.entry) * pos.qty).quantize(Decimal("0.00000001"))
    return ((pos.entry - price) * pos.qty).quantize(Decimal("0.00000001"))


@transaction.atomic
def liquidate_positions():
    """
    Close any open position whose mark price has reached its liquidation price.
    Called on every market tick. Margin is burned on liquidation, matching how
    a losing leveraged position is wiped out.
    """
    marks = {m.symbol: m.price for m in Market.objects.filter(is_active=True)}
    closed = 0
    for pos in Position.objects.select_for_update().filter(status="open"):
        mark = marks.get(pos.symbol)
        if not mark or not pos.is_liquidatable(mark):
            continue
        wallet = Wallet.objects.select_for_update().get(user=pos.user, asset="USDT")
        wallet.frozen = max(Decimal("0"), wallet.frozen - pos.margin)
        wallet.save(update_fields=["frozen"])
        pos.status = "closed"
        pos.liquidated = True
        pos.closed_at = timezone.now()
        pos.close_price = mark
        pos.realized = -pos.margin
        pos.unrealized = Decimal("0")
        pos.roe = Decimal("-100")
        pos.save()
        closed += 1
    return closed


@transaction.atomic
def refresh_unrealized():
    """Keep Position.unrealized / roe in sync with the latest mark price."""
    marks = {m.symbol: m.price for m in Market.objects.filter(is_active=True)}
    updated = 0
    for pos in Position.objects.select_for_update().filter(status="open"):
        mark = marks.get(pos.symbol)
        if not mark:
            continue
        pnl = pos.unrealized_pnl(mark)
        roe = pos.return_on_equity(mark)
        if pnl != pos.unrealized or roe != pos.roe:
            pos.unrealized = pnl
            pos.roe = roe
            pos.save(update_fields=["unrealized", "roe"])
            updated += 1
    return updated

class OpenFuturesView(APIView):
    def post(self, request):
        user = request.user
        if user.is_frozen:
            return Response({"detail": "Account frozen"}, status=403)
        symbol = request.data.get("symbol", "BTCUSDT")
        side = request.data.get("side", "long")
        leverage = int(request.data.get("leverage", 10) or 10)
        leverage = max(1, min(100, leverage))
        qty = Decimal(str(request.data.get("quantity", "0")))
        market = Market.objects.filter(symbol=symbol).first()
        if not market or qty <= 0:
            return Response({"detail": "Invalid market or qty"}, status=400)
        notional = market.price * qty
        margin = (notional / Decimal(leverage)).quantize(Decimal("0.00000001"))
        fee = (notional * Decimal("0.0006")).quantize(Decimal("0.00000001"))
        ensure_wallets(user)
        with transaction.atomic():
            w = Wallet.objects.select_for_update().get(user=user, asset="USDT")
            need = margin + fee
            if w.available < need:
                return Response({"detail": f"Need {need} USDT margin+fee"}, status=400)
            w.available -= need
            w.frozen += margin
            w.save()
            if side == "long":
                liq = market.price * (Decimal("1") - Decimal("0.9") / Decimal(leverage))
            else:
                liq = market.price * (Decimal("1") + Decimal("0.9") / Decimal(leverage))
            pos = Position.objects.create(
                user=user, symbol=symbol, side=side, leverage=leverage, qty=qty,
                entry=market.price, margin=margin, liq_price=liq,
            )
        return Response(PositionSerializer(pos).data, status=201)

class CloseFuturesView(APIView):
    def post(self, request, pk):
        with transaction.atomic():
            pos = Position.objects.select_for_update().filter(
                pk=pk, user=request.user, status="open"
            ).first()
            if not pos:
                return Response({"detail": "Position not found"}, status=404)
            market = Market.objects.filter(symbol=pos.symbol).first()
            price = market.price if market else pos.entry
            pnl = _pnl_for(pos, price)

            wallet = Wallet.objects.select_for_update().get(user=request.user, asset="USDT")
            # Return the unused margin plus P&L. A loss can push the balance
            # below the margin, so the loss is taken from available funds
            # rather than silently clamped (which would create money).
            wallet.frozen = max(Decimal("0"), wallet.frozen - pos.margin)
            wallet.available = max(Decimal("0"), wallet.available + pnl)
            wallet.save(update_fields=["frozen", "available"])

            pos.status = "closed"
            pos.closed_at = timezone.now()
            pos.close_price = price
            pos.realized = pnl
            pos.unrealized = Decimal("0")
            pos.roe = ((pnl / pos.margin) * Decimal("100")).quantize(Decimal("0.01")) if pos.margin else Decimal("0")
            pos.save()
        return Response(PositionSerializer(pos).data)

class PositionsView(generics.ListAPIView):
    serializer_class = PositionSerializer
    def get_queryset(self):
        st = self.request.query_params.get("status")
        qs = Position.objects.filter(user=self.request.user)
        if st:
            qs = qs.filter(status=st)
        return qs.order_by("-id")[:200]

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Refresh mark-to-market P&L so the UI always shows live figures.
        marks = {m.symbol: m.price for m in Market.objects.filter(is_active=True)}
        for row in response.data:
            mark = marks.get(row["symbol"])
            if mark and row.get("status") == "open":
                qty = Decimal(str(row["qty"]))
                entry = Decimal(str(row["entry"]))
                margin = Decimal(str(row["margin"]))
                pnl = ((mark - entry) * qty) if row["side"] == "long" else ((entry - mark) * qty)
                row["unrealized"] = str(pnl.quantize(Decimal("0.00000001")))
                row["roe"] = str(
                    ((pnl / margin) * Decimal("100")).quantize(Decimal("0.01")) if margin else Decimal("0")
                )
                row["mark_price"] = str(mark)
        return response
