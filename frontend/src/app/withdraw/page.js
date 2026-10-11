"use client";
import { useEffect, useMemo, useState } from "react";
import Nav from "../../components/Nav";
import { api, getUser } from "../../lib/api";

const COMMON = ["USDT", "BTC", "ETH", "SOL", "BNB", "XRP"];

// Mirrors the fee the backend charges before it locks the withdrawal.
function feeFor(asset) {
  return asset === "USDT" || asset === "USDC" ? 1 : 0.0001;
}

export default function Withdraw() {
  const [form, setForm] = useState({ asset: "USDT", network: "TRC20", amount: "", address: "", memo: "" });
  const [bals, setBals] = useState([]);
  const [hist, setHist] = useState([]);
  const [netMap, setNetMap] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const user = typeof window !== "undefined" ? getUser() : null;
  const kycOk = user?.kyc_status === "verified";

  async function load() {
    const [b, h, n] = await Promise.all([
      api("/api/wallet/balances/").catch(() => []),
      api("/api/wallet/withdrawals/").catch(() => []),
      api("/api/wallet/networks/").catch(() => null),
    ]);
    setBals(Array.isArray(b) ? b : []);
    setHist(Array.isArray(h) ? h : []);
    setNetMap(n?.networks || {});
  }

  useEffect(() => {
    load().catch(e => setMsg(e.message));
    // Deep link from the assets page: /withdraw?asset=SOL
    const pre = new URLSearchParams(window.location.search).get("asset");
    if (pre) setForm(f => ({ ...f, asset: pre }));
  }, []);

  // Coins the user actually holds come first so the dropdown stays useful.
  const assetOptions = useMemo(() => {
    const held = bals.filter(b => Number(b.total || 0) > 0).map(b => b.asset);
    return [...new Set([...held, form.asset, ...COMMON])];
  }, [bals, form.asset, netMap]);

  const netOptions = netMap[form.asset] || [form.asset];

  useEffect(() => {
    if (netOptions.length && !netOptions.includes(form.network)) {
      setForm(f => ({ ...f, network: netOptions[0] }));
    }
  }, [form.asset, netOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const bal = bals.find(b => b.asset === form.asset);
  const avail = Number(bal?.available || 0);
  const amount = Number(form.amount || 0);
  const fee = feeFor(form.asset);
  const total = amount > 0 ? amount + fee : 0;
  const overdraw = amount > 0 && total > avail;

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    if (!kycOk) { setMsg("Complete identity verification (KYC) in Settings before withdrawing."); return; }
    setBusy(true);
    try {
      await api("/api/wallet/withdraw/", { method: "POST", body: form });
      setMsg("ok:Withdrawal requested. Admin will process it.");
      setForm(f => ({ ...f, amount: "", address: "", memo: "" }));
      load();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  const okMsg = msg.startsWith("ok:");
  return (
    <>
      <Nav />
      <div className="container" style={{ paddingTop: 24, maxWidth: 720, paddingBottom: 56 }}>
        <h2 style={{ margin: 0 }}>Withdraw</h2>
        <p className="note" style={{ marginTop: 4 }}>
          {kycOk
            ? `A network fee of ${fee} ${form.asset} is deducted on top of the amount.`
            : "Identity verification is required before you can withdraw."}
        </p>

        <form className="card" style={{ marginTop: 16 }} onSubmit={submit}>
          <label>Coin</label>
          <select value={form.asset} onChange={e => { setForm({ ...form, asset: e.target.value }); setMsg(""); }}>
            {assetOptions.map(a => <option key={a}>{a}</option>)}
          </select>
          <p className="note" style={{ margin: "6px 0 0" }}>
            Available: {avail.toLocaleString(undefined, { maximumFractionDigits: 8 })} {form.asset}
          </p>

          <label>Network</label>
          <select value={form.network} onChange={e => { setForm({ ...form, network: e.target.value }); setMsg(""); }}>
            {netOptions.map(n => <option key={n}>{n}</option>)}
          </select>

          <label>Address</label>
          <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="Destination wallet address" />

          <label>Amount</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
              inputMode="decimal" placeholder="0.00" style={{ flex: 1 }} />
            <button type="button" className="btn btn-g" style={{ flexShrink: 0 }}
              onClick={() => setForm(f => ({ ...f, amount: String(Math.max(0, avail - fee)) }))}>
              Max
            </button>
          </div>

          <p className="note" style={{ margin: "8px 0 0" }}>
            {amount > 0
              ? `Fee ${fee} ${form.asset} · total deducted ${total.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${form.asset}`
              : `Network fee ${fee} ${form.asset}`}
          </p>
          {overdraw && <div className="err">Amount exceeds your balance by {(total - avail).toLocaleString(undefined, { maximumFractionDigits: 8 })} {form.asset}.</div>}
          {!kycOk && <div className="err">KYC verification required before withdrawing.</div>}
          {msg && <div className={okMsg ? "ok" : "err"}>{okMsg ? msg.slice(3) : msg}</div>}

          <button className="btn btn-o" style={{ marginTop: 16, padding: 12 }}
            disabled={busy || !form.address || !(amount > 0) || overdraw || !kycOk}>
            {busy ? "Submitting…" : "Submit withdrawal"}
          </button>
        </form>

        <h3 style={{ margin: "28px 0 8px" }}>Withdrawal history</h3>
        {hist.length === 0 ? (
          <div className="card" style={{ padding: 30, textAlign: "center" }}>
            <p className="note" style={{ margin: 0 }}>No withdrawals yet.</p>
          </div>
        ) : (
          <div className="card">
            <div className="table-scroll">
              <table>
                <thead><tr><th>Asset</th><th>Amount</th><th>Address</th><th>Status</th><th style={{ textAlign: "right" }}>Date</th></tr></thead>
                <tbody>
                  {hist.map(w => (
                    <tr key={w.id}>
                      <td>{w.asset}</td>
                      <td>{w.amount}</td>
                      <td style={{ fontSize: 12, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.address}</td>
                      <td><span className={`badge ${w.status}`}>{w.status}</span></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{new Date(w.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
