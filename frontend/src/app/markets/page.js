"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "../../components/Nav";
import Modal from "../../components/Modal";
import TVChart from "../../components/TVChart";
import { api, fetchTick } from "../../lib/api";

const FILTERS = [["all", "All"], ["gainers", "Gainers"], ["losers", "Losers"], ["fav", "Top volume"]];
const SORTS = [["market_cap_rank", "Rank"], ["volume_24h", "Volume"], ["change_24h", "Change"], ["price", "Price"], ["symbol", "Name"]];

function fmt(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  if (v !== 0 && Math.abs(v) < 0.01) return v.toLocaleString(undefined, { maximumFractionDigits: 8 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtCap(n) {
  const v = Number(n) || 0;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

function CoinLogo({ m }) {
  if (m.logo_url) {
    return (
      <img
        src={m.logo_url}
        alt=""
        width="30"
        height="30"
        loading="lazy"
        style={{ borderRadius: "50%", flexShrink: 0 }}
        onError={e => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  return <div className="coin-logo">{m.base.slice(0, 3)}</div>;
}

function MiniSpark({ data, up }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * 100).toFixed(1)},${(28 - ((v - min) / span) * 26 + 1).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" style={{ height: 28 }}>
      <polyline points={pts} fill="none" stroke={up ? "var(--green)" : "var(--red)"} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export default function Markets() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("market_cap_rank");
  const [dir, setDir] = useState("asc");
  // Symbol whose chart is open, or null. Clicking a row sets it; clicking the
  // same row again clears it so the list collapses.
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const load = () => api("/api/trading/markets/").then(setRows).catch(() => {});
    load();
    const t = setInterval(async () => {
      const data = await fetchTick();
      if (data) setRows(data);
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = rows.filter(r =>
      !term ||
      r.symbol.toLowerCase().includes(term) ||
      r.base.toLowerCase().includes(term) ||
      r.quote.toLowerCase().includes(term)
    );
    if (filter === "gainers") out = out.filter(r => Number(r.change_24h) >= 0);
    else if (filter === "losers") out = out.filter(r => Number(r.change_24h) < 0);
    else if (filter === "fav") out = out.filter(r => Number(r.volume_24h) > 0);
    const sign = dir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      if (sort === "symbol") return sign * String(a.symbol).localeCompare(String(b.symbol));
      return sign * (Number(a[sort]) - Number(b[sort]));
    });
    return out;
  }, [rows, q, filter, sort, dir]);

  function toggleSort(key) {
    if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(key); setDir(key === "symbol" ? "asc" : "desc"); }
  }
  const arrow = key => (sort === key ? (dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <>
      <Nav />
      <div className="container page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 className="anim-up">Markets</h2>
            <p className="note" style={{ marginTop: 4 }}>{rows.length} pairs · prices update every few seconds</p>
          </div>
          <div className="search-wrap anim-up d1">
            <span className="ic">🔍</span>
            <input placeholder="Search coin or pair…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>

        <div className="market-toolbar">
          <div className="pill anim-up d1">
            {FILTERS.map(([k, label]) => (
              <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
          <div className="pill anim-up d2">
            {SORTS.map(([k, label]) => (
              <button key={k} className={sort === k ? "on" : ""} onClick={() => toggleSort(k)}>{label}{arrow(k)}</button>
            ))}
          </div>
        </div>
        <div className="card table-scroll anim-up d2" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => toggleSort("market_cap_rank")}>#{arrow("market_cap_rank")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleSort("symbol")}>Coin{arrow("symbol")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleSort("price")}>Price{arrow("price")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleSort("change_24h")}>24h{arrow("change_24h")}</th>
                <th>7d trend</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleSort("volume_24h")}>24h volume{arrow("volume_24h")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleSort("market_cap")}>Market cap{arrow("market_cap")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((m, i) => {
                const chg = Number(m.change_24h);
                const up = chg >= 0;
                const isOpen = open === m.symbol;
                const row = (
                  <tr
                    key={m.symbol}
                    className={`anim-in market-row ${isOpen ? "open" : ""}`}
                    style={{ animationDelay: `${Math.min(i, 14) * 0.015}s`, cursor: "pointer" }}
                    // Clicking anywhere on the row opens its chart dialog;
                    // clicking the same row again (with the dialog closed)
                    // closes the selection.
                    onClick={() => setOpen(isOpen ? null : m.symbol)}
                  >
                    <td style={{ color: "var(--muted)" }}>{m.market_cap_rank || "—"}</td>
                    <td>
                      <div className="coin-cell">
                        <CoinLogo m={m} />
                        <div>
                          <b>{m.base}</b><span style={{ color: "var(--muted)" }}>/{m.quote}</span>
                          <div className="note" style={{ marginTop: 2 }}>{m.name || m.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td><b>{fmt(m.price)}</b></td>
                    <td><span className={`chg-pill ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%</span></td>
                    <td style={{ width: 110 }}><MiniSpark data={m.sparkline} up={up} /></td>
                    <td>{fmtCap(m.volume_24h)}</td>
                    <td>{fmtCap(m.market_cap)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <Link className="btn btn-o" href={`/trade?symbol=${m.symbol}`}>Trade</Link>
                    </td>
                  </tr>
                );
                // The chart opens in a large dialog (rendered below the table)
                // instead of a squeezed-in row you have to swipe around to read.
                return row;
              })}
            </tbody>
          </table>
          {list.length === 0 && <div className="empty">No markets match “{q}”.</div>}
        </div>
      </div>

      {/* Coin chart dialog: near-full-screen so the whole graph fits without
          swiping. The row click above sets `open`; data stays live because the
          2.5s tick keeps refreshing `rows`. */}
      {open && (() => {
        const m = rows.find(r => r.symbol === open);
        if (!m) return null;
        const up = Number(m.change_24h) >= 0;
        // On phones take ~55% of the viewport for the graph; desktop gets a
        // tall fixed chart inside the wide dialog.
        const chartH = typeof window !== "undefined" && window.innerWidth < 768 ? "54vh" : 460;
        return (
          <Modal
            wide
            open
            onClose={() => setOpen(null)}
            title={`${m.base}/${m.quote}`}
            badge={m.base.slice(0, 3)}
            footer={
              <>
                <Link className="btn btn-o" href={`/trade?symbol=${m.symbol}`} onClick={() => setOpen(null)}>
                  Trade {m.base}
                </Link>
                <button type="button" className="btn btn-g" onClick={() => setOpen(null)}>Close</button>
              </>
            }
          >
            <div className="chart-modal-meta">
              <span className="px">{fmt(m.price)}</span>
              <span className={`chg-pill ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {Math.abs(Number(m.change_24h)).toFixed(2)}%</span>
              <span className="note" style={{ margin: 0 }}>
                24h vol {fmtCap(m.volume_24h)} · Market cap {fmtCap(m.market_cap)}
              </span>
            </div>
            <div className="chart-modal-box">
              <TVChart symbol={m.symbol} height={chartH} />
            </div>
          </Modal>
        );
      })()}
    </>
  );
}


