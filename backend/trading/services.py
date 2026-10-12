"""Spot order matching engine (price-time priority)."""
from decimal import Decimal, ROUND_DOWN
from django.db import transaction
from wallet.models import Wallet, ensure_wallet
from .models import Order, Trade

Q = Decimal("0.00000001")
FEE_RATE = Decimal("0.001")
ZERO = Decimal("0")


class InsufficientReserved(Exception):
    pass


def _q(value):
    return Decimal(value).quantize(Q, rounding=ROUND_DOWN)


def _lock(user, asset):
    ensure_wallet(user, asset)
    return Wallet.objects.select_for_update().get(user=user, asset=asset)


def _fee(notional):
    return _q(notional * FEE_RATE)


def _consume(order, qty, exec_price):
    """Return (quote_needed, base_needed) consumed from this order's reservation."""
    if order.side == "buy":
        quote_needed = _q(exec_price * qty) + _fee(exec_price * qty)
        order.reserved_amount -= quote_needed
        return quote_needed, Decimal("0")
    order.reserved_amount -= qty
    return Decimal("0"), qty


@transaction.atomic
def match_order(taker_order, market):
    """
    Match a taker limit order against resting limit orders on the same symbol.
    Settles both traders' reserved balances, records trades, and returns the
    total filled quantity.
    """
    from accounts.models import notify, money

    taker = taker_order.user
    base_asset, quote_asset = market.base, market.quote
    side = taker_order.side
    opposite = "sell" if side == "buy" else "buy"
    total_filled = ZERO
    # (user, verb, qty, exec_price) per fill so both sides get alerts below.
    fills = []

    candidates = (
        Order.objects.select_for_update()
        .select_related("user")
        .filter(symbol=taker_order.symbol, side=opposite, order_type="limit", status="open")
        .exclude(user=taker)
        .order_by("price", "id")
    )

    for maker in candidates:
        if taker_order.filled_qty >= taker_order.quantity:
            break
        if side == "buy" and maker.price > taker_order.price:
            break
        if side == "sell" and maker.price < taker_order.price:
            break

        maker_remaining = maker.quantity - maker.filled_qty
        if maker_remaining <= ZERO:
            continue
        qty = min(taker_order.quantity - taker_order.filled_qty, maker_remaining)
        if qty <= ZERO:
            continue

        exec_price = maker.price
        notional = _q(exec_price * qty)
        if notional <= ZERO:
            continue

        taker_fee = _fee(notional)
        maker_fee = _fee(notional)

        taker_quote = _lock(taker, quote_asset) if side == "buy" else None
        taker_base = _lock(taker, base_asset) if side == "sell" else None
        maker_base = _lock(maker.user, base_asset) if opposite == "sell" else None
        maker_quote = _lock(maker.user, quote_asset) if opposite == "buy" else None
        taker_recv = _lock(taker, base_asset) if side == "buy" else _lock(taker, quote_asset)
        maker_recv = _lock(maker.user, quote_asset) if opposite == "sell" else _lock(maker.user, base_asset)

        if side == "buy":
            cost = notional + taker_fee
            if taker_quote.frozen < cost:
                raise InsufficientReserved("taker buy reservation too small")
            if maker_base.frozen < qty:
                raise InsufficientReserved("maker base reservation too small")
            taker_quote.frozen -= cost
            maker_base.frozen -= qty
            maker_recv.available += notional - maker_fee
            taker_recv.available += qty
        else:
            proceeds = notional - taker_fee
            cost_maker = notional + maker_fee
            if taker_base.frozen < qty:
                raise InsufficientReserved("taker base reservation too small")
            if maker_quote.frozen < cost_maker:
                raise InsufficientReserved("maker quote reservation too small")
            taker_base.frozen -= qty
            maker_quote.frozen -= cost_maker
            taker_recv.available += proceeds
            maker_recv.available += qty

        for w in {taker_quote, taker_base, maker_base, maker_quote, taker_recv, maker_recv}:
            if w is not None:
                w.save()

        _consume(maker, qty, exec_price)
        maker.filled_qty += qty
        maker.status = "filled" if maker.filled_qty >= maker.quantity else "open"
        maker.save(update_fields=["filled_qty", "status", "reserved_amount"])

        _consume(taker_order, qty, exec_price)
        taker_order.filled_qty += qty
        total_filled += qty

        Trade.objects.create(
            user=taker, order=taker_order, symbol=taker_order.symbol,
            side=side, price=exec_price, quantity=qty, fee=taker_fee,
        )
        Trade.objects.create(
            user=maker.user, order=maker, symbol=taker_order.symbol,
            side=opposite, price=exec_price, quantity=qty, fee=maker_fee,
        )
        fills.append((taker, "Bought" if side == "buy" else "Sold", qty, exec_price))
        fills.append((maker.user, "Sold" if side == "buy" else "Bought", qty, exec_price))

    taker_order.status = "filled" if taker_order.filled_qty >= taker_order.quantity else "open"
    taker_order.save(update_fields=["filled_qty", "status", "reserved_amount"])
    for fill_user, verb, qty, exec_price in fills:
        base_bal = Wallet.objects.get(user=fill_user, asset=base_asset).available
        quote_bal = Wallet.objects.get(user=fill_user, asset=quote_asset).available
        notify(
            fill_user,
            title=f"{verb} {money(qty, base_asset)} on {taker_order.symbol}",
            body=f"Your limit order filled {money(qty, base_asset)} at {money(exec_price, quote_asset)}. Available {base_asset} balance {money(base_bal, base_asset)}, available USDT balance {money(quote_bal, 'USDT')}.",
            kind="trade",
        )
    return total_filled
