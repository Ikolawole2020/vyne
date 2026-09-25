"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import TVChart from "../../components/TVChart";
import { api, getToken } from "../../lib/api";

function fmtPrice(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  if (v !== 0 && Math.abs(v) < 0.01) return v.toLocaleString(undefined, { maximumFractionDigits: 8 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function Trade() {
  const [markets, setMarkets] = useState([]);
  const [symbol, setSymbol] = useState("BTCUSDT");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("symbol");
    if (q) setSymbol(q.toUpperCase());
  }, []);
  const [side, setSide] = useState("buy");
  const [type, setType] = useState("market");
  const [qty, setQty] = useState("0.01");
  const [price, setPrice] = useState("");
  const [bals, setBals] = useState([]);
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState("");
  const m = markets.find(x => x.symbol === symbol);

  async function load() {
    const mk = await api("/api/trading/markets/");
    setMarkets(mk);
    if (getToken()) {
      setBals(await api("/api/wallet/balances/"));
      setOrders(await api("/api/trading/orders/"));
    }
  }
  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => {
      fetch((process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000") + "/api/trading/tick/", { method: "POST" })
        .then(r => r.json()).then(setMarkets).catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, []);

  async function place(e) {
    e.preventDefault();
    setMsg("");
    try {
      const result = await api("/api/trading/order/", {
        method: "POST",
        body: { symbol, side, order_type: type, quantity: qty, price: price || undefined },
      });
      setMsg(result.message || "Order filled");
      load();
    } catch (e) { setMsg(e.message); }
  }

  const quoteBal = bals.find(b => b.asset === (m?.quote || "USDT"));
  const baseBal = bals.find(b => b.asset === (m?.base || "BTC"));

  return (
    <>
      <Nav />
      <div className="trade-grid">
        <div className="panel">
          <h3>Markets ({markets.length})</h3>
          <div style={{ overflowY: "auto", flex: 1 }}>
          {markets.map(x => (
            <div key={x.symbol} className="row" onClick={() => setSymbol(x.symbol)}
              style={{ cursor: "pointer", background: x.symbol === symbol ? "var(--bg3)" : undefined }}>
              <div>
                <b>{x.base}<span style={{ color: "var(--muted)" }}>/{x.quote}</span></b>
                <div className={Number(x.change_24h) >= 0 ? "up" : "down"} style={{ fontSize: 11 }}>
                  {Number(x.change_24h) >= 0 ? "▲" : "▼"} {Math.abs(Number(x.change_24h)).toFixed(2)}%
                </div>
              </div>
              <div>{fmtPrice(x.price)}</div>
            </div>
          ))}
          </div>
        </div>
        <div className="panel">
          <h3>{symbol} · last {m ? Number(m.price).toLocaleString() : "—"} · 24h {m ? Number(m.change_24h).toFixed(2) : "0"}%</h3>
          <TVChart symbol={symbol} height={420} />
          <div style={{ maxHeight: 220, overflow: "auto" }}>
            <table>
              <thead><tr><th>Time</th><th>Side</th><th>Qty</th><th>Price</th><th>Status</th></tr></thead>
              <tbody>
                {orders.filter(o => o.symbol === symbol).map(o => (
                  <tr key={o.id}>
                    <td>{new Date(o.created_at).toLocaleTimeString()}</td>
                    <td className={o.side === "buy" ? "up" : "down"}>{o.side}</td>
                    <td>{o.quantity}</td>
                    <td>{o.price}</td>
                    <td>
                      {o.status === "open" ? <button className="btn btn-red" onClick={async () => { await api(`/api/trading/orders/${o.id}/cancel/`, { method: "POST" }); load(); }}>Cancel</button> : o.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <h3>Spot order</h3>
          <div className="tabs">
            <button className={`tab ${side === "buy" ? "on-buy" : ""}`} onClick={() => setSide("buy")}>Buy</button>
            <button className={`tab ${side === "sell" ? "on-sell" : ""}`} onClick={() => setSide("sell")}>Sell</button>
          </div>
          <form onSubmit={place} style={{ padding: 12 }}>
            <label>Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
            {type === "limit" && (
              <>
                <label>Price</label>
                <input value={price} onChange={e => setPrice(e.target.value)} placeholder={m ? String(m.price) : ""} />
              </>
            )}
            <label>Quantity ({m?.base})</label>
            <input value={qty} onChange={e => setQty(e.target.value)} />
            <p className="note">Avail {m?.quote}: {quoteBal?.available || 0}</p>
            <p className="note">Avail {m?.base}: {baseBal?.available || 0}</p>
            {msg && <div className={msg === "Order filled" ? "ok" : "err"}>{msg}</div>}
            <button className={`btn ${side === "buy" ? "btn-green" : "btn-red"}`} style={{ width: "100%", marginTop: 14, padding: 12 }}>
              {side === "buy" ? `Buy ${m?.base || ""}` : `Sell ${m?.base || ""}`}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
