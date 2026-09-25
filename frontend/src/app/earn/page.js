"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";
export default function Earn() {
  const [prods, setProds] = useState([]);
  const [mine, setMine] = useState([]);
  const [amt, setAmt] = useState("100");
  const [msg, setMsg] = useState("");
  async function load() {
    setProds(await api("/api/products/earn/"));
    try { setMine(await api("/api/products/earn/mine/")); } catch {}
  }
  useEffect(()=>{ load().catch(e=>setMsg(e.message)); }, []);
  return (
    <><Nav />
    <div className="container page">
      <h2>Earn</h2>
      <p className="note">Flexible and locked savings. Interest is simulated and paid on redeem.</p>
      {msg && <div className="err">{msg}</div>}
      <div className="grid-3" style={{ marginTop: 16 }}>
        {prods.map(p => (
          <div className="card" key={p.id}>
            <div className="note">{p.asset} · {p.lock_days ? `${p.lock_days}D lock` : "Flexible"}</div>
            <h3>{p.name}</h3>
            <div style={{ fontSize: 28, color: "#0ecb81", fontWeight: 800 }}>{p.apy}%</div>
            <label>Amount</label>
            <input value={amt} onChange={e=>setAmt(e.target.value)} />
            <button className="btn btn-o" style={{ marginTop: 10 }} onClick={()=>api("/api/products/earn/subscribe/",{method:"POST",body:{product_id:p.id,amount:amt}}).then(load).catch(e=>setMsg(e.message))}>Subscribe</button>
          </div>
        ))}
      </div>
      <h3 style={{ margin: "28px 0 10px" }}>My earn</h3>
      <div className="card">
        <table>
          <thead><tr><th>Product</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {mine.map(x => (
              <tr key={x.id}>
                <td>{x.product_name}</td><td>{x.amount} {x.asset}</td>
                <td><span className={`badge ${x.status==="active"?"pending":"credited"}`}>{x.status}</span></td>
                <td>{x.status==="active" && <button className="btn btn-g" onClick={()=>api(`/api/products/earn/${x.id}/redeem/`,{method:"POST"}).then(load)}>Redeem</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div></>
  );
}
