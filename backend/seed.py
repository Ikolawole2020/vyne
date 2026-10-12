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
if Testimonial.objects.exists():
    # Re-running seed replaces the shipped demo rows rather than skipping, so
    # editing the roster below takes effect on a database that was already
    # seeded. Testimonials added by hand in the admin (is_demo=False) are left
    # untouched.
    stale = Testimonial.objects.filter(is_demo=True).count()
    if stale:
        Testimonial.objects.filter(is_demo=True).delete()
        print(f"Removed {stale} previous demo testimonials")

if Testimonial.objects.filter(is_demo=True).exists() or not Testimonial.objects.exists():
    TESTIMONIALS = [
        ("Sarah M.", "Long-term investor - Austin, USA", "I have moved real money through this platform for over a year now. Deposits land quickly, and every withdrawal I have requested arrived in full with the fee shown up front instead of deducted after the fact.", 5, "withdraw"),
        ("James W.", "Spot trader - London, UK", "What sold me was the withdrawal screen quoting the fee and the arrival amount before I confirmed. No surprise deductions at the end, which is exactly where most exchanges lose you.", 5, "withdraw"),
        ("Elodie M.", "Earn saver - Lyon, France", "I put aside a fixed amount in Earn each month and the accrued interest is visible daily. Being able to see the return build in real time is the part most platforms hide from you.", 5, "earn"),
        ("Daniel R.", "Futures trader - Toronto, Canada", "The liquidation warning fires early enough that I can actually add margin. That single feature has saved me from a bad close more than once, and it is why I keep my account here.", 5, "general"),
        ("Mateo F.", "Convert user - Madrid, Spain", "I convert between a few coins every month. The rate holds long enough to read it properly and the breakdown shows the spread instead of burying it in the total.", 5, "convert"),
        ("Rachel G.", "Copy trading - New York, USA", "I followed one trader for three months before risking anything real. Reading their full history first is what made me comfortable, and unfollowing returned my funds with no lockup.", 5, "general"),
        ("Thomas B.", "P2P merchant - Montreal, Canada", "I run a small P2P desk. The escrow flow means I only release after I have confirmed the transfer cleared, and the few disputes I have had were resolved quickly.", 5, "p2p"),
        ("Charlotte D.", "Mobile investor - Manchester, UK", "The mobile layout is the first one where I never had to pinch and zoom to place an order or check a position. I manage my whole portfolio from my phone now.", 4, "general"),
        ("Lucas S.", "Grid bot user - Berlin, Germany", "I started a neutral grid on BTC and let it run. The fill log shows every leg so I can see precisely where the profit came from, and the bot halts if price leaves my range.", 5, "general"),
        ("Amelia H.", "New investor - Sydney, Australia", "The onboarding spelled out the KYC steps in advance and took one evening. Nothing bounced back for a missing document, which was a relief after my last exchange.", 4, "general"),
        ("Oliver P.", "Saver - Dublin, Ireland", "I wanted somewhere quiet to park funds between trades. The Earn tiers are clearly labelled, so I picked the shortest one on purpose rather than guessing.", 4, "earn"),
        ("Nina V.", "P2P seller - Amsterdam, Netherlands", "I have sold to dozens of buyers. The order chat keeps the payment reference attached, which quietly ends the arguments that used to cost me an hour a week.", 5, "p2p"),
        ("Carlos T.", "Spot trader - Barcelona, Spain", "My withdrawal went out and I watched it confirm on the network from inside the app. That level of transparency about where your funds actually are remains rare.", 5, "withdraw"),
        ("Sophie L.", "Copy trading - Paris, France", "The returns have been steady rather than spectacular, and I appreciate that nothing here oversells it. I can see my profit each day and withdraw it whenever I want.", 5, "general"),
        ("Michael K.", "Long-term holder - Chicago, USA", "Deposit credited in under ten minutes on a Saturday night. I had genuinely written off the weekend as a wait, and instead I was trading within the quarter hour.", 5, "withdraw"),
        ("Hannah S.", "Convert user - Zurich, Switzerland", "Converting USDT to my local currency side has been straightforward. The rate breakdown shows the spread instead of burying it, so I can time my conversions properly.", 4, "convert"),
        ("Marco B.", "Grid bot user - Milan, Italy", "The bot stops itself if the price leaves my range. I much prefer that to an open-ended grid quietly running while I sleep, which is how I lost money elsewhere.", 5, "general"),
        ("Emily C.", "P2P buyer - Vancouver, Canada", "As a buyer I like that funds sit in escrow. I paid, the seller released, and I had a clean record of both steps to fall back on if anything went wrong.", 5, "p2p"),
        ("Julien A.", "Earn user - Brussels, Belgium", "Interest posts on the schedule the page promises. It sounds like a low bar to clear, but the consistency is precisely why I moved the bulk of my balance here.", 4, "earn"),
        ("Grace T.", "Spot trader - Boston, USA", "Two deposits, two withdrawals, and I have not needed to open a single support ticket in either direction. That is honestly all I ever wanted from an exchange.", 5, "withdraw"),
    ]
    for i, (name, role, quote, rating, highlight) in enumerate(TESTIMONIALS):
        Testimonial.objects.create(
            name=name, role=role, quote=quote, rating=rating,
            highlight=highlight, sort=i, is_demo=True,
        )
    print(f"Seeded {len(TESTIMONIALS)} demo testimonials")
print("Seed complete")
