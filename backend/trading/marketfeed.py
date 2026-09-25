"""
Live market data feed.

Prices come from the CoinGecko public API (no API key required). Results are
cached on disk so the app still works when the upstream API is unreachable or
rate limited. If a refresh fails we keep serving the last good data rather than
inventing prices.
"""
import json
import logging
import os
import threading
import time
from decimal import Decimal, InvalidOperation

import requests
from django.db import transaction

from .coinmap import COIN_MAP, SKIP_BASES, SKIP_DERIVATIVES
from .models import Market

log = logging.getLogger(__name__)

COINGECKO_URL = "https://api.coingecko.com/api/v3/coins/markets"
CACHE_PATH = os.path.join(os.path.dirname(__file__), "_market_cache.json")
CACHE_TTL = 90
HTTP_TIMEOUT = 12
QUOTE = "USDT"

_lock = threading.Lock()


def _read_cache():
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def _write_cache(payload):
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)
    except OSError as exc:
        log.warning("Could not write market cache: %s", exc)


def _dec(value, default="0"):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _fetch_remote(ids):
    resp = requests.get(
        COINGECKO_URL,
        params={
            "vs_currency": "usd",
            "ids": ",".join(ids),
            "order": "market_cap_desc",
            "per_page": len(ids),
            "page": 1,
            "sparkline": "true",
            "price_change_percentage": "24h",
        },
        timeout=HTTP_TIMEOUT,
        headers={"User-Agent": "VyneExchange/1.0", "Accept": "application/json"},
    )
    resp.raise_for_status()
    data = resp.json()
    if not isinstance(data, list):
        raise ValueError("Unexpected payload from market feed")
    return data


def _persist(rows):
    by_symbol = {}
    for item in rows:
        base = (item.get("symbol") or "").upper()
        if not base or base in SKIP_BASES or base in SKIP_DERIVATIVES:
            continue
        by_symbol.setdefault(base, item)

    updated = 0
    skipped = []
    live = set()
    with transaction.atomic():
        for base, item in by_symbol.items():
            price = _dec(item.get("current_price"))
            cap = _dec(item.get("market_cap"))
            rank = int(item.get("market_cap_rank") or 0)
            # Drop delisted/renamed upstream entries that carry no real data.
            if price <= 0 or cap <= 0 or rank <= 0:
                skipped.append(base)
                continue
            spark = []
            raw = (item.get("sparkline_in_7d") or {}).get("price") or []
            if raw:
                step = max(1, len(raw) // 30)
                spark = [round(float(v), 8) for v in raw[::step][-30:]]
            Market.objects.update_or_create(
                symbol=f"{base}{QUOTE}",
                defaults={
                    "base": base,
                    "quote": QUOTE,
                    "name": (item.get("name") or base)[:64],
                    "logo_url": (item.get("image") or "")[:500],
                    "market_cap": cap,
                    "market_cap_rank": rank,
                    "price": price,
                    "change_24h": _dec(item.get("price_change_percentage_24h")),
                    "volume_24h": _dec(item.get("total_volume")),
                    "high_24h": _dec(item.get("high_24h")),
                    "low_24h": _dec(item.get("low_24h")),
                    "sparkline": spark,
                    "is_active": True,
                },
            )
            updated += 1
            live.add(f"{base}{QUOTE}")
        # Deactivate anything we no longer have live data for.
        Market.objects.filter(is_active=True).exclude(symbol__in=live).update(is_active=False)
    if skipped:
        log.info("Skipped delisted assets: %s", ", ".join(skipped))
    return updated


def refresh_markets(force=False):
    """Refresh market rows from the live feed. Self-throttles via disk cache."""
    with _lock:
        cache = _read_cache()
        now = time.time()
        if not force and cache and (now - cache.get("_fetched_at", 0)) < CACHE_TTL:
            return 0

        try:
            rows = _fetch_remote(list(COIN_MAP.keys()))
            _write_cache({"_fetched_at": now, "rows": rows})
        except Exception as exc:  # noqa: BLE001 - never break trading on feed failure
            log.warning("Live market feed unavailable, using cached data: %s", exc)
            if not cache.get("rows"):
                return 0
            rows = cache["rows"]
        return _persist(rows)


def feed_status():
    cache = _read_cache()
    age = time.time() - cache.get("_fetched_at", 0)
    return {
        "cached_rows": len(cache.get("rows") or []),
        "age_seconds": round(age),
        "stale": age > CACHE_TTL * 10,
    }
