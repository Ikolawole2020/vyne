"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";
export default function Copy() {
  const [traders, setTraders] = useState([]);
  const [amt, setAmt] = useState("200");
  const [msg, setMsg] = useState("");
  useEffect(()=>{ api("/api/products/copy/").then(setTraders).catch(e=>setMsg(e.message)); }, []);
  return (
    <><Nav />
    <div className="container page">
      <h2>Copy trading</h2>
      <p className="note">Allocate USDT to follow a lead trader. PnL copy is simulated.</p>
      {msg && <div className={msg.includes("ok")?"ok":"err"}>{msg}</div>}
      <div className="grid-3" style={{ marginTop: 16 }}>
        {traders.map(t => (
          <div className="card" key={t.id}>
            <h3>{t.display}</h3>
            <div className="note">@{t.username}</div>
            <div className="kv"><span>30D ROI</span><b className="up">{t.roi_30d}%</b></div>
            <div className="kv"><span>Followers</span><b>{t.followers}</b></div>
            <div className="kv"><span>AUM</span><b>${Number(t.aum).toLocaleString()}</b></div>
            <p className="note">{t.bio}</p>
            <input value={amt} onChange={e=>setAmt(e.target.value)} />
            <button className="btn btn-o" style={{ marginTop: 8 }} onClick={()=>api(`/api/products/copy/${t.id}/follow/`,{method:"POST",body:{allocated:amt}}).then(()=>setMsg("ok followed")).catch(e=>setMsg(e.message))}>Copy</button>
          </div>
        ))}
      </div>
    </div></>
  );
}
