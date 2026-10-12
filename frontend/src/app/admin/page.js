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
  const [busy, setBusy] = useState(false);

  async function load() {
    // Six independent endpoints. Awaited in sequence, a single failure aborted
    // the rest and left the whole console blank -- and since the interval poll
    // swallows its errors, it looked like data had simply stopped loading.
    // Each fetch now degrades on its own so one bad endpoint can't hide the rest.
    const [s, u, n, d, w, a] = await Promise.allSettled([
      api("/api/admin/stats/"),
      api("/api/admin/users/"),
      api("/api/admin/notifications/"),
      api("/api/admin/deposits/"),
      api("/api/admin/withdrawals/"),
      api("/api/admin/deposit-addresses/"),
    ]);
    if (s.status === "fulfilled") setStats(s.value);
    if (u.status === "fulfilled") setUsers(u.value);
    if (n.status === "fulfilled") setNotes(n.value);
    if (d.status === "fulfilled") setDeposits(d.value);
    if (w.status === "fulfilled") setWithdrawals(w.value);
    if (a.status === "fulfilled") setAddrs(a.value);
    const failed = [s, u, n, d, w, a].find(r => r.status === "rejected");
    if (failed) throw failed.reason;
  }
  useEffect(() => {
    const u = getUser();
    if (!u?.is_staff) { window.location.href = "/login"; return; }
    load().catch(e => setMsg(e.message));
    const t = setInterval(() => load().catch(() => {}), 8000);
    return () => clearInterval(t);
  }, []);

  // Every admin write goes through here so a failure is always visible. The
  // deposit/withdrawal/alert buttons used to call `.then(load)` with no catch,
  // which made a 400 or a 429 look exactly like "the button did nothing".
  async function post(path, body) {
    setMsg("");
    setBusy(true);
    try {
      await api(path, { method: "POST", body });
      await load();
      return true;
    } catch (e) {
      setMsg(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function act(userId, action, extra = {}) {
    return post(`/api/admin/users/${userId}/`, { action, ...extra });
  }

  // The edit-balance form renders below the table, so it has to look the user
  // back up. Offering their real wallet assets means the admin can credit any
  // coin the exchange trades (listed_assets() covers every USDT market base),
  // not just the original shortlist.
  const editUser = users.find(x => x.id === edit.userId) || {};
  // Deleted wallets are included so the admin can reselect one and restore it.
  const editAssets = [...new Set([
    ...Object.keys(editUser.balances || {}),
    ...(editUser.deleted_wallets || []),
    "USDT", "BTC", "ETH", "SOL", "BNB", "XRP",
  ])];
  // A deleted wallet drops out of `balances` but is reported separately, so the
  // form can offer Restore instead of Delete for it.
  const isDeleted = (u, asset) => Boolean(u?.deleted_wallets?.includes(asset));

  // Delete is a hide, not a purge: the backend keeps the row so a funded wallet
  // can never vanish mid-settlement, and it refuses while any balance is held --
  // hence the wording in the confirm prompts.
  const walletAction = edit.userId ? (
    isDeleted(editUser, edit.asset) ? (
      <button type="button" className="btn btn-green" disabled={busy}
        onClick={async () => {
          if (!confirm(`Restore the ${edit.asset} wallet for ${editUser.username}?`)) return;
          await act(edit.userId, "restore_wallet", { asset: edit.asset });
        }}>Restore wallet</button>
    ) : (
      <button type="button" className="btn btn-red" disabled={busy}
        onClick={async () => {
          if (!confirm(`Delete the ${edit.asset} wallet for ${editUser.username}? Only empty wallets can be deleted.`)) return;
          await act(edit.userId, "delete_wallet", { asset: edit.asset });
        }}>Delete wallet</button>
    )
  ) : null;

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
          {["users", "wallets", "deposits", "withdrawals", "addr", "alerts"].map(t => (
            <button key={t} className={`tab ${tab === t ? "on-buy" : ""}`} onClick={() => setTab(t)}>{t === "addr" ? "deposit addr" : t}</button>
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
            {/* A fragment is required: everything here sits inside the
                `edit.userId && (...)` parens, which hold a single expression, so
                the form and the note below it cannot be bare siblings. */}
            {edit.userId && (
              <>
                <form style={{ display: "flex", gap: 8, marginTop: 12 }} onSubmit={async e => {
                  e.preventDefault();
                  const value = String(edit.available).trim();
                  // An empty input would reach Decimal("") on the backend and 400.
                  if (value === "" || Number.isNaN(Number(value))) { setMsg("Enter a valid balance amount"); return; }
                  const ok = await act(edit.userId, "set_balance", { asset: edit.asset, available: value });
                  if (!ok) return; // keep the form open so the amount isn't lost
                  setMsg(`Saved ${edit.asset} balance for user #${edit.userId}`);
                  setEdit({ userId: null, asset: "USDT", available: "" });
                }}>
                  <select value={edit.asset} onChange={e => setEdit({ ...edit, asset: e.target.value })}>
                    {editAssets.map(a => <option key={a}>{a}</option>)}
                  </select>
                  <input value={edit.available} inputMode="decimal" onChange={e => setEdit({ ...edit, available: e.target.value })} />
                  <button className="btn btn-o" disabled={busy}>{busy ? "Saving..." : "Save balance"}</button>
                  {walletAction}
                  <button type="button" className="btn btn-o" onClick={() => setEdit({ userId: null, asset: "USDT", available: "" })}>Cancel</button>
                </form>
                {editUser.deleted_wallets?.length > 0 && (
                  <p className="note">Deleted wallets: {editUser.deleted_wallets.join(", ")}</p>
                )}
              </>
            )}
          </div>
        )}

        {tab === "wallets" && (
          <div className="card">
            <p className="note">One row per wallet. Only empty wallets can be deleted — a wallet still holding funds refuses, because those funds may be reserved for a pending withdrawal or open order.</p>
            <table>
              <thead><tr><th></th><th>User</th><th>Asset</th><th>Available</th><th>Frozen</th><th>Status</th></tr></thead>
              <tbody>
                {users.flatMap(u => [
                  ...Object.keys(u.balances || {}).map(asset => ({ u, asset, deleted: false })),
                  ...(u.deleted_wallets || []).map(asset => ({ u, asset, deleted: true })),
                ]).map(({ u, asset, deleted }) => (
                  <tr key={`${u.id}-${asset}`}>
                    {/* The delete control lives here, on the row itself, so a
                        wallet can be removed without opening the edit form. */}
                    <td style={{ width: 1 }}>
                      {deleted ? (
                        <button className="btn btn-g" disabled={busy}
                          onClick={async () => {
                            if (!confirm(`Restore the ${asset} wallet for ${u.username}?`)) return;
                            await act(u.id, "restore_wallet", { asset });
                          }}>Restore</button>
                      ) : (
                        <button className="btn btn-red" disabled={busy}
                          onClick={async () => {
                            if (!confirm(`Delete the ${asset} wallet for ${u.username}?`)) return;
                            await act(u.id, "delete_wallet", { asset });
                          }}>Delete</button>
                      )}
                    </td>
                    <td>{u.username}<div className="note">{u.email}</div></td>
                    <td>{asset}</td>
                    <td>{deleted ? "—" : u.balances?.[asset]}</td>
                    <td>{deleted ? "—" : (u.frozen_balances?.[asset] ?? "0")}</td>
                    <td>{deleted ? <span className="badge frozen">deleted</span> : <span className="badge credited">active</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                          <button className="btn btn-green" onClick={() => post(`/api/admin/deposits/${d.id}/`, { action: "credit" })}>Credit</button>
                          {" "}
                          <button className="btn btn-red" onClick={() => post(`/api/admin/deposits/${d.id}/`, { action: "reject" })}>Reject</button>
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
                          <button className="btn btn-green" onClick={() => post(`/api/admin/withdrawals/${w.id}/`, { action: "approve" })}>Mark sent</button>
                          {" "}
                          <button className="btn btn-red" onClick={() => post(`/api/admin/withdrawals/${w.id}/`, { action: "reject" })}>Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "addr" && (
          <div>
            <form className="card" onSubmit={async e => { e.preventDefault(); if (await post("/api/admin/deposit-addresses/", addrForm)) setAddrForm({ asset: "USDT", network: "TRC20", address: "", memo: "" }); }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr auto", gap: 8, alignItems: "end" }}>
              <div><label>Asset</label><input value={addrForm.asset} onChange={e => setAddrForm({ ...addrForm, asset: e.target.value })} /></div>
              <div><label>Network</label><input value={addrForm.network} onChange={e => setAddrForm({ ...addrForm, network: e.target.value })} /></div>
              <div><label>Your receiving address</label><input value={addrForm.address} onChange={e => setAddrForm({ ...addrForm, address: e.target.value })} /></div>
              <div><label>Memo</label><input value={addrForm.memo} onChange={e => setAddrForm({ ...addrForm, memo: e.target.value })} /></div>
              <button className="btn btn-o" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
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
            <button className="btn btn-g" onClick={() => post("/api/admin/notifications/", { all: true })}>Mark all read</button>
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
