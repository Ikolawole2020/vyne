"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";
export default function P2P() {
  const [side, setSide] = useState("sell");
  const [ads, setAds] = useState([]);
  const [orders, setOrders] = useState([]);
  const [fiat, setFiat] = useState("50000");
  const [msg, setMsg] = useState("");
  async function load() {
    setAds(await api(`/api/products/p2p/ads/?side=${side}`));
    try { setOrders(await api("/api/products/p2p/orders/")); } catch {}
  }
  useEffect(()=>{ load().catch(e=>setMsg(e.message)); }, [side]);
  return (
    <><Nav />
    <div className="container page">
      <h2>P2P</h2>
      <p className="note">Buy and sell USDT with NGN. Escrow is simulated — release is manual in a real build.</p>
      <div className="pill" style={{ margin: "14px 0" }}>
        <button className={side==="sell"?"on":""} onClick={()=>setSide("sell")}>Buy USDT</button>
        <button className={side==="buy"?"on":""} onClick={()=>setSide("buy")}>Sell USDT</button>
      </div>
      {msg && <div className="err">{msg}</div>}
      <div className="card">
        <table>
          <thead><tr><th>Advertiser</th><th>Price</th><th>Limit</th><th>Method</th><th>Available</th><th></th></tr></thead>
          <tbody>
            {ads.map(a => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td><b>{Number(a.price).toLocaleString()} {a.fiat}</b></td>
                <td>{a.min_limit} – {a.max_limit}</td>
                <td>{a.method}</td>
                <td>{a.available} {a.asset}</td>
                <td>
                  <input style={{ width: 110, marginRight: 8 }} value={fiat} onChange={e=>setFiat(e.target.value)} />
                  <button className="btn btn-o" onClick={()=>api(`/api/products/p2p/ads/${a.id}/take/`,{method:"POST",body:{amount_fiat:fiat}}).then(()=>{setMsg("");load();}).catch(e=>setMsg(e.message))}>Take</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 style={{ margin: "24px 0 8px" }}>My P2P orders</h3>
      <div className="card">
        <table>
          <thead><tr><th>Fiat</th><th>Crypto</th><th>Status</th></tr></thead>
          <tbody>{orders.map(o=><tr key={o.id}><td>{o.amount_fiat}</td><td>{o.amount_asset}</td><td><span className="badge pending">{o.status}</span></td></tr>)}</tbody>
        </table>
      </div>
    </div></>
  );
}
