# Vyne — crypto exchange

A full crypto trading platform: spot and futures trading on live market data,
wallets, deposits, withdrawals, earn, convert, P2P, copy trading and grid bots.

**Backend:** Django + Django REST Framework
**Frontend:** Next.js 14 (App Router)

Market prices, logos, market caps and 7-day history are fetched live from the
CoinGecko public API — no API key required.

## Quick start

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py sync_markets      # pull live markets
python seed.py                     # demo users, deposit wallets, earn products
python manage.py runserver 0.0.0.0:8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

- API: http://127.0.0.1:8000
- App: http://localhost:3000

> `python seed.py` creates `admin` / `admin1234` and `demo` / `demo1234` for local
> development. **Change or remove these before deploying anywhere public.**

## Environment variables

All configuration is read from the environment. Defaults are development-only.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | dev fallback | **Set this in production** |
| `DJANGO_DEBUG` | `1` | Set `0` in production |
| `DJANGO_ALLOWED_HOSTS` | `*` | Comma-separated hostnames |
| `CORS_ALLOWED_ORIGINS` | empty | Comma-separated frontend origins |
| `DB_ENGINE` | `sqlite` | Set `postgres` in production |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | — | Postgres connection |
| `JWT_ACCESS_MINUTES` | `60` | Access token lifetime |
| `JWT_REFRESH_DAYS` | `7` | Refresh token lifetime |
| `THROTTLE_ANON` | `120/hour` | Anonymous API rate limit |
| `THROTTLE_USER` | `600/hour` | Authenticated API rate limit |
| `THROTTLE_LOGIN` | `10/minute` | Login attempt limit |

### Use PostgreSQL in production

The settlement code relies on `select_for_update()` row locking, which SQLite
does **not** enforce. SQLite is fine for development; use Postgres for real
concurrent traffic.

## Market data

```bash
python manage.py sync_markets             # refresh (uses cache)
python manage.py sync_markets --force     # bypass cache
python manage.py sync_markets --list      # show stored markets
```

Responses are cached for 90 seconds on disk. If the upstream API is unreachable
the app keeps serving the last good data rather than failing.

Endpoints:
- `GET /api/trading/markets/` — all listed markets
- `GET /api/trading/orderbook/?symbol=BTCUSDT` — aggregated bids/asks
- `GET /api/trading/feed-status/` — cache age and staleness
- `POST /api/trading/tick/` — refresh prices, run liquidations and grid bots

## Product surface

**Trading**
- Spot market and limit orders with fund reservation
- Price-time priority matching engine between users
- Order cancellation with exact reservation release
- USDT perpetuals: isolated margin, 1–100x, liquidation, live P&L and ROE
- Order book, open orders and trade history

**Wallets**
- Multi-coin wallets auto-provisioned from the live market feed
- Deposit addresses per asset/network, configurable by admin
- Deposit tickets → admin verification → credit
- Withdrawals require KYC; funds frozen until admin approves or rejects
- Address book

**Products**
- Earn — flexible and locked products with real time-based accrual
- Convert, P2P ads with escrow, copy trading, grid bots

**Accounts & admin**
- JWT auth with refresh, brute-force lockout, rate limiting
- KYC submission and admin verification
- Referrals, announcements, user inbox
- Admin: balances, freeze/unfreeze, edit accounts, delete, deposit/withdrawal queues

## Tests

```bash
cd backend && python manage.py test
```

41 tests covering settlement, fees, order matching, cancellation, deposits,
withdrawals, futures margin and liquidation, and authentication security.

## Notes

Cryptocurrency trading carries substantial risk. This platform is provided for
educational and development purposes.

