"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

export default function Deposit() {
  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");
  const [amount, setAmount] = useState("100");
  const [txid, setTxid] = useState("");
  const [addrs, setAddrs] = useState([]);
  const [deps, setDeps] = useState([]);
  const [msg, setMsg] = useState("");
  const current = addrs.find(a => a.asset === asset && a.network === network);

  async function load() {
    setAddrs(await api("/api/wallet/deposit-addresses/"));
    setDeps(await api("/api/wallet/deposits/"));
  }
  useEffect(() => { load().catch(e => setMsg(e.message)); }, []);

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/api/wallet/deposit/", { method: "POST", body: { asset, network, amount, txid } });
      setMsg("Deposit submitted. Admin has been notified to credit your balance after confirming the transfer.");
      load();
    } catch (e) { setMsg(e.message); }
  }

  return (
    <>
      <Nav />
      <div className="container" style={{ paddingTop: 24, maxWidth: 720 }}>
        <h2>Deposit crypto</h2>
        <p className="note">Send funds to the platform address set by admin. Then submit this form so admin can credit your Vyne balance.</p>
        <form className="card" style={{ marginTop: 16 }} onSubmit={submit}>
          <label>Coin</label>
          <select value={asset} onChange={e => setAsset(e.target.value)}>
            {["USDT","BTC","ETH","SOL","BNB","XRP"].map(a => <option key={a}>{a}</option>)}
          </select>
          <label>Network</label>
          <select value={network} onChange={e => setNetwork(e.target.value)}>
            {["TRC20","ERC20","BEP20","BTC","SOL","XRP"].map(a => <option key={a}>{a}</option>)}
          </select>
          <label>Platform deposit address</label>
          <input readOnly value={current?.address || "Admin has not set an address for this network yet"} />
          {current?.memo && (<><label>Memo</label><input readOnly value={current.memo} /></>)}
          <label>Amount you sent</label>
          <input value={amount} onChange={e => setAmount(e.target.value)} />
          <label>TxID (optional)</label>
          <input value={txid} onChange={e => setTxid(e.target.value)} />
          {msg && <div className={msg.includes("submitted") ? "ok" : "err"}>{msg}</div>}
          <button className="btn btn-o" style={{ marginTop: 16, padding: 12 }}>I have sent the funds</button>
        </form>
        <h3 style={{ margin: "24px 0 8px" }}>History</h3>
        <div className="card">
          <table>
            <thead><tr><th>Asset</th><th>Amount</th><th>Network</th><th>Status</th></tr></thead>
            <tbody>
              {deps.map(d => (
                <tr key={d.id}><td>{d.asset}</td><td>{d.amount}</td><td>{d.network}</td>
                  <td><span className={`badge ${d.status}`}>{d.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
