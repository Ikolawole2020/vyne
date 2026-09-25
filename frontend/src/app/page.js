"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "../components/Nav";
import { api } from "../lib/api";
import { Features, Stats, Steps, Movers } from "./landing-sections";
import { Faq, CtaBand, Footer } from "./landing-faq-footer";

function fmt(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  if (v !== 0 && Math.abs(v) < 0.01) return v.toLocaleString(undefined, { maximumFractionDigits: 8 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

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
  const items = [...markets, ...markets];
  if (!markets.length) return null;
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

  useEffect(() => {
    api("/api/trading/markets/", { method: "GET" }).then(setMarkets).catch(() => {});
    const t = setInterval(() => {
      fetch((process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000") + "/api/trading/tick/", { method: "POST" })
        .then(r => r.json()).then(setMarkets).catch(() => {});
    }, 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <Nav />
      <main>
        <TickerTape markets={markets} />
        <section className="container hero">
          <span className="eyebrow anim-pop"><span className="dot" /> Live prices from the global market</span>
          <h1 className="anim-up">Buy and sell crypto<br /><em>at the real market price.</em></h1>
          <p className="anim-up d1">
            Trade {markets.length || "100+"}{" "}
            coins against USDT on a live order book. Spot, futures, earn, convert and P2P —
            all from one account.
          </p>
          <div className="hero-cta anim-up d2">
            <Link href="/register" className="btn btn-o btn-lg">Create account</Link>
            <Link href="/trade" className="btn btn-g btn-lg">Start trading</Link>
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

