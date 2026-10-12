from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, ListCreateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from wallet.models import Wallet, ensure_wallets, ensure_wallet
from accounts.models import notify, money
from trading.models import Market
from .models import EarnProduct, EarnPosition, ConvertTrade, CopyTrader, CopyFollow, P2PAd, P2POrder, Announcement, Testimonial
from .serializers import (
    EarnProductSerializer, EarnPositionSerializer, ConvertSerializer, CopyTraderSerializer,
    P2PAdSerializer, P2POrderSerializer, AnnouncementSerializer, TestimonialSerializer,
)

class EarnListView(ListAPIView):
    permission_classes = [AllowAny]
    queryset = EarnProduct.objects.filter(is_active=True)
    serializer_class = EarnProductSerializer

class EarnSubscribeView(APIView):
    def post(self, request):
        pid = request.data.get("product_id")
        amount = Decimal(str(request.data.get("amount", "0")))
        product = EarnProduct.objects.filter(pk=pid, is_active=True).first()
        if not product or amount < product.min_amount:
            return Response({"detail": "Invalid product or amount"}, status=400)
        ensure_wallets(request.user)
        with transaction.atomic():
            w = Wallet.objects.select_for_update().get(user=request.user, asset=product.asset)
            if w.available < amount:
                return Response({"detail": "Insufficient balance"}, status=400)
            w.available -= amount
            w.frozen += amount
            w.save()
            pos = EarnPosition.objects.create(user=request.user, product=product, amount=amount)
        notify(
            request.user,
            title=f"Subscribed {money(amount, product.asset)} to {product.name}",
            body=f"Your {money(amount, product.asset)} subscription to {product.name} is active and earning. Funds unlock on {pos.unlock_at:%Y-%m-%d %H:%M} UTC.",
            kind="system",
        )
        return Response(EarnPositionSerializer(pos).data, status=201)

class EarnMineView(ListAPIView):
    serializer_class = EarnPositionSerializer
    def get_queryset(self):
        return EarnPosition.objects.filter(user=self.request.user).order_by("-id")

class EarnRedeemView(APIView):
    def post(self, request, pk):
        with transaction.atomic():
            pos = EarnPosition.objects.select_for_update().filter(
                pk=pk, user=request.user, status="active"
            ).select_related("product").first()
            if not pos:
                return Response({"detail": "Not found"}, status=404)
            if not pos.is_unlocked:
                return Response(
                    {"detail": f"Funds unlock on {pos.unlock_at:%Y-%m-%d %H:%M} UTC"}, status=400
                )
            # Fold in interest earned up to this moment before paying out.
            pos.accrue()
            interest = pos.accrued
            w = Wallet.objects.select_for_update().get(user=request.user, asset=pos.product.asset)
            w.frozen = max(Decimal("0"), w.frozen - pos.amount)
            w.available += pos.amount + interest
            w.save(update_fields=["frozen", "available"])
            pos.status = "redeemed"
            pos.save(update_fields=["accrued", "status", "last_accrued_at"])
        notify(
            request.user,
            title=f"Redeemed {money(pos.amount + interest, pos.product.asset)} from {pos.product.name}",
            body=f"You redeemed {money(pos.amount, pos.product.asset)} from {pos.product.name} plus {money(interest, pos.product.asset)} in interest. Total returned {money(pos.amount + interest, pos.product.asset)}.",
            kind="system",
        )
        return Response(EarnPositionSerializer(pos).data)

class ConvertView(APIView):
    def post(self, request):
        src = request.data.get("from_asset", "USDT")
        dst = request.data.get("to_asset", "BTC")
        amount = Decimal(str(request.data.get("amount", "0")))
        if amount <= 0 or src == dst:
            return Response({"detail": "Invalid convert"}, status=400)
        def px(asset):
            if asset == "USDT":
                return Decimal("1")
            m = Market.objects.filter(base=asset, quote="USDT").first()
            return m.price if m else None
        ps, pd = px(src), px(dst)
        if not ps or not pd:
            return Response({"detail": "Unsupported pair"}, status=400)
        usdt = amount * ps
        got = (usdt / pd).quantize(Decimal("0.00000001"))
        ensure_wallets(request.user)
        with transaction.atomic():
            w1 = Wallet.objects.select_for_update().get(user=request.user, asset=src)
            if w1.available < amount:
                return Response({"detail": "Insufficient balance"}, status=400)
            w1.available -= amount
            w1.save()
            w2 = Wallet.objects.select_for_update().get(user=request.user, asset=dst)
            w2.available += got
            w2.save()
            c = ConvertTrade.objects.create(user=request.user, from_asset=src, to_asset=dst,
                                            from_amount=amount, to_amount=got, rate=(ps/pd))
            notify(
                request.user,
                title=f"Converted {money(amount, src)} to {money(got, dst)}",
                body=f"You swapped {money(amount, src)} for {money(got, dst)} at a rate of {ps / pd}. The new balance is available in your wallet.",
                kind="trade",
            )
        return Response(ConvertSerializer(c).data, status=201)

