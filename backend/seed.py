import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from decimal import Decimal
from django.contrib.auth import get_user_model
from trading.models import Market
from wallet.models import PlatformDepositAddress, ensure_wallets, Wallet
from products.models import EarnProduct, CopyTrader, P2PAd, Announcement, Testimonial

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
    P2PAd.objects.create(user=admin, side="sell", asset="USDT", fiat="USD", price="1.00", available="50000", min_limit="20", max_limit="10000", method="Bank Transfer")
    P2PAd.objects.create(user=admin, side="buy", asset="USDT", fiat="USD", price="0.99", available="20000", min_limit="20", max_limit="5000", method="Bank Transfer")

if not Announcement.objects.exists():
    Announcement.objects.create(title="Welcome to Vyne", body="Deposit crypto using the address shown on the deposit page, then submit your transaction ID. Your request is credited once the transfer is confirmed.", tag="system")
    Announcement.objects.create(title="New listings: DOGE, ADA, AVAX, DOT", body="Spot and futures pairs are now available.", tag="listing")

# Sample quotes for /testimonials. Every row is is_demo=True, which makes the
# page render a visible placeholder banner -- replace them with real, consented
# quotes (set is_demo=False) before treating this page as live marketing.
if not Testimonial.objects.exists():
    TESTIMONIALS = [
        ("Adaobi N.", "Spot trader - Lagos", "I sent USDT over, pasted the txid, and the deposit showed up before I finished making tea. The estimate on the screen matched what landed in the wallet.", 5, "withdraw"),
        ("Marcus D.", "Long-term holder - Berlin", "What sold me was the withdrawal screen telling me the fee and the arrival amount before I confirmed. No surprise deductions at the end.", 5, "withdraw"),
        ("Priya R.", "Convert user - Mumbai", "I use the convert tab to move between a few coins every month. The rate holds long enough to read it, and the history lines up with my bank records.", 5, "convert"),
        ("Tunde A.", "P2P merchant - Ibadan", "I run a small P2P desk. The escrow flow means I release only after I have confirmed the transfer, and disputes have been handled quickly.", 5, "p2p"),
        ("Sofia M.", "Earn saver - Lisbon", "I put aside a fixed amount in Earn each month. The accrued interest is visible daily, which is the part most apps hide from you.", 4, "earn"),
        ("Jonas K.", "Futures trader - Tallinn", "The liquidation warning fires early enough that I can actually add margin. That one feature saved me from a bad close twice.", 5, "general"),
        ("Wei L.", "Grid bot user - Singapore", "I started a neutral grid on BTC and just let it run. The fill log shows every leg, so I can see exactly where the profit came from.", 5, "general"),
        ("Fatima Z.", "Copy trading - Cairo", "I followed one trader for three months before risking anything real. Being able to read their history first is what made me comfortable.", 4, "general"),
        ("Diego S.", "Spot trader - Buenos Aires", "Deposit credited in under ten minutes on a Saturday night. I had honestly written off the weekend as a wait.", 5, "withdraw"),
        ("Hannah B.", "Mobile user - Manchester", "The mobile layout is the first one where I did not have to pinch and zoom to place an order.", 4, "general"),
        ("Kofi M.", "Convert user - Accra", "Converting USDT to my local currency side has been straightforward. The rate breakdown shows the spread instead of burying it.", 4, "convert"),
        ("Yuki T.", "Saver - Osaka", "I wanted somewhere boring to park funds between trades. The Earn tiers are clearly labelled, so I picked the shortest one deliberately.", 4, "earn"),
        ("Omar H.", "P2P seller - Dubai", "I have sold to dozens of buyers. The order chat keeps the payment reference attached, which stops the usual arguments.", 5, "p2p"),
        ("Elena V.", "Spot trader - Warsaw", "Withdrawal went out and I could watch it confirm on the network from inside the app. That transparency is rare.", 5, "withdraw"),
        ("Samuel O.", "New user - Nairobi", "The KYC steps were spelled out in advance and took one evening. Nothing bounced back for a missing document.", 4, "general"),
        ("Laura C.", "Copy trading - Santiago", "I unfollowed a trader who was taking positions I did not understand, and the funds came straight back without a lockup.", 5, "general"),
        ("Rahul P.", "Grid bot user - Pune", "The bot stops itself if the price leaves my range. I prefer that to an open-ended grid running while I sleep.", 5, "general"),
        ("Chidi E.", "P2P buyer - Enugu", "As a buyer I like that funds sit in escrow. I paid, the seller released, and I had a record of both steps.", 5, "p2p"),
        ("Nadia S.", "Earn user - Casablanca", "Interest posts on the schedule the page promises. It sounds like a low bar, but it is the reason I stayed.", 4, "earn"),
        ("Tom W.", "Spot trader - Auckland", "Two deposits, two withdrawals, no support ticket needed in either direction. That is all I actually wanted.", 5, "withdraw"),
    ]
    for i, (name, role, quote, rating, highlight) in enumerate(TESTIMONIALS):
        Testimonial.objects.create(
            name=name, role=role, quote=quote, rating=rating,
            highlight=highlight, sort=i, is_demo=True,
        )
    print(f"Seeded {len(TESTIMONIALS)} demo testimonials")
print("Seed complete")
