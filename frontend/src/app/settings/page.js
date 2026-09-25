"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";
export default function Settings() {
  const [me, setMe] = useState(null);
  const [refs, setRefs] = useState(null);
  const [form, setForm] = useState({ kyc_name: "", kyc_country: "Nigeria", kyc_id_number: "", phone: "" });
  const [msg, setMsg] = useState("");
  useEffect(()=>{
    api("/api/auth/me/").then(u=>{ setMe(u); setForm(f=>({...f, kyc_name:u.kyc_name||"", kyc_country:u.kyc_country||"Nigeria", phone:u.phone||""})); });
    api("/api/auth/referrals/").then(setRefs).catch(()=>{});
  }, []);
  async function save(body) {
    setMsg("");
    try { const u = await api("/api/auth/me/", { method: "PATCH", body }); setMe(u); setMsg("Saved"); }
    catch(e){ setMsg(e.message); }
  }
  if (!me) return <><Nav /><div className="container page">Loading…</div></>;
  return (
    <><Nav />
    <div className="container page" style={{ maxWidth: 720 }}>
      <h2>Account</h2>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="kv"><span>UID</span><b>{me.uid}</b></div>
        <div className="kv"><span>VIP</span><b>VIP {me.vip_level}</b></div>
        <div className="kv"><span>KYC</span><b>{me.kyc_status}</b></div>
        <div className="kv"><span>2FA</span><b>{me.two_fa_enabled ? "On" : "Off"}</b></div>
        <div className="kv"><span>Referral</span><b>{refs?.code}</b></div>
        <div className="kv"><span>Invites</span><b>{refs?.count || 0}</b></div>
      </div>
      <h3 style={{ margin: "22px 0 8px" }}>Identity (KYC)</h3>
      <div className="card">
        <label>Legal name</label>
        <input value={form.kyc_name} onChange={e=>setForm({...form,kyc_name:e.target.value})} />
        <label>Country</label>
        <input value={form.kyc_country} onChange={e=>setForm({...form,kyc_country:e.target.value})} />
        <label>ID number</label>
        <input value={form.kyc_id_number} onChange={e=>setForm({...form,kyc_id_number:e.target.value})} />
        <label>Phone</label>
        <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
        {msg && <div className="ok">{msg}</div>}
        <button className="btn btn-o" style={{ marginTop: 12 }} onClick={()=>save({ ...form, submit_kyc: true })}>Submit KYC</button>
        <button className="btn btn-g" style={{ marginTop: 12, marginLeft: 8 }} onClick={()=>save({ enable_2fa: !me.two_fa_enabled, disable_2fa: me.two_fa_enabled })}>{me.two_fa_enabled?"Disable 2FA flag":"Enable 2FA flag"}</button>
      </div>
    </div></>
  );
}
