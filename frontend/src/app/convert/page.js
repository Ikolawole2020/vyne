"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";
export default function Convert() {
  const [form, setForm] = useState({ from_asset: "USDT", to_asset: "BTC", amount: "100" });
  const [hist, setHist] = useState([]);
  const [msg, setMsg] = useState("");
  const coins = ["USDT","BTC","ETH","SOL","BNB","XRP","DOGE","ADA","AVAX","DOT"];
  async function load(){ try{ setHist(await api("/api/products/convert/history/")); }catch{} }
  useEffect(()=>{ load(); }, []);
  async function go(e){ e.preventDefault(); setMsg(""); try{ const r=await api("/api/products/convert/",{method:"POST",body:form}); setMsg(`Converted to ${r.to_amount} ${r.to_asset}`); load(); }catch(e){setMsg(e.message);} }
  return (
    <><Nav />
    <div className="container page" style={{ maxWidth: 640 }}>
      <h2>Convert</h2>
      <form className="card" style={{ marginTop: 16 }} onSubmit={go}>
        <label>From</label>
        <select value={form.from_asset} onChange={e=>setForm({...form,from_asset:e.target.value})}>{coins.map(c=><option key={c}>{c}</option>)}</select>
        <label>To</label>
        <select value={form.to_asset} onChange={e=>setForm({...form,to_asset:e.target.value})}>{coins.map(c=><option key={c}>{c}</option>)}</select>
        <label>Amount</label>
        <input value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} />
        {msg && <div className={msg.includes("Converted")?"ok":"err"}>{msg}</div>}
        <button className="btn btn-o" style={{ marginTop: 14, width:"100%", padding:12 }}>Convert now</button>
      </form>
      <div className="card" style={{ marginTop: 16 }}>
        <table><thead><tr><th>From</th><th>To</th><th>Rate</th></tr></thead>
        <tbody>{hist.map(h=><tr key={h.id}><td>{h.from_amount} {h.from_asset}</td><td>{h.to_amount} {h.to_asset}</td><td>{h.rate}</td></tr>)}</tbody></table>
      </div>
    </div></>
  );
}
