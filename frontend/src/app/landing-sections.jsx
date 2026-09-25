"use client";
import Link from "next/link";

export function Features() {
  const FEATURES = [
    ["/trade", "📈", "Spot Trading", "Market and limit orders on majors with a live order book and instant settlement."],
    ["/futures", "⚡", "USD-M Futures", "Long or short with leverage up to 100x and isolated margin."],
    ["/earn", "💎", "Earn", "Flexible and locked yield products on USDT, BTC, ETH and SOL."],
    ["/convert", "🔄", "Convert", "Swap between coins instantly at the current market price."],
    ["/p2p", "🤝", "P2P", "Buy and sell directly with merchants using your local payment rails."],
    ["/copy", "👥", "Copy Trading", "Follow experienced traders and allocate a share of your balance."],
    ["/bots", "🤖", "Grid Bots", "Automate range trading with spot and futures grid strategies."],
    ["/assets", "💳", "Wallets", "Deposit, withdraw and manage multi-coin wallet addresses."],
  ];
  return (
    <section className="container section">
      <div className="section-head anim-up">
        <h2>Everything you need to trade</h2>
        <p>Eight product lines built on one account, one balance sheet and one order engine.</p>
      </div>
      <div className="grid-3">
        {FEATURES.map(([href, icon, title, body], i) => (
          <Link key={href} href={href} className="card hover anim-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="feature">
              <div className="ic">{icon}</div>
              <h3>{title}</h3>
              <p className="note" style={{ marginTop: 0 }}>{body}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Stats({ markets }) {
  const totalVolume = markets.reduce((s, m) => s + Number(m.volume_24h || 0), 0);
  const boxes = [
    [markets.length || "—", "Live markets"],
    ["24/7", "Trading availability"],
    ["0.1%", "Spot trading fee"],
    [totalVolume ? `${(totalVolume / 1e6).toFixed(1)}M` : "—", "24h volume"],
  ];
  return (
    <section className="container section" style={{ paddingTop: 0 }}>
      <div className="stat-strip">
        {boxes.map(([n, l], i) => (
          <div className="stat-box anim-up" key={l} style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="n">{n}</div>
            <div className="l">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Steps() {
  const STEPS = [
    ["Create your account", "Sign up in under a minute and complete identity verification to unlock higher limits."],
    ["Fund your wallet", "Send crypto to a deposit address and submit the transaction ID so it can be credited."],
    ["Place your first order", "Use market orders for instant fills or limit orders to set your own entry price."],
    ["Track and withdraw", "Follow positions and price alerts, then withdraw profits straight to your wallet."],
  ];
  return (
    <section className="container section" style={{ paddingTop: 0 }}>
      <div className="section-head anim-up">
        <h2>Get started in four steps</h2>
        <p>From account creation to your first withdrawal.</p>
      </div>
      <div className="steps">
        {STEPS.map(([t, b], i) => (
          <div className="card anim-up" key={t} style={{ animationDelay: `${i * 0.07}s` }}>
            <div className="step">
              <h4>{t}</h4>
              <p>{b}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Movers({ markets }) {
  if (!markets.length) return null;
  const gainers = [...markets].sort((a, b) => Number(b.change_24h) - Number(a.change_24h)).slice(0, 4);
  return (
    <section className="container section" style={{ paddingTop: 0 }}>
      <div className="section-head anim-up">
        <h2>Top movers</h2>
        <p>Leading performers over the last 24 hours.</p>
      </div>
      <div className="grid-2">
        {gainers.map(m => {
          const up = Number(m.change_24h) >= 0;
          return (
            <Link key={m.symbol} href={`/trade?symbol=${m.symbol}`} className="card hover anim-pop">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="coin-cell">
                  <div className="coin-logo">{m.base.slice(0, 3)}</div>
                  <div>
                    <b>{m.base}</b>
                    <div className="note" style={{ marginTop: 2 }}>{m.symbol}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>{Number(m.price).toLocaleString()}</div>
                  <div className={`chg-pill ${up ? "up" : "down"}`} style={{ marginTop: 4 }}>
                    {up ? "▲" : "▼"} {Math.abs(Number(m.change_24h)).toFixed(2)}%
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
