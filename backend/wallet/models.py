from django.db import models
from django.conf import settings
from django.utils import timezone

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
    # Set when an admin deletes the wallet. The row is kept rather than removed
    # because `ensure_wallets` would otherwise recreate it on the next request
    # and the delete would look like a no-op. An archived wallet is hidden from
    # every listing and refuses further edits, but still exists so that a
    # hard foreign-key break can never happen.
    archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="archived_wallets",
    )

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
    """Create any missing wallet rows for a user across all listed assets.

    Assets the admin has deleted are skipped on purpose. This runs on every
    wallet-list load and every admin-console poll, so resurrecting archived
    rows here would undo the delete within seconds.
    """
    archived = set(
        Wallet.objects.filter(user=user, archived=True).values_list("asset", flat=True)
    )
    for a in listed_assets():
        if a in archived:
            continue
        Wallet.objects.get_or_create(user=user, asset=a, defaults={"archived": False})


def ensure_wallet(user, asset):
    """Return the user's wallet for a single asset, creating it if needed.

    Unlike `ensure_wallets`, this un-archives the row. It is only reached from
    paths that are about to move real money (deposit credit, withdrawal, trade
    settlement), where a missing wallet would be worse than reviving one.
    """
    wallet = Wallet.objects.filter(user=user, asset=asset).first()
    if wallet is None:
        wallet = Wallet.objects.create(user=user, asset=asset)
    elif wallet.archived:
        wallet.archived = False
        wallet.archived_at = None
        wallet.archived_by = None
        wallet.save(update_fields=["archived", "archived_at", "archived_by"])
    return wallet


def archive_wallet(wallet, actor):
    """Mark a wallet deleted. Returns None on success or an error message.

    Refuses when the wallet still holds anything, because archiving is not a
    substitute for paying out -- frozen funds may be reserved for an in-flight
    withdrawal or open position, and the row has to survive for settlement.
    """
    if wallet.available != 0:
        return "Wallet still has a spendable balance; withdraw or transfer it first"
    if wallet.frozen != 0:
        return "Wallet has funds reserved for a pending withdrawal or open order"
    wallet.archived = True
    wallet.archived_at = timezone.now()
    wallet.archived_by = actor if getattr(actor, "is_authenticated", False) else None
    wallet.save(update_fields=["archived", "archived_at", "archived_by"])
    return None


def restore_wallet(wallet):
    """Undo an archive so the wallet is listed and usable again."""
    if not wallet.archived:
        return "Wallet is not deleted"
    wallet.archived = False
    wallet.archived_at = None
    wallet.archived_by = None
    wallet.save(update_fields=["archived", "archived_at", "archived_by"])
    return None