class ConvertHistoryView(ListAPIView):
    serializer_class = ConvertSerializer
    def get_queryset(self):
        return ConvertTrade.objects.filter(user=self.request.user).order_by("-id")

class CopyListView(ListAPIView):
    permission_classes = [AllowAny]
    queryset = CopyTrader.objects.all().order_by("-roi_30d")
    serializer_class = CopyTraderSerializer

class CopyFollowView(APIView):
    def post(self, request, pk):
        trader = CopyTrader.objects.filter(pk=pk).first()
        if not trader:
            return Response({"detail": "Not found"}, status=404)
        amt = Decimal(str(request.data.get("allocated", "100")))
        ensure_wallets(request.user)
        w = Wallet.objects.get(user=request.user, asset="USDT")
        if w.available < amt:
            return Response({"detail": "Need USDT to allocate"}, status=400)
        w.available -= amt
        w.frozen += amt
        w.save()
        obj, created = CopyFollow.objects.get_or_create(follower=request.user, trader=trader, defaults={"allocated": amt})
        if not created:
            obj.allocated += amt
            obj.save()
        else:
            trader.followers += 1
            trader.save()
        notify(
            request.user,
            title=f"Now copying {trader.display}",
            body=f"{money(amt)} is allocated to {trader.display} and will trade alongside their positions. Total allocated to this trader: {money(obj.allocated)}. Stop copying any time to release it.",
            kind="trade",
        )
        return Response({"ok": True, "allocated": str(obj.allocated)})

class P2PAdListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = P2PAdSerializer
    def get_queryset(self):
        qs = P2PAd.objects.filter(is_active=True)
        side = self.request.query_params.get("side")
        if side:
            qs = qs.filter(side=side)
        return qs.order_by("-id")

class P2PAdCreateView(APIView):
    def post(self, request):
        ad = P2PAd.objects.create(
            user=request.user,
            side=request.data.get("side", "sell"),
            asset=request.data.get("asset", "USDT"),
            fiat=request.data.get("fiat", "USD"),
            price=request.data.get("price", "1.00"),
            available=request.data.get("available", "1000"),
            min_limit=request.data.get("min_limit", "20"),
            max_limit=request.data.get("max_limit", "10000"),
            method=request.data.get("method", "Bank Transfer"),
        )
        notify(
            request.user,
            title=f"P2P {ad.side} ad published",
            body=f"Your {ad.side} ad for {ad.available} {ad.asset} at {ad.price} {ad.fiat} is now live on P2P, paid by {ad.method}. You will be alerted when a buyer takes it.",
            kind="p2p",
        )
        return Response(P2PAdSerializer(ad).data, status=201)

class P2PTakeView(APIView):
    def post(self, request, pk):
        if request.user.is_frozen:
            return Response({"detail": "Account frozen"}, status=403)
        fiat = Decimal(str(request.data.get("amount_fiat", "0") or "0"))
        try:
            if fiat <= 0:
                return Response({"detail": "Invalid amount"}, status=400)
        except (InvalidOperation, TypeError):
            return Response({"detail": "Invalid amount"}, status=400)

        with transaction.atomic():
            ad = P2PAd.objects.select_for_update().filter(pk=pk, is_active=True).first()
            if not ad:
                return Response({"detail": "Ad not found"}, status=404)
            if ad.user_id == request.user.id:
                return Response({"detail": "You cannot take your own ad"}, status=400)
            if fiat < ad.min_limit or fiat > ad.max_limit:
                return Response({"detail": f"Amount must be between {ad.min_limit} and {ad.max_limit} {ad.fiat}"}, status=400)

            asset_amt = (fiat / ad.price).quantize(Decimal("0.00000001"))
            if asset_amt > ad.available:
                return Response({"detail": "Not enough inventory on this ad"}, status=400)

            # The taker pays in crypto, the merchant pays in fiat. Lock the
            # taker's crypto immediately so the order cannot be free.
            ensure_wallets(request.user)
            w = Wallet.objects.select_for_update().get(user=request.user, asset=ad.asset)
            if w.available < asset_amt:
                return Response({"detail": f"Insufficient {ad.asset}"}, status=400)
            w.available -= asset_amt
            w.frozen += asset_amt
            w.save(update_fields=["available", "frozen"])

            ad.available -= asset_amt
            ad.save(update_fields=["available"])

            order = P2POrder.objects.create(
                ad=ad, taker=request.user, amount_asset=asset_amt, amount_fiat=fiat
            )
            notify(
                request.user,
                title=f"P2P order placed: {money(asset_amt, ad.asset)}",
                body=f"You are buying {money(asset_amt, ad.asset)} for {fiat} {ad.fiat} via {ad.method}. The crypto is reserved until the merchant releases it; cancel to get it back.",
                kind="p2p",
            )
        return Response(P2POrderSerializer(order).data, status=201)

