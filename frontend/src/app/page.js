"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "../components/Nav";
import { api, fetchTick, getUser } from "../lib/api";
import { Features, Stats, Steps, Movers } from "./landing-sections";
import { Faq, CtaBand, Footer } from "./landing-faq-footer";

function fmt(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  if (v !== 0 && Math.abs(v) < 0.01) return v.toLocaleString(undefined, { maximumFractionDigits: 8 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Pegged coins price 1:1 with the quote currency, so they never appear in the
// market feed as a base coin against themselves. (Same map as the Assets page.)
const STABLE = { USDT: 1, USDC: 1, FDUSD: 1, TUSD: 1, BUSD: 1, DAI: 1 };

function CoinLogo({ m, size = 24 }) {
  if (m.logo_url) {
    return (
      <img src={m.logo_url} alt="" width={size} height={size} loading="lazy"
        style={{ borderRadius: "50%", flexShrink: 0 }}
        onError={e => { e.currentTarget.style.display = "none"; }} />
    );
  }
  return <div className="coin-logo" style={{ width: size, height: size, fontSize: size / 3 }}>{m.base.slice(0, 3)}</div>;
}

function Spark({ data, up, height = 34 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * 100).toFixed(1)},${(height - ((v - min) / span) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  const id = `g-${up ? "u" : "d"}-${data.length}`;
  return (
    <svg className="spark" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={up ? "var(--green)" : "var(--red)"} stopOpacity="0.35" />
          <stop offset="100%" stopColor={up ? "var(--green)" : "var(--red)"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} 100,${height}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={up ? "var(--green)" : "var(--red)"} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function TickerTape({ markets }) {
  if (!Array.isArray(markets) || !markets.length) return null;
  const items = [...markets, ...markets];
  return (
    <div className="tape">
      <div className="tape-track">
        {items.map((m, i) => {
          const up = Number(m.change_24h) >= 0;
          return (
            <Link href={`/trade?symbol=${m.symbol}`} className="tape-item" key={`${m.symbol}-${i}`}>
              <b>{m.base}</b>
              <span>{fmt(m.price)}</span>
              <span className={up ? "up" : "down"}>{up ? "+" : ""}{Number(m.change_24h).toFixed(2)}%</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [markets, setMarkets] = useState([]);
  // localStorage only exists in the browser, so this must be read in an effect
  // rather than during render -- otherwise the server-rendered HTML disagrees
  // with the first client paint and React throws a hydration mismatch.
  const [user, setUser] = useState(null);
  const [bals, setBals] = useState([]);
  // Eye toggle for the balance card. Starts visible, same convention as
  // the Assets page.
  const [showBal, setShowBal] = useState(true);
  // Which coin the balance card shows; the dropdown lists what the user holds.
  const [coin, setCoin] = useState("BTC");

  useEffect(() => {
    const u = getUser();
    setUser(u);
    // Balances need a token, so signed-out visitors skip the fetch.
    if (!u) return;
    api("/api/wallet/balances/?held=1")
      .then(rows => setBals(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, []);

  // Remember the last picked coin across visits.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vyne_home_coin");
      if (saved) setCoin(saved);
    } catch {}
  }, []);

  useEffect(() => {
    api("/api/trading/markets/", { method: "GET" }).then(setMarkets).catch(() => {});
    const t = setInterval(async () => {
      const data = await fetchTick();
      if (data) setMarkets(data);
    }, 2500);
    return () => clearInterval(t);
  }, []);

  // Balance-card values for the selected coin. `held=1` only returns coins the
  // user actually holds, so the dropdown lists exactly those; before the fetch
  // resolves (and for users with no holdings) it falls back to BTC at 0.
  const prices = { ...STABLE };
  markets.forEach(m => { if (m.base && m.price != null) prices[m.base] = Number(m.price); });
  const heldCoins = bals.length ? bals.map(r => r.asset) : ["BTC"];
  // The saved/selected coin must still be one the user holds.
  const activeCoin = heldCoins.includes(coin) ? coin : heldCoins[0];
  const activeMeta = markets.find(m => m.base === activeCoin) || { base: activeCoin };
  const activeBal = Number(bals.find(r => r.asset === activeCoin)?.available || 0);
  const activeUsd = activeBal * (prices[activeCoin] || 0);

  return (
    <>
      <Nav />
      <main>
        <TickerTape markets={markets} />
        <section className={`container hero${user ? " hero-home" : ""}`}>
          {/* Signed-in: balance card + Fund account fills the gap under the tape. */}
          {user && (
            <div className="home-bal anim-pop">
              <div className="home-bal-left">
                <CoinLogo m={activeMeta} size={38} />
                <div>
                  <div className="home-bal-coin">
                    <select
                      className="home-bal-select"
                      value={activeCoin}
                      title="Change coin"
                      aria-label="Choose coin"
                      onChange={e => {
                        setCoin(e.target.value);
                        try { localStorage.setItem("vyne_home_coin", e.target.value); } catch {}
                      }}
                    >
                      {heldCoins.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <span aria-hidden="true">▾</span>
                  </div>
                  <div className="home-bal-amt">
                    {showBal ? `${fmt(activeBal)} ${activeCoin}` : "••••••"}
                    {showBal && activeUsd > 0 && (
                      <span className="note" style={{ marginLeft: 8, fontWeight: 600 }}>
                        ≈ {fmt(activeUsd)} USDT
                      </span>
                    )}
                  </div>
                </div>
                <button className="home-bal-eye" onClick={() => setShowBal(s => !s)}
                  title={showBal ? "Hide balance" : "Show balance"}
                  aria-label={showBal ? "Hide balance" : "Show balance"}>
                  {showBal ? "👁" : "🙈"}
                </button>
              </div>
              <Link href="/deposit" className="btn btn-g">Fund account</Link>
            </div>
          )}
          <span className="eyebrow anim-pop"><span className="dot" /> Live prices from the global market</span>
          <h1 className="anim-up">
            {user
              ? <>Welcome back,<em style={{ marginLeft: 10 }}>{user.username}</em></>
              : <>Buy and sell crypto<br /><em>at the real market price.</em></>}
          </h1>
          <p className="anim-up d1">
            {user
              ? <>Your UID is {user.uid}. Trade {markets.length || "100+"} coins against USDT — spot, futures, earn, convert and P2P from one account.</>
              : <>Trade {markets.length || "100+"}{" "}coins against USDT on a live order book. Spot, futures, earn, convert and P2P — all from one account.</>}
          </p>
          <div className="hero-cta anim-up d2">
            {/* Never invite a signed-in user to create a second account. */}
            {user ? (
              <>
                <Link href="/assets" className="btn btn-o btn-lg">My assets</Link>
                <Link href="/trade" className="btn btn-g btn-lg">Start trading</Link>
              </>
            ) : (
              <>
                <Link href="/register" className="btn btn-o btn-lg">Create account</Link>
                <Link href="/trade" className="btn btn-g btn-lg">Start trading</Link>
              </>
            )}
          </div>
          <div className="hero-trust anim-up d3">
            <span>🔒 Funds reserved in open orders</span>
            <span>⚡ Instant market settlement</span>
            <span>📈 0.1% spot fee</span>
          </div>
        </section>

        <section className="container" style={{ paddingBottom: 16 }}>
          <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 24 }}>Top markets</h2>
              <p className="note" style={{ marginTop: 4 }}>Live prices ranked by market capitalisation.</p>
            </div>
            <Link href="/markets" className="btn btn-g">View all {markets.length || ""} markets →</Link>
          </div>
          <div className="tickers">
            {markets.slice(0, 8).map((m, i) => {
              const up = Number(m.change_24h) >= 0;
              return (
                <Link href={`/trade?symbol=${m.symbol}`} className="ticker anim-up" key={m.symbol} style={{ animationDelay: `${i * 0.05}s` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CoinLogo m={m} />
                    <div>
                      <div className="sym">{m.base}<span style={{ color: "var(--muted)", fontWeight: 600 }}>/{m.quote}</span></div>
                      <div className="note" style={{ marginTop: 1 }}>{m.name || m.symbol}</div>
                    </div>
                  </div>
                  <div className="px">{fmt(m.price)}</div>
                  <div className={`chg ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {Math.abs(Number(m.change_24h)).toFixed(2)}%</div>
                  <Spark data={m.sparkline} up={up} />
                </Link>
              );
            })}
          </div>
        </section>

        <Features />
        <Stats markets={markets} />
        <Steps />
        <Movers markets={markets} />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </>
  );
}

