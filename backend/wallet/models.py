from django.db import models
from django.conf import settings

# Every asset that can be held on the platform. This starts with the core
# listings and is extended from the live market feed so any coin we quote
# against USDT automatically gets a wallet.
BASE_ASSETS = [
    "USDT", "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT",
    "USDC", "TRX", "TON", "SHIB", "LTC", "LINK", "MATIC", "BCH", "NEAR", "ATOM",
]

# Networks a deposit/withdrawal can arrive on, per asset.
NETWORKS = {
    "USDT": ["TRC20", "ERC20", "BEP20", "SOL"],
    "USDC": ["ERC20", "BEP20", "SOL", "TRC20"],
    "BTC": ["BTC"],
    "ETH": ["ERC20"],
    "SOL": ["SOL"],
    "BNB": ["BEP20"],
    "XRP": ["XRP"],
    "TON": ["TON"],
    "TRX": ["TRX"],
    "LTC": ["LTC"],
    "DOGE": ["DOGE"],
    "ADA": ["ADA"],
    "AVAX": ["AVAX", "C"],
    "DOT": ["DOT"],
    "MATIC": ["MATIC"],
    "BCH": ["BCH"],
    "ATOM": ["ATOM"],
    "NEAR": ["NEAR"],
    "LINK": ["ERC20"],
    "SHIB": ["ERC20", "BEP20"],
}


def listed_assets():
    """
    Assets the user may hold: the core list plus every base coin in the live
    market feed (USDT-quoted pairs). Falls back to the core list if the
    trading app is unavailable (e.g. during migrations).
    """
    assets = list(BASE_ASSETS)
    try:
        from trading.models import Market
        live = Market.objects.filter(is_active=True, quote="USDT").values_list("base", flat=True)
        for base in live:
            if base and base not in assets:
                assets.append(base)
    except Exception:  # noqa: BLE001 - never break wallets on a feed/db hiccup
        pass
    return assets


def networks_for(asset):
    """Supported networks for an asset, defaulting to its native chain."""
    if asset in NETWORKS:
        return NETWORKS[asset]
    return [asset]

class Wallet(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallets")
    asset = models.CharField(max_length=16)
    available = models.DecimalField(max_digits=28, decimal_places=8, default=0)
    frozen = models.DecimalField(max_digits=28, decimal_places=8, default=0)

    class Meta:
        unique_together = ("user", "asset")

    @property
    def total(self):
        return self.available + self.frozen

class PlatformDepositAddress(models.Model):
    """Admin-configured address that users send coins to."""
    asset = models.CharField(max_length=16)
    network = models.CharField(max_length=16)
    address = models.CharField(max_length=255)
    memo = models.CharField(max_length=128, blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("asset", "network")

class UserWalletAddress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_addresses")
    label = models.CharField(max_length=64)
    asset = models.CharField(max_length=16)
    network = models.CharField(max_length=16)
    address = models.CharField(max_length=255)
    memo = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class DepositRequest(models.Model):
    STATUS = (("pending", "Pending"), ("credited", "Credited"), ("rejected", "Rejected"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="deposits")
    asset = models.CharField(max_length=16)
    network = models.CharField(max_length=16)
    amount = models.DecimalField(max_digits=28, decimal_places=8)
    txid = models.CharField(max_length=128, blank=True)
    to_address = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=16, default="pending")
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

class WithdrawalRequest(models.Model):
    STATUS = (("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected"), ("sent", "Sent"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="withdrawals")
    asset = models.CharField(max_length=16)
    network = models.CharField(max_length=16)
    amount = models.DecimalField(max_digits=28, decimal_places=8)
    fee = models.DecimalField(max_digits=28, decimal_places=8, default=0)
    address = models.CharField(max_length=255)
    memo = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=16, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

class AdminNotification(models.Model):
    kind = models.CharField(max_length=32)  # deposit, withdraw
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True)
    read = models.BooleanField(default=False)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

def ensure_wallets(user):
    """Create any missing wallet rows for a user across all listed assets."""
    for a in listed_assets():
        Wallet.objects.get_or_create(user=user, asset=a)


def ensure_wallet(user, asset):
    """Return the user's wallet for a single asset, creating it if needed."""
    wallet, _ = Wallet.objects.get_or_create(user=user, asset=asset)
    return wallet
