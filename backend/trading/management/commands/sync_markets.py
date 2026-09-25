"""Populate and refresh markets from the live price feed."""
from django.core.management.base import BaseCommand

from trading.marketfeed import feed_status, refresh_markets
from trading.models import Market


class Command(BaseCommand):
    help = "Fetch live market data and upsert markets (default: top coins)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Bypass the cache and refetch.")
        parser.add_argument("--list", action="store_true", help="List stored markets and exit.")

    def handle(self, *args, **options):
        if options["list"]:
            for m in Market.objects.filter(is_active=True).order_by("market_cap_rank", "symbol"):
                self.stdout.write(f"{m.symbol:<12} {m.name[:24]:<24} {m.price}")
            self.stdout.write(f"\nTotal markets: {Market.objects.filter(is_active=True).count()}")
            return

        updated = refresh_markets(force=options["force"])
        status = feed_status()
        self.stdout.write(self.style.SUCCESS(f"Updated {updated} markets from the live feed."))
        self.stdout.write(f"Cache: {status['cached_rows']} rows, {status['age_seconds']}s old, stale={status['stale']}")