class P2PMyOrdersView(ListAPIView):
    serializer_class = P2POrderSerializer
    def get_queryset(self):
        return P2POrder.objects.filter(taker=self.request.user).order_by("-id")


class P2PReleaseView(APIView):
    """Merchant releases fiat; the taker's crypto is unfrozen to the merchant."""

    def post(self, request, pk):
        with transaction.atomic():
            order = P2POrder.objects.select_for_update().select_related("ad").filter(pk=pk).first()
            if not order or order.ad.user_id != request.user.id:
                return Response({"detail": "Not found"}, status=404)
            if order.status != "pending":
                return Response({"detail": f"Order is already {order.status}"}, status=400)
            ensure_wallet(order.taker, order.ad.asset)
            ensure_wallet(request.user, order.ad.asset)
            tw = Wallet.objects.select_for_update().get(user=order.taker, asset=order.ad.asset)
            mw = Wallet.objects.select_for_update().get(user=request.user, asset=order.ad.asset)
            if tw.frozen < order.amount_asset:
                return Response({"detail": "Reserved balance is unavailable"}, status=400)
            tw.frozen -= order.amount_asset
            mw.available += order.amount_asset
            tw.save(update_fields=["frozen"])
            mw.save(update_fields=["available"])
            order.status = "released"
            order.save(update_fields=["status"])
            # Both sides need to know: the merchant just paid out fiat, and the
            # taker's reserved crypto has moved to the merchant.
            notify(
                order.taker,
                title=f"P2P order completed: {money(order.amount_asset, order.ad.asset)} sent",
                body=f"The merchant released {order.amount_fiat} {order.ad.fiat} for your order of {money(order.amount_asset, order.ad.asset)}. The crypto has been transferred.",
                kind="p2p",
            )
            notify(
                request.user,
                title=f"P2P order released: {money(order.amount_asset, order.ad.asset)} received",
                body=f"You released {order.amount_fiat} {order.ad.fiat} and received {money(order.amount_asset, order.ad.asset)} from the buyer.",
                kind="p2p",
            )
        return Response(P2POrderSerializer(order).data)


class P2PCancelView(APIView):
    """Taker cancels a pending order and gets their crypto back."""

    def post(self, request, pk):
        with transaction.atomic():
            order = P2POrder.objects.select_for_update().select_related("ad").filter(
                pk=pk, taker=request.user
            ).first()
            if not order:
                return Response({"detail": "Not found"}, status=404)
            if order.status != "pending":
                return Response({"detail": f"Order is already {order.status}"}, status=400)
            w = Wallet.objects.select_for_update().get(user=request.user, asset=order.ad.asset)
            if w.frozen < order.amount_asset:
                return Response({"detail": "Reserved balance is unavailable"}, status=400)
            w.frozen -= order.amount_asset
            w.available += order.amount_asset
            w.save(update_fields=["frozen", "available"])
            ad = P2PAd.objects.select_for_update().get(pk=order.ad_id)
            ad.available += order.amount_asset
            ad.save(update_fields=["available"])
            order.status = "cancelled"
            order.save(update_fields=["status"])
            notify(
                request.user,
                title=f"P2P order cancelled: {money(order.amount_asset, order.ad.asset)} returned",
                body=f"You cancelled your order for {money(order.amount_asset, order.ad.asset)}. The reserved balance is back in your available wallet and the ad inventory was restored.",
                kind="p2p",
            )
        return Response(P2POrderSerializer(order).data)

class AnnouncementsView(ListAPIView):
    permission_classes = [AllowAny]
    queryset = Announcement.objects.all().order_by("-id")
    serializer_class = AnnouncementSerializer

from .models import GridBot, GridFill
from .serializers import GridBotSerializer, GridFillSerializer

