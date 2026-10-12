from django.db import models
from django.conf import settings

class EarnProduct(models.Model):
    asset = models.CharField(max_length=16)
    name = models.CharField(max_length=64)
    apy = models.DecimalField(max_digits=8, decimal_places=2)
    lock_days = models.IntegerField(default=0)
    min_amount = models.DecimalField(max_digits=28, decimal_places=8, default=1)
    is_active = models.BooleanField(default=True)

class EarnPosition(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="earn")
    product = models.ForeignKey(EarnProduct, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=28, decimal_places=8)
    accrued = models.DecimalField(max_digits=28, decimal_places=8, default=0)
    last_accrued_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    status = models.CharField(max_length=16, default="active")
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def unlock_at(self):
        from django.utils import timezone
        from datetime import timedelta
        if not self.product.lock_days:
            return self.created_at
        return self.created_at + timedelta(days=self.product.lock_days)

    @property
    def is_unlocked(self):
        from django.utils import timezone
        return timezone.now() >= self.unlock_at

    def pending_interest(self):
        """Interest earned since the last accrual, based on elapsed time."""
        from django.utils import timezone
        from decimal import Decimal
        if self.status != "active" or not self.last_accrued_at:
            return Decimal("0")
        seconds = (timezone.now() - self.last_accrued_at).total_seconds()
        if seconds <= 0:
            return Decimal("0")
        days = Decimal(str(seconds)) / Decimal("86400")
        return (self.amount * self.product.apy / Decimal("100") * days).quantize(Decimal("0.00000001"))

    def accrue(self):
        """Fold pending interest into the accrued total."""
        from decimal import Decimal
        from django.utils import timezone
        interest = self.pending_interest()
        if interest > 0:
            self.accrued += interest
        self.last_accrued_at = timezone.now()
        return interest

class ConvertTrade(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="converts")
    from_asset = models.CharField(max_length=16)
    to_asset = models.CharField(max_length=16)
    from_amount = models.DecimalField(max_digits=28, decimal_places=8)
    to_amount = models.DecimalField(max_digits=28, decimal_places=8)
    rate = models.DecimalField(max_digits=28, decimal_places=8)
    created_at = models.DateTimeField(auto_now_add=True)

class CopyTrader(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="copy_profile")
    display = models.CharField(max_length=64)
    roi_30d = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    followers = models.IntegerField(default=0)
    aum = models.DecimalField(max_digits=28, decimal_places=2, default=0)
    bio = models.CharField(max_length=255, blank=True)

class CopyFollow(models.Model):
    follower = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="copy_follows")
    trader = models.ForeignKey(CopyTrader, on_delete=models.CASCADE, related_name="follows")
    allocated = models.DecimalField(max_digits=28, decimal_places=8, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ("follower", "trader")

class P2PAd(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="p2p_ads")
    side = models.CharField(max_length=8)  # buy / sell (merchant side)
    asset = models.CharField(max_length=16, default="USDT")
    fiat = models.CharField(max_length=8, default="USD")
    price = models.DecimalField(max_digits=28, decimal_places=2)
    available = models.DecimalField(max_digits=28, decimal_places=8)
    min_limit = models.DecimalField(max_digits=28, decimal_places=2)
    max_limit = models.DecimalField(max_digits=28, decimal_places=2)
    method = models.CharField(max_length=64, default="Bank Transfer")
    is_active = models.BooleanField(default=True)

class P2POrder(models.Model):
    ad = models.ForeignKey(P2PAd, on_delete=models.CASCADE)
    taker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="p2p_orders")
    amount_asset = models.DecimalField(max_digits=28, decimal_places=8)
    amount_fiat = models.DecimalField(max_digits=28, decimal_places=2)
    status = models.CharField(max_length=16, default="pending")  # pending, paid, released, cancelled
    created_at = models.DateTimeField(auto_now_add=True)

class Testimonial(models.Model):
    """A customer quote shown on /testimonials."""

    name = models.CharField(max_length=80)
    role = models.CharField(max_length=80, blank=True)  # e.g. "Spot trader - London"
    quote = models.TextField()
    rating = models.PositiveSmallIntegerField(default=5)  # 1-5
    highlight = models.CharField(max_length=32, default="general")  # spot|earn|p2p|withdraw|convert
    is_active = models.BooleanField(default=True)
    sort = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort", "-id"]


class Announcement(models.Model):
    title = models.CharField(max_length=255)
    body = models.TextField()
    tag = models.CharField(max_length=32, default="general")
    created_at = models.DateTimeField(auto_now_add=True)

class GridBot(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="grid_bots")
    symbol = models.CharField(max_length=24)
    mode = models.CharField(max_length=16, default="spot")  # spot | futures
    lower = models.DecimalField(max_digits=28, decimal_places=8)
    upper = models.DecimalField(max_digits=28, decimal_places=8)
    grids = models.IntegerField(default=10)
    investment = models.DecimalField(max_digits=28, decimal_places=8)
    profit = models.DecimalField(max_digits=28, decimal_places=8, default=0)
    status = models.CharField(max_length=16, default="running")  # running, stopped
    created_at = models.DateTimeField(auto_now_add=True)

class GridFill(models.Model):
    bot = models.ForeignKey(GridBot, on_delete=models.CASCADE, related_name="fills")
    level = models.DecimalField(max_digits=28, decimal_places=8)
    side = models.CharField(max_length=8)
    qty = models.DecimalField(max_digits=28, decimal_places=8)
    profit = models.DecimalField(max_digits=28, decimal_places=8, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
