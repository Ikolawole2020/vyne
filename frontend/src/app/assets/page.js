"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "../../components/Nav";
import { api, getToken } from "../../lib/api";

// Pegged coins price 1:1 with the quote currency, so they never appear in the
// market feed as a base coin against themselves.
const STABLE = { USDT: 1, USDC: 1, FDUSD: 1, TUSD: 1, BUSD: 1, DAI: 1 };
const PALETTE = ["#f7931a", "#627eea", "#14f195", "#e84142", "#2a9df4", "#f0b90b", "#8247e5"];

function fmtAmt(v) {
  const n = Number(v || 0);
  if (!isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const s = n.toPrecision(4);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

function fmtUsd(v) {
  const n = Number(v || 0);
  if (!isFinite(n) || n === 0) return "$0.00";
  const abs = Math.abs(n);
  if (abs < 0.01) return `$${n.toPrecision(2)}`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v) {
  const n = Number(v || 0);
  if (!isFinite(n)) return "0.00%";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function CoinLogo({ asset, logo }) {
  if (logo) {
    return (
      <img src={logo} alt="" width="30" height="30" loading="lazy"
        style={{ borderRadius: "50%", flexShrink: 0 }}
        onError={e => { e.currentTarget.style.display = "none"; }} />
    );
  }
  return <div className="coin-logo">{asset.slice(0, 3)}</div>;
}

export default function Assets() {
  const [bals, setBals] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [addrs, setAddrs] = useState([]);
  const [netMap, setNetMap] = useState({});
  const [q, setQ] = useState("");
  const [hideSmall, setHideSmall] = useState(false);
  const [showBal, setShowBal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [showBook, setShowBook] = useState(false);
  const [form, setForm] = useState({ label: "My wallet", asset: "USDT", network: "TRC20", address: "", memo: "" });

  async function load() {
    const [b, m, a, n] = await Promise.all([
      api("/api/wallet/balances/?held=1").catch(() => []),
      api("/api/trading/markets/").catch(() => []),
      api("/api/wallet/addresses/").catch(() => []),
      api("/api/wallet/networks/").catch(() => null),
    ]);
    setBals(Array.isArray(b) ? b : []);
    setMarkets(Array.isArray(m) ? m : []);
    setAddrs(Array.isArray(a) ? a : []);
    setNetMap(n?.networks || {});
    setLoading(false);
  }

  useEffect(() => {
    load().catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  const price = useMemo(() => {
    const p = { ...STABLE };
    markets.forEach(m => { if (m.base && m.price != null) p[m.base] = Number(m.price); });
    return p;
  }, [markets]);

  const meta = useMemo(() => {
    const byBase = {};
    markets.forEach(m => { if (m.base && !byBase[m.base]) byBase[m.base] = m; });
    return byBase;
  }, [markets]);

  // Only coins the user actually holds, valued at the live market price.
  const rows = useMemo(() => bals
    .map(b => {
      const total = Number(b.total || 0);
      const px = price[b.asset] ?? 0;
      return { ...b, total, px, value: total * px, meta: meta[b.asset] };
    })
    .filter(r => r.total > 0), [bals, price, meta]);

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const lockedCount = rows.filter(r => Number(r.frozen) > 0).length;

  const view = rows.filter(r => {
    const term = q.trim().toUpperCase();
    if (term && !r.asset.includes(term) && !(r.meta?.name || "").toUpperCase().includes(term)) return false;
    if (hideSmall && r.value < 1) return false;
    return true;
  });

  const alloc = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.value - a.value);
    const parts = sorted.slice(0, 6).map((r, i) => ({
      asset: r.asset, value: r.value, color: PALETTE[i % PALETTE.length],
    }));
    const restVal = sorted.slice(6).reduce((s, r) => s + r.value, 0);
    if (restVal > 0) parts.push({ asset: "Other", value: restVal, color: "#6b7280" });
    return parts.filter(p => p.value > 0);
  }, [rows]);

  const heldAssets = rows.map(r => r.asset);
  const bookAssets = heldAssets.length ? [...new Set(heldAssets)] : Object.keys(STABLE);
  const bookNetworks = netMap[form.asset] || [form.asset];

  async function addAddr(e) {
    e.preventDefault();
    setErr(""); setOk("");
    try {
      await api("/api/wallet/addresses/", { method: "POST", body: form });
      setForm({ ...form, address: "", memo: "" });
      setOk("Address saved.");
      load();
    } catch (e) { setErr(e.message); }
  }

  async function delAddr(id) {
    setErr(""); setOk("");
    try {
      await api(`/api/wallet/addresses/${id}/`, { method: "DELETE" });
      load();
    } catch (e) { setErr(e.message); }
  }

  const eyeBtn = {
    background: "transparent", border: 0, cursor: "pointer", fontSize: 16,
    padding: 4, lineHeight: 1, color: "var(--muted)",
  };

  return (
    <>
      <Nav />
      <div className="container" style={{ paddingTop: 24, paddingBottom: 56 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Assets</h2>
            <p className="note" style={{ marginTop: 4 }}>
              {loading ? "Loading balances…" : `${rows.length} asset${rows.length === 1 ? "" : "s"} held`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn btn-o" href="/deposit">Deposit</Link>
            <Link className="btn btn-g" href="/withdraw">Withdraw</Link>
            <Link className="btn btn-g" href="/convert">Convert</Link>
          </div>
        </div>

        {err && <div className="err">{err}</div>}
        {ok && <div className="ok">{ok}</div>}

        <div className="card" style={{ marginTop: 16, padding: 24 }}>
          <div className="note" style={{ margin: 0 }}>Estimated balance</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.1 }}>
              {showBal ? fmtUsd(totalValue) : "••••••"}
            </div>
            <button style={eyeBtn} title={showBal ? "Hide balance" : "Show balance"}
              onClick={() => setShowBal(s => !s)}>
              {showBal ? "👁" : "🙈"}
            </button>
          </div>
          <div className="note" style={{ marginTop: 2 }}>
            {loading ? "Fetching live prices…"
              : lockedCount > 0
                ? `${lockedCount} coin${lockedCount === 1 ? "" : "s"} locked in open orders or pending withdrawals`
                : "Nothing locked in open orders"}
          </div>

          {alloc.length > 0 && totalValue > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: "var(--bg3)" }}>
                {alloc.map(p => (
                  <div key={p.asset}
                    title={`${p.asset} · ${((p.value / totalValue) * 100).toFixed(1)}%`}
                    style={{ width: `${(p.value / totalValue) * 100}%`, background: p.color, transition: "width .4s var(--ease)" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
                {alloc.map(p => (
                  <span key={p.asset} className="note" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <i style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
                    {p.asset} {((p.value / totalValue) * 100).toFixed(1)}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "26px 0 10px", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Holdings</h3>
          {rows.length > 0 && (
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
                <input type="checkbox" checked={hideSmall} onChange={e => setHideSmall(e.target.checked)}
                  style={{ accentColor: "var(--orange)" }} />
                Hide balances under $1
              </label>
              <div className="search-wrap" style={{ minWidth: 200 }}>
                <span className="ic">🔍</span>
                <input placeholder="Search assets…" value={q} onChange={e => setQ(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <p className="note" style={{ margin: 0 }}>Loading your holdings…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="card" style={{ padding: "52px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 42 }}>💼</div>
            {getToken() ? (
              <>
                <h3 style={{ margin: "12px 0 6px" }}>No assets yet</h3>
                <p className="note" style={{ maxWidth: 420, margin: "0 auto", lineHeight: 1.6 }}>
                  You aren’t holding any coins yet. Deposit crypto and your balance appears here once the transfer is confirmed.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
                  <Link className="btn btn-o" href="/deposit">Make a deposit</Link>
                  <Link className="btn btn-g" href="/markets">Browse markets</Link>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ margin: "12px 0 6px" }}>Sign in to view your assets</h3>
                <p className="note" style={{ maxWidth: 420, margin: "0 auto", lineHeight: 1.6 }}>
                  Your balances, portfolio value and saved addresses are shown here once you log in.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
                  <Link className="btn btn-o" href="/login">Log in</Link>
                  <Link className="btn btn-g" href="/register">Create account</Link>
                </div>
              </>
            )}
          </div>
        ) : view.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <p className="note" style={{ margin: 0 }}>No assets match “{q || "your filters"}”.</p>
            <button className="btn btn-g" style={{ marginTop: 14 }} onClick={() => { setQ(""); setHideSmall(false); }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="card">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th style={{ textAlign: "right" }}>Price</th>
                    <th style={{ textAlign: "right" }}>24h</th>
                    <th style={{ textAlign: "right" }}>Available</th>
                    <th style={{ textAlign: "right" }}>In orders</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Value</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {view.map(r => {
                    const chg = Number(r.meta?.change_24h || 0);
                    return (
                      <tr key={r.asset}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <CoinLogo asset={r.asset} logo={r.meta?.logo_url} />
                            <div>
                              <div style={{ fontWeight: 700 }}>{r.asset}</div>
                              <div className="note" style={{ margin: 0 }}>{r.meta?.name || r.asset}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>{r.px ? fmtUsd(r.px) : "—"}</td>
                        <td style={{ textAlign: "right", color: chg >= 0 ? "var(--green)" : "var(--red)" }}>{fmtPct(chg)}</td>
                        <td style={{ textAlign: "right" }}>{showBal ? fmtAmt(r.available) : "•••"}</td>
                        <td style={{ textAlign: "right", color: Number(r.frozen) > 0 ? "var(--orange)" : "var(--muted)" }}>
                          {showBal ? fmtAmt(r.frozen) : "•••"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{showBal ? fmtAmt(r.total) : "•••"}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{showBal ? fmtUsd(r.value) : "•••"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <Link className="btn btn-o" href={`/deposit?asset=${r.asset}`}>Deposit</Link>
                            <Link className="btn btn-g" href={`/withdraw?asset=${r.asset}`}>Withdraw</Link>
                            {r.meta?.symbol && (
                              <Link className="btn btn-g" href={`/trade?symbol=${r.meta.symbol}`}>Trade</Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "30px 0 10px" }}>
          <h3 style={{ margin: 0 }}>Withdrawal address book</h3>
          {addrs.length > 0 && (
            <button className="btn btn-g" onClick={() => setShowBook(s => !s)}>
              {showBook ? "Hide" : "Add address"}
            </button>
          )}
        </div>

        {showBook && (
          <form className="card" onSubmit={addAddr} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr auto", gap: 8, alignItems: "end" }}>
            <div><label>Label</label>
              <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} required /></div>
            <div><label>Asset</label>
              <select value={form.asset}
                onChange={e => setForm({ ...form, asset: e.target.value, network: (netMap[e.target.value] || [e.target.value])[0] })}>
                {bookAssets.map(a => <option key={a}>{a}</option>)}
              </select></div>
            <div><label>Network</label>
              <select value={form.network} onChange={e => setForm({ ...form, network: e.target.value })}>
                {bookNetworks.map(n => <option key={n}>{n}</option>)}
              </select></div>
            <div><label>Address</label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required /></div>
            <button className="btn btn-o" style={{ height: 42 }}>Save</button>
          </form>
        )}

        {addrs.length > 0 ? (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Label</th><th>Asset</th><th>Network</th><th>Address</th><th /></tr></thead>
                <tbody>
                  {addrs.map(a => (
                    <tr key={a.id}>
                      <td>{a.label}</td>
                      <td>{a.asset}</td>
                      <td>{a.network}</td>
                      <td style={{ fontSize: 12, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.address}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-g" onClick={() => delAddr(a.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : !showBook && (
          <div className="card" style={{ marginTop: 12, padding: 28, textAlign: "center" }}>
            <p className="note" style={{ margin: 0 }}>No saved addresses yet.</p>
            <button className="btn btn-g" style={{ marginTop: 14 }} onClick={() => setShowBook(true)}>Add address</button>
          </div>
        )}
      </div>
    </>
  );
}