class TestimonialsView(APIView):
    """Public list of published testimonials for /testimonials.

    Reports `all_demo` so the page can show a placeholder banner while none of
    the quotes have been replaced with real ones yet.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Testimonial.objects.filter(is_active=True)
        return Response({
            "all_demo": qs.exists() and not qs.filter(is_demo=False).exists(),
            "items": TestimonialSerializer(qs, many=True).data,
        })


class GridListCreateView(APIView):
    def get(self, request):
        return Response(GridBotSerializer(GridBot.objects.filter(user=request.user).order_by("-id"), many=True).data)

    def post(self, request):
        if request.user.is_frozen:
            return Response({"detail": "Account frozen"}, status=403)
        symbol = request.data.get("symbol", "BTCUSDT")
        lower = Decimal(str(request.data.get("lower", "0")))
        upper = Decimal(str(request.data.get("upper", "0")))
        grids = int(request.data.get("grids", 10) or 10)
        investment = Decimal(str(request.data.get("investment", "0")))
        mode = request.data.get("mode", "spot")
        if investment <= 0 or lower <= 0 or upper <= lower or grids < 2:
            return Response({"detail": "Need lower < upper, grids >= 2, investment > 0"}, status=400)
        market = Market.objects.filter(symbol=symbol).first()
        if not market:
            return Response({"detail": "Unknown symbol"}, status=400)
        ensure_wallets(request.user)
        with transaction.atomic():
            w = Wallet.objects.select_for_update().get(user=request.user, asset="USDT")
            if w.available < investment:
                return Response({"detail": "Insufficient USDT"}, status=400)
            w.available -= investment
            w.frozen += investment
            w.save()
            bot = GridBot.objects.create(
                user=request.user, symbol=symbol, mode=mode, lower=lower, upper=upper,
                grids=grids, investment=investment,
            )
            notify(
                request.user,
                title=f"Grid bot started on {symbol}",
                body=f"Your {mode} grid bot is running on {symbol} between {lower} and {upper} across {grids} grids, with {money(investment)} reserved. Stopping the bot returns your investment plus any profit.",
                kind="trade",
            )
        return Response(GridBotSerializer(bot).data, status=201)

class GridStopView(APIView):
    def post(self, request, pk):
        bot = GridBot.objects.filter(pk=pk, user=request.user).first()
        if not bot:
            return Response({"detail": "Not found"}, status=404)
        if bot.status != "running":
            return Response(GridBotSerializer(bot).data)
        with transaction.atomic():
            w = Wallet.objects.select_for_update().get(user=request.user, asset="USDT")
            w.frozen = max(Decimal("0"), w.frozen - bot.investment)
            w.available += bot.investment + bot.profit
            w.save()
            bot.status = "stopped"
            bot.save()
            notify(
                request.user,
                title=f"Grid bot stopped on {bot.symbol}",
                body=f"Your grid bot on {bot.symbol} was stopped. {money(bot.investment + bot.profit)} has been returned to your available balance, including {money(bot.profit)} in profit.",
                kind="trade",
            )
        return Response(GridBotSerializer(bot).data)

class GridFillsView(APIView):
    def get(self, request, pk):
        bot = GridBot.objects.filter(pk=pk, user=request.user).first()
        if not bot:
            return Response({"detail": "Not found"}, status=404)
        return Response(GridFillSerializer(bot.fills.order_by("-id")[:50], many=True).data)

def process_grid_bots():
    """
    Advance running grid bots from the market tick.

    A bot alternates buy/sell per grid level: it buys when price is at or below
    a level, and sells the accumulated base when price returns above it. Fills
    are recorded against the bot's reserved USDT, so the reserved balance is
    always the source of truth for P&L.
    """
    from decimal import Decimal
    from django.db.models import F

    for bot in GridBot.objects.filter(status="running").select_related("user"):
        market = Market.objects.filter(symbol=bot.symbol).first()
        if not market:
            continue
        price = market.price
        if price < bot.lower or price > bot.upper:
            continue
        step = ((bot.upper - bot.lower) / Decimal(bot.grids)).quantize(Decimal("0.00000001"))
        if step <= 0:
            continue

        index = int((price - bot.lower) / step)
        if index < 0 or index >= bot.grids:
            continue
        level = (bot.lower + step * Decimal(index)).quantize(Decimal("0.00000001"))
        last = bot.fills.order_by("-id").first()
        if last and last.level == level and last.side == "buy":
            side = "sell"  # bounce back up through this level
        elif last and last.side == "sell":
            side = "buy"
        else:
            side = "buy"

        notional = (bot.investment / Decimal(bot.grids)).quantize(Decimal("0.00000001"))
        if notional <= 0:
            continue
        qty = (notional / price).quantize(Decimal("0.00000001"))
        if qty <= 0:
            continue
        fee = (notional * Decimal("0.001")).quantize(Decimal("0.00000001"))
        # A buy spends from the reserve; a sell realises the spread earned so far.
        profit = -fee if side == "buy" else (notional - fee) - (notional * Decimal("0.999"))

        GridFill.objects.create(bot=bot, level=level, side=side, qty=qty, profit=profit)
        GridBot.objects.filter(pk=bot.pk).update(profit=F("profit") + profit)
