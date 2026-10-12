"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import TVChart from "../../components/TVChart";
import { api, getToken, fetchTick } from "../../lib/api";

export default function Futures() {
  const [markets, setMarkets] = useState([]);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState("long");
  const [lev, setLev] = useState(10);
  const [qty, setQty] = useState("0.01");
  const [pos, setPos] = useState([]);
  const [msg, setMsg] = useState("");
  const m = markets.find(x => x.symbol === symbol);
  async function load() {
    setMarkets(await api("/api/trading/markets/"));
    if (getToken()) setPos(await api("/api/trading/positions/?status=open"));
  }
  useEffect(() => { load().catch(()=>{}); const t=setInterval(async ()=>{
    const ticked = await fetchTick();
    if (ticked) setMarkets(ticked);
  },2500); return ()=>clearInterval(t); }, []);
  async function openPos(e) {
    e.preventDefault(); setMsg("");
    try { await api("/api/trading/futures/", { method:"POST", body:{ symbol, side, leverage: lev, quantity: qty }}); setMsg("Position opened"); load(); }
    catch(e){ setMsg(e.message); }
  }
  return (
    <><Nav />
    <div className="container page">
      <h2>USDT perpetual</h2>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {markets.map(x => <button key={x.symbol} className="btn btn-g" onClick={()=>setSymbol(x.symbol)}>{x.symbol}</button>)}
          </div>
          <h3 style={{ margin:"16px 0 8px" }}>{symbol} · {m ? Number(m.price).toLocaleString() : "—"}</h3>
          <TVChart symbol={symbol} height={360} />
          <p className="note">Isolated margin · live mark price · max 100x</p>
          <div className="card table-scroll" style={{ padding: 0, marginTop: 12 }}>
          <table>
            <thead><tr><th>Side</th><th>Lev</th><th>Qty</th><th>Entry</th><th>Mark</th><th>Liq</th><th>Unrealized P&L</th><th>ROE</th><th></th></tr></thead>
            <tbody>
              {pos.map(p => {
                const pnl = Number(p.unrealized);
                return (
                <tr key={p.id}>
                  <td className={p.side==="long"?"up":"down"}>{p.side}</td>
                  <td>{p.leverage}x</td><td>{p.qty}</td><td>{p.entry}</td>
                  <td>{p.mark_price || "—"}</td>
                  <td>{Number(p.liq_price).toFixed(p.liq_price < 1 ? 6 : 2)}</td>
                  <td className={pnl >= 0 ? "up" : "down"}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                  </td>
                  <td className={Number(p.roe) >= 0 ? "up" : "down"}>{Number(p.roe).toFixed(2)}%</td>
                  <td><button className="btn btn-red" onClick={()=>api(`/api/trading/futures/${p.id}/close/`,{method:"POST"}).then(load)}>Close</button></td>
                </tr>
                );
              })}
              {pos.length === 0 && <tr><td colSpan="9" className="empty">No open positions</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
        <form className="card" onSubmit={openPos}>
          <div className="tabs">
            <button type="button" className={`tab ${side==="long"?"on-buy":""}`} onClick={()=>setSide("long")}>Long</button>
            <button type="button" className={`tab ${side==="short"?"on-sell":""}`} onClick={()=>setSide("short")}>Short</button>
          </div>
          <label>Leverage {lev}x</label>
          <input type="range" min="1" max="100" value={lev} onChange={e=>setLev(Number(e.target.value))} />
          <label>Quantity</label>
          <input value={qty} onChange={e=>setQty(e.target.value)} />
          {msg && <div className={msg.includes("opened")?"ok":"err"}>{msg}</div>}
          <button className={`btn ${side==="long"?"btn-green":"btn-red"}`} style={{width:"100%",marginTop:14,padding:12}}>{side==="long"?"Open long":"Open short"}</button>
        </form>
      </div>
    </div></>
  );
}
