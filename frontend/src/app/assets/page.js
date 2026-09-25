"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

export default function Assets() {
  const [bals, setBals] = useState([]);
  const [addrs, setAddrs] = useState([]);
  const [form, setForm] = useState({ label: "My wallet", asset: "USDT", network: "TRC20", address: "", memo: "" });
  const [msg, setMsg] = useState("");
  async function load() {
    setBals(await api("/api/wallet/balances/"));
    setAddrs(await api("/api/wallet/addresses/"));
  }
  useEffect(() => { load().catch(e => setMsg(e.message)); }, []);
  async function addAddr(e) {
    e.preventDefault();
    try {
      await api("/api/wallet/addresses/", { method: "POST", body: form });
      setForm({ ...form, address: "" });
      load();
    } catch (e) { setMsg(e.message); }
  }
  return (
    <>
      <Nav />
      <div className="container" style={{ paddingTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Assets</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn btn-o" href="/deposit">Deposit</Link>
            <Link className="btn btn-g" href="/withdraw">Withdraw</Link>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Coin</th><th>Available</th><th>Frozen</th><th>Total</th></tr></thead>
            <tbody>
              {bals.map(b => (
                <tr key={b.asset}><td>{b.asset}</td><td>{b.available}</td><td>{b.frozen}</td><td>{b.total}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 style={{ margin: "28px 0 10px" }}>Withdrawal address book</h3>
        {msg && <div className="err">{msg}</div>}
        <form className="card" onSubmit={addAddr} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr auto", gap: 8, alignItems: "end" }}>
          <div><label>Label</label><input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></div>
          <div><label>Asset</label><input value={form.asset} onChange={e => setForm({ ...form, asset: e.target.value })} /></div>
          <div><label>Network</label><input value={form.network} onChange={e => setForm({ ...form, network: e.target.value })} /></div>
          <div><label>Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <button className="btn btn-o" style={{ height: 42 }}>Save</button>
        </form>
        <div className="card" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>Label</th><th>Asset</th><th>Network</th><th>Address</th></tr></thead>
            <tbody>
              {addrs.map(a => (
                <tr key={a.id}><td>{a.label}</td><td>{a.asset}</td><td>{a.network}</td><td style={{ fontSize: 12 }}>{a.address}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
