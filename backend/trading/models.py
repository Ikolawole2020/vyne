from decimal import Decimal

from django.db import models
from django.conf import settings

class Market(models.Model):
    symbol = models.CharField(max_length=24, unique=True)
    base = models.CharField(max_length=16)
    quote = models.CharField(max_length=16)
    name = models.CharField(max_length=64, blank=True)
    logo_url = models.CharField(max_length=500, blank=True)
    market_cap = models.DecimalField(max_digits=36, decimal_places=2, default=0)
    market_cap_rank = models.IntegerField(default=0)
    price = models.DecimalField(max_digits=36, decimal_places=12)
    change_24h = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    volume_24h = models.DecimalField(max_digits=36, decimal_places=2, default=0)
    high_24h = models.DecimalField(max_digits=36, decimal_places=12, default=0)
    low_24h = models.DecimalField(max_digits=36, decimal_places=12, default=0)
    sparkline = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

class Order(models.Model):
    SIDE = (("buy", "Buy"), ("sell", "Sell"))
    TYPE = (("market", "Market"), ("limit", "Limit"))
    STATUS = (("open", "Open"), ("filled", "Filled"), ("cancelled", "Cancelled"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders")
    symbol = models.CharField(max_length=24)
    side = models.CharField(max_length=8, choices=SIDE)
    order_type = models.CharField(max_length=8, choices=TYPE, default="market")
    price = models.DecimalField(max_digits=28, decimal_places=8, default=0)
    quantity = models.DecimalField(max_digits=28, decimal_places=8)
    filled_qty = models.DecimalField(max_digits=28, decimal_places=8, default=0)
    reserved_amount = models.DecimalField(max_digits=28, decimal_places=8, default=0)
    status = models.CharField(default="open", max_length=16)
    created_at = models.DateTimeField(auto_now_add=True)

class Trade(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trades")
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="trades")
    symbol = models.CharField(max_length=24)
    side = models.CharField(max_length=8)
    price = models.DecimalField(max_digits=28, decimal_places=8)
    quantity = models.DecimalField(max_digits=28, decimal_places=8)
    fee = models.DecimalField(max_digits=28, decimal_places=8, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

class Position(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="positions")
    symbol = models.CharField(max_length=24)
    side = models.CharField(max_length=8)  # long / short
    leverage = models.IntegerField(default=10)
    qty = models.DecimalField(max_digits=36, decimal_places=12)
    entry = models.DecimalField(max_digits=36, decimal_places=12)
    margin = models.DecimalField(max_digits=36, decimal_places=12)
    liq_price = models.DecimalField(max_digits=36, decimal_places=12, default=0)
    unrealized = models.DecimalField(max_digits=36, decimal_places=12, default=0)
    roe = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    status = models.CharField(max_length=16, default="open")
    created_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    close_price = models.DecimalField(max_digits=36, decimal_places=12, default=0)
    realized = models.DecimalField(max_digits=36, decimal_places=12, default=0)
    liquidated = models.BooleanField(default=False)

    def unrealized_pnl(self, mark_price):
        if self.status != "open" or not mark_price:
            return Decimal("0")
        if self.side == "long":
            return ((mark_price - self.entry) * self.qty).quantize(Decimal("0.00000001"))
        return ((self.entry - mark_price) * self.qty).quantize(Decimal("0.00000001"))

    def return_on_equity(self, mark_price):
        """Unrealised P&L as a percentage of the posted margin."""
        if not self.margin:
            return Decimal("0")
        return ((self.unrealized_pnl(mark_price) / self.margin) * Decimal("100")).quantize(Decimal("0.01"))

    def is_liquidatable(self, mark_price):
        if self.status != "open" or not self.liq_price or not mark_price:
            return False
        if self.side == "long":
            return mark_price <= self.liq_price
        return mark_price >= self.liq_price
