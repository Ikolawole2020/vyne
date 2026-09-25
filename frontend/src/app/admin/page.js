"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api, getUser } from "../../lib/api";

export default function Admin() {
  const [tab, setTab] = useState("users");
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [notes, setNotes] = useState({ items: [], unread: 0 });
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [addrs, setAddrs] = useState([]);
  const [addrForm, setAddrForm] = useState({ asset: "USDT", network: "TRC20", address: "", memo: "" });
  const [edit, setEdit] = useState({ userId: null, asset: "USDT", available: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    setStats(await api("/api/admin/stats/"));
    setUsers(await api("/api/admin/users/"));
    setNotes(await api("/api/admin/notifications/"));
    setDeposits(await api("/api/admin/deposits/"));
    setWithdrawals(await api("/api/admin/withdrawals/"));
    setAddrs(await api("/api/admin/deposit-addresses/"));
  }
  useEffect(() => {
    const u = getUser();
    if (!u?.is_staff) { window.location.href = "/login"; return; }
    load().catch(e => setMsg(e.message));
    const t = setInterval(() => load().catch(() => {}), 8000);
    return () => clearInterval(t);
  }, []);

  async function act(userId, action, extra = {}) {
    setMsg("");
    try {
      await api(`/api/admin/users/${userId}/`, { method: "POST", body: { action, ...extra } });
      await load();
    } catch (e) { setMsg(e.message); }
  }

  return (
    <>
      <Nav />
      <div className="admin-wrap container">
        <h2>Admin console</h2>
        <p className="note">Credit deposits only after you confirm coins arrived in the wallet you configured.</p>
        <div className="stats">
          {[
            ["Users", stats.users],
            ["Frozen", stats.frozen],
            ["Pending deposits", stats.pending_deposits],
            ["Pending withdrawals", stats.pending_withdrawals],
            ["Unread alerts", stats.unread],
          ].map(([k, v]) => (
            <div className="card" key={k}><div className="note">{k}</div><div style={{ fontSize: 26, fontWeight: 800 }}>{v ?? 0}</div></div>
          ))}
        </div>
        {msg && <div className="err">{msg}</div>}
        <div className="tabs" style={{ maxWidth: 640 }}>
          {["users", "deposits", "withdrawals", "wallets", "alerts"].map(t => (
            <button key={t} className={`tab ${tab === t ? "on-buy" : ""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        {tab === "users" && (
          <div className="card">
            <table>
              <thead><tr><th>User</th><th>UID</th><th>USDT</th><th>BTC</th><th>KYC</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.username}<div className="note">{u.email}</div></td>
                    <td>{u.uid}</td>
                    <td>{u.balances?.USDT}</td>
                    <td>{u.balances?.BTC}</td>
                    <td>
                      <span className="badge">{u.kyc_status}</span>
                      {u.kyc_status === "pending" && (
                        <>
                          <button className="btn btn-green" onClick={() => act(u.id, "verify_kyc")}>KYC ok</button>
                          <button className="btn btn-red" onClick={() => act(u.id, "reject_kyc")}>KYC no</button>
                        </>
                      )}
                    </td>
                    <td>{u.is_frozen ? <span className="badge frozen">frozen</span> : <span className="badge credited">active</span>}</td>
                    <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn btn-g" onClick={() => act(u.id, u.is_frozen ? "unfreeze" : "freeze")}>{u.is_frozen ? "Unfreeze" : "Freeze"}</button>
                      {!u.is_staff && <button className="btn btn-red" onClick={() => { if (confirm("Delete user?")) act(u.id, "delete"); }}>Delete</button>}
                      <button className="btn btn-o" onClick={() => setEdit({ userId: u.id, asset: "USDT", available: u.balances?.USDT || "0" })}>Edit bal</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {edit.userId && (
              <form style={{ display: "flex", gap: 8, marginTop: 12 }} onSubmit={e => { e.preventDefault(); act(edit.userId, "set_balance", { asset: edit.asset, available: edit.available }); setEdit({ userId: null, asset: "USDT", available: "" }); }}>
                <select value={edit.asset} onChange={e => setEdit({ ...edit, asset: e.target.value })}>
                  {["USDT","BTC","ETH","SOL","BNB","XRP"].map(a => <option key={a}>{a}</option>)}
                </select>
                <input value={edit.available} onChange={e => setEdit({ ...edit, available: e.target.value })} />
                <button className="btn btn-o">Save balance</button>
              </form>
            )}
          </div>
        )}

        {tab === "deposits" && (
          <div className="card">
            <table>
              <thead><tr><th>User</th><th>Amount</th><th>Network</th><th>Tx</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {deposits.map(d => (
                  <tr key={d.id}>
                    <td>{d.username}</td>
                    <td>{d.amount} {d.asset}</td>
                    <td>{d.network}</td>
                    <td style={{ fontSize: 11 }}>{d.txid || "—"}</td>
                    <td><span className={`badge ${d.status}`}>{d.status}</span></td>
                    <td>
                      {d.status === "pending" && (
                        <>
                          <button className="btn btn-green" onClick={() => api(`/api/admin/deposits/${d.id}/`, { method: "POST", body: { action: "credit" } }).then(load)}>Credit</button>
                          {" "}
                          <button className="btn btn-red" onClick={() => api(`/api/admin/deposits/${d.id}/`, { method: "POST", body: { action: "reject" } }).then(load)}>Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "withdrawals" && (
          <div className="card">
            <table>
              <thead><tr><th>User</th><th>Amount</th><th>Address</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {withdrawals.map(w => (
                  <tr key={w.id}>
                    <td>{w.username}</td>
                    <td>{w.amount} {w.asset}</td>
                    <td style={{ fontSize: 11 }}>{w.address}</td>
                    <td><span className={`badge ${w.status}`}>{w.status}</span></td>
                    <td>
                      {w.status === "pending" && (
                        <>
                          <button className="btn btn-green" onClick={() => api(`/api/admin/withdrawals/${w.id}/`, { method: "POST", body: { action: "approve" } }).then(load)}>Mark sent</button>
                          {" "}
                          <button className="btn btn-red" onClick={() => api(`/api/admin/withdrawals/${w.id}/`, { method: "POST", body: { action: "reject" } }).then(load)}>Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "wallets" && (
          <div>
            <form className="card" onSubmit={async e => { e.preventDefault(); await api("/api/admin/deposit-addresses/", { method: "POST", body: addrForm }); load(); }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr auto", gap: 8, alignItems: "end" }}>
              <div><label>Asset</label><input value={addrForm.asset} onChange={e => setAddrForm({ ...addrForm, asset: e.target.value })} /></div>
              <div><label>Network</label><input value={addrForm.network} onChange={e => setAddrForm({ ...addrForm, network: e.target.value })} /></div>
              <div><label>Your receiving address</label><input value={addrForm.address} onChange={e => setAddrForm({ ...addrForm, address: e.target.value })} /></div>
              <div><label>Memo</label><input value={addrForm.memo} onChange={e => setAddrForm({ ...addrForm, memo: e.target.value })} /></div>
              <button className="btn btn-o">Save</button>
            </form>
            <div className="card" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>Asset</th><th>Network</th><th>Address</th></tr></thead>
                <tbody>{addrs.map(a => <tr key={a.id}><td>{a.asset}</td><td>{a.network}</td><td>{a.address}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "alerts" && (
          <div className="card">
            <button className="btn btn-g" onClick={() => api("/api/admin/notifications/", { method: "POST", body: { all: true } }).then(load)}>Mark all read</button>
            {notes.items?.map(n => (
              <div key={n.id} className="row">
                <div>
                  <b>{n.title}</b>
                  <div className="note">{n.body}</div>
                </div>
                <span className={`badge ${n.read ? "" : "pending"}`}>{n.read ? "read" : "new"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
