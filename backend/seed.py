import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from decimal import Decimal
from django.contrib.auth import get_user_model
from trading.models import Market
from wallet.models import PlatformDepositAddress, ensure_wallets, Wallet
from products.models import EarnProduct, CopyTrader, P2PAd, Announcement

User = get_user_model()
if not User.objects.filter(username="admin").exists():
    admin = User.objects.create_superuser("admin", "admin@vyne.exchange", "admin1234", is_staff=True)
    print("Created admin / admin1234")
else:
    admin = User.objects.get(username="admin")
ensure_wallets(admin)

if not User.objects.filter(username="demo").exists():
    demo = User.objects.create_user("demo", "demo@vyne.exchange", "demo1234")
    ensure_wallets(demo)
    Wallet.objects.filter(user=demo, asset="USDT").update(available=Decimal("10000"))
    Wallet.objects.filter(user=demo, asset="BTC").update(available=Decimal("0.15"))
    print("Created demo / demo1234")
else:
    demo = User.objects.get(username="demo")
    ensure_wallets(demo)

markets = []
try:
    from trading.marketfeed import refresh_markets
    updated = refresh_markets(force=True)
    print(f"Synced {updated} live markets from the price feed")
except Exception as exc:
    print(f"Market feed unavailable ({exc}); keeping existing markets")

addrs = [
    ("USDT","TRC20","TVyneDemoAdminUsdtTrc20Address111111",""),
    ("USDT","ERC20","0xVYNE000000000000000000000000ADMIN01",""),
    ("USDT","BEP20","0xVYNE000000000000000000000000ADMIN02",""),
    ("BTC","BTC","bc1qvyneadminbtcaddressdemo000000000",""),
    ("ETH","ERC20","0xVYNE000000000000000000000000ETHADMIN",""),
    ("SOL","SOL","VyneSoLAdminAddress111111111111111111",""),
]
for a,n,addr,m in addrs:
    PlatformDepositAddress.objects.update_or_create(asset=a, network=n, defaults={"address": addr, "memo": m, "is_active": True})

for asset, name, apy, days in [
    ("USDT", "USDT Flexible", "8.50", 0),
    ("USDT", "USDT 30D Locked", "12.00", 30),
    ("BTC", "BTC Flexible", "3.20", 0),
    ("ETH", "ETH Flexible", "4.10", 0),
    ("SOL", "SOL Flexible", "6.80", 0),
]:
    EarnProduct.objects.update_or_create(name=name, defaults=dict(asset=asset, apy=apy, lock_days=days, min_amount="1"))

if not CopyTrader.objects.exists():
    t1 = User.objects.filter(username="demo").first() or admin
    CopyTrader.objects.create(user=t1, display="AlphaWhale", roi_30d="42.50", followers=1280, aum="2400000", bio="BTC trend follower")
    u2 = User.objects.filter(username="admin").first()
    CopyTrader.objects.create(user=u2, display="GridBot Pro", roi_30d="18.20", followers=540, aum="810000", bio="Neutral grid on majors")

if not P2PAd.objects.exists():
    P2PAd.objects.create(user=admin, side="sell", asset="USDT", fiat="NGN", price="1640", available="50000", min_limit="10000", max_limit="5000000", method="Bank Transfer")
    P2PAd.objects.create(user=admin, side="buy", asset="USDT", fiat="NGN", price="1610", available="20000", min_limit="5000", max_limit="2000000", method="Opay / Palmpay")

if not Announcement.objects.exists():
    Announcement.objects.create(title="Welcome to Vyne", body="Deposit crypto using the address shown on the deposit page, then submit your transaction ID. Your request is credited once the transfer is confirmed.", tag="system")
    Announcement.objects.create(title="New listings: DOGE, ADA, AVAX, DOT", body="Spot and futures pairs are now available.", tag="listing")
print("Seed complete")
