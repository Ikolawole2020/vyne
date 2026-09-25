"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import TVChart from "../../components/TVChart";
import { api } from "../../lib/api";

export default function Bots() {
  const [markets, setMarkets] = useState([]);
  const [bots, setBots] = useState([]);
  const [fills, setFills] = useState([]);
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ symbol: "BTCUSDT", mode: "spot", lower: "60000", upper: "70000", grids: "10", investment: "500" });

  async function load() {
    setMarkets(await api("/api/trading/markets/"));
    setBots(await api("/api/products/grids/"));
  }
  useEffect(() => {
    load().catch(e => setMsg(e.message));
    const t = setInterval(() => {
      fetch((process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000") + "/api/trading/tick/", { method: "POST" }).catch(()=>{});
      load().catch(()=>{});
    }, 4000);
    return () => clearInterval(t);
  }, []);

  async function create(e) {
    e.preventDefault(); setMsg("");
    try { await api("/api/products/grids/", { method: "POST", body: form }); setMsg("Bot running"); load(); }
    catch (e) { setMsg(e.message); }
  }
  async function openFills(id) {
    setSel(id);
    setFills(await api(`/api/products/grids/${id}/fills/`));
  }

  return (
    <>
      <Nav />
      <div className="container page">
        <h2>Grid bots</h2>
        <p className="note">Spot or futures-style grid. Investment is locked from USDT. Fills simulate as live prices tick.</p>
        <div className="grid-2" style={{ marginTop: 16 }}>
          <div>
            <TVChart symbol={form.symbol} height={320} />
            <div className="card" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>ID</th><th>Pair</th><th>Range</th><th>Grids</th><th>Invest</th><th>PnL</th><th></th></tr></thead>
                <tbody>
                  {bots.map(b => (
                    <tr key={b.id}>
                      <td>{b.id}</td>
                      <td>{b.symbol} · {b.mode}</td>
                      <td>{b.lower}–{b.upper}</td>
                      <td>{b.grids}</td>
                      <td>{b.investment}</td>
                      <td className={Number(b.profit)>=0?"up":"down"}>{b.profit}</td>
                      <td>
                        <button className="btn btn-g" onClick={()=>openFills(b.id)}>Fills</button>
                        {b.status === "running" && <button className="btn btn-red" style={{ marginLeft: 6 }} onClick={()=>api(`/api/products/grids/${b.id}/stop/`,{method:"POST"}).then(load)}>Stop</button>}
                        {b.status !== "running" && <span className="badge">{b.status}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sel && (
                <div style={{ marginTop: 12 }}>
                  <div className="note">Recent fills · bot #{sel}</div>
                  {fills.map(f => (
                    <div className="row" key={f.id}>
                      <span className={f.side==="buy"?"up":"down"}>{f.side}</span>
                      <span>{f.qty} @ {Number(f.level).toFixed(4)}</span>
                      <span className="up">+{f.profit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <form className="card" onSubmit={create}>
            <h3>Create grid</h3>
            <label>Symbol</label>
            <select value={form.symbol} onChange={e=>setForm({...form,symbol:e.target.value})}>
              {markets.map(m => <option key={m.symbol}>{m.symbol}</option>)}
            </select>
            <label>Mode</label>
            <select value={form.mode} onChange={e=>setForm({...form,mode:e.target.value})}>
              <option value="spot">Spot grid</option>
              <option value="futures">Futures neutral grid</option>
            </select>
            <label>Lower</label>
            <input value={form.lower} onChange={e=>setForm({...form,lower:e.target.value})} />
            <label>Upper</label>
            <input value={form.upper} onChange={e=>setForm({...form,upper:e.target.value})} />
            <label>Number of grids</label>
            <input value={form.grids} onChange={e=>setForm({...form,grids:e.target.value})} />
            <label>Investment (USDT)</label>
            <input value={form.investment} onChange={e=>setForm({...form,investment:e.target.value})} />
            {msg && <div className={msg.includes("running")?"ok":"err"}>{msg}</div>}
            <button className="btn btn-o" style={{ width:"100%", marginTop:14, padding:12 }}>Start bot</button>
          </form>
        </div>
      </div>
    </>
  );
}
