"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

export default function Withdraw() {
  const [form, setForm] = useState({ asset: "USDT", network: "TRC20", amount: "10", address: "", memo: "" });
  const [bals, setBals] = useState([]);
  const [hist, setHist] = useState([]);
  const [msg, setMsg] = useState("");
  async function load() {
    setBals(await api("/api/wallet/balances/"));
    setHist(await api("/api/wallet/withdrawals/"));
  }
  useEffect(() => { load().catch(e => setMsg(e.message)); }, []);
  async function submit(e) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/api/wallet/withdraw/", { method: "POST", body: form });
      setMsg("Withdrawal requested. Admin will process it.");
      load();
    } catch (e) { setMsg(e.message); }
  }
  const bal = bals.find(b => b.asset === form.asset);
  return (
    <>
      <Nav />
      <div className="container" style={{ paddingTop: 24, maxWidth: 720 }}>
        <h2>Withdraw</h2>
        <form className="card" style={{ marginTop: 16 }} onSubmit={submit}>
          <label>Coin</label>
          <select value={form.asset} onChange={e => setForm({ ...form, asset: e.target.value })}>
            {["USDT","BTC","ETH","SOL","BNB","XRP"].map(a => <option key={a}>{a}</option>)}
          </select>
          <p className="note">Available: {bal?.available || 0}</p>
          <label>Network</label>
          <input value={form.network} onChange={e => setForm({ ...form, network: e.target.value })} />
          <label>Address</label>
          <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <label>Amount</label>
          <input value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          {msg && <div className={msg.includes("requested") ? "ok" : "err"}>{msg}</div>}
          <button className="btn btn-o" style={{ marginTop: 16, padding: 12 }}>Submit withdrawal</button>
        </form>
        <div className="card" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Asset</th><th>Amount</th><th>Address</th><th>Status</th></tr></thead>
            <tbody>
              {hist.map(w => (
                <tr key={w.id}><td>{w.asset}</td><td>{w.amount}</td><td style={{ fontSize: 12 }}>{w.address}</td>
                  <td><span className={`badge ${w.status}`}>{w.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
