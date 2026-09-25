"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";
export default function Inbox() {
  const [items, setItems] = useState([]);
  const [news, setNews] = useState([]);
  useEffect(()=>{
    api("/api/auth/notifications/").then(setItems).catch(()=>{});
    api("/api/products/announcements/").then(setNews).catch(()=>{});
  }, []);
  return (
    <><Nav />
    <div className="container page">
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <h2>Notifications</h2>
        <button className="btn btn-g" onClick={()=>api("/api/auth/notifications/",{method:"POST"}).then(()=>api("/api/auth/notifications/").then(setItems))}>Mark read</button>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        {items.map(n => <div className="row" key={n.id}><div><b>{n.title}</b><div className="note">{n.body}</div></div><span className={`badge ${n.read?"":"pending"}`}>{n.read?"read":"new"}</span></div>)}
        {!items.length && <p className="note" style={{ padding: 12 }}>No personal alerts yet.</p>}
      </div>
      <h3 style={{ margin: "24px 0 8px" }}>Announcements</h3>
      <div className="card">
        {news.map(a => <div className="row" key={a.id}><div><b>{a.title}</b><div className="note">{a.body}</div></div><span className="badge">{a.tag}</span></div>)}
      </div>
    </div></>
  );
}
