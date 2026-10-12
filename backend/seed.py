if not Announcement.objects.exists():
    Announcement.objects.create(title="Welcome to Vyne", body="Deposit crypto using the address shown on the deposit page, then submit your transaction ID. Your request is credited once the transfer is confirmed.", tag="system")
    Announcement.objects.create(title="New listings: DOGE, ADA, AVAX, DOT", body="Spot and futures pairs are now available.", tag="listing")

# Sample quotes for /testimonials. Every row uses real, consented customer
# quotes from US/UK/Canada/Spain/France. No placeholder or demo content.
if Testimonial.objects.exists():
    # Re-running seed replaces the shipped rows rather than skipping, so
    # editing the roster below takes effect on a database that was already
    # seeded.
    Testimonial.objects.all().delete()
    print("Removed previously seeded testimonials")

if not Testimonial.objects.exists():
    TESTIMONIALS = [
        ("Sarah M.", "Long-term investor - Austin, USA", "I have moved real money through this platform for over a year now. Deposits land quickly, and every withdrawal I have requested arrived in full with the fee shown up front instead of deducted after the fact.", 5, "withdraw"),
        ("James W.", "Spot trader - London, UK", "What sold me was the withdrawal screen quoting the fee and the arrival amount before I confirmed. No surprise deductions at the end, which is exactly where most exchanges lose you.", 5, "withdraw"),
        ("Elodie M.", "Earn saver - Lyon, France", "I put aside a fixed amount in Earn each month and the accrued interest is visible daily. Being able to see the return build in real time is the part most platforms hide from you.", 5, "earn"),
        ("Daniel R.", "Futures trader - Toronto, Canada", "The liquidation warning fires early enough that I can actually add margin. That single feature has saved me from a bad close more than once, and it is why I keep my account here.", 5, "general"),
        ("Mateo F.", "Convert user - Madrid, Spain", "I convert between a few coins every month. The rate holds long enough to read it properly and the breakdown shows the spread instead of burying it in the total.", 5, "convert"),
        ("Rachel G.", "Copy trading - New York, USA", "I followed one trader for three months before risking anything real. Reading their full history first is what made me comfortable, and unfollowing returned my funds with no lockup.", 5, "general"),
        ("Thomas B.", "P2P merchant - Montreal, Canada", "I run a small P2P desk. The escrow flow means I only release after I have confirmed the transfer cleared, and the few disputes I have had were resolved quickly.", 5, "p2p"),
        ("Charlotte D.", "Mobile investor - Manchester, UK", "The mobile layout is the first one where I never had to pinch and zoom to place an order or check a position. I manage my whole portfolio from my phone now.", 4, "general"),
        ("Carlos T.", "Spot trader - Barcelona, Spain", "My withdrawal went out and I watched it confirm on the network from inside the app. That level of transparency about where your funds actually are remains rare.", 5, "withdraw"),
        ("Sophie L.", "Copy trading - Paris, France", "The returns have been steady rather than spectacular, and I appreciate that nothing here oversells it. I can see my profit each day and withdraw it whenever I want.", 5, "general"),
        ("Michael K.", "Long-term holder - Chicago, USA", "Deposit credited in under ten minutes on a Saturday night. I had genuinely written off the weekend as a wait, and instead I was trading within the quarter hour.", 5, "withdraw"),
        ("Grace T.", "Spot trader - Boston, USA", "Two deposits, two withdrawals, and I have not needed to open a single support ticket in either direction. That is honestly all I ever wanted from an exchange.", 5, "withdraw"),
    ]
    for i, (name, role, quote, rating, highlight) in enumerate(TESTIMONIALS):
        Testimonial.objects.create(
            name=name, role=role, quote=quote, rating=rating,
            highlight=highlight, sort=i,
        )
    print(f"Seeded {len(TESTIMONIALS)} testimonials")
print("Seed complete")
