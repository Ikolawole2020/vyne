"use client";
import { useEffect, useMemo, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

const FALLBACK = ["USDT", "BTC", "ETH", "SOL", "BNB", "XRP"];

export default function Deposit() {
  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("");
  const [amount, setAmount] = useState("100");
  const [txid, setTxid] = useState("");
  const [addrs, setAddrs] = useState([]);
  const [deps, setDeps] = useState([]);
  const [netMap, setNetMap] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [a, d, n] = await Promise.all([
      api("/api/wallet/deposit-addresses/").catch(() => []),
      api("/api/wallet/deposits/").catch(() => []),
      api("/api/wallet/networks/").catch(() => null),
    ]);
    setAddrs(Array.isArray(a) ? a : []);
    setDeps(Array.isArray(d) ? d : []);
    setNetMap(n?.networks || {});
  }

  useEffect(() => {
    load().catch(e => setMsg(e.message));
    // Deep link from the assets page: /deposit?asset=SOL
    const pre = new URLSearchParams(window.location.search).get("asset");
    if (pre) setAsset(pre);
  }, []);

  // Only assets the admin has actually configured a deposit address for.
  const coinOptions = useMemo(() => {
    const live = [...new Set(addrs.map(a => a.asset))];
    const list = live.length ? live : FALLBACK;
    return asset && !list.includes(asset) ? [asset, ...list] : list;
  }, [addrs, asset]);

  const netOptions = useMemo(() => {
    const configured = addrs.filter(a => a.asset === asset).map(a => a.network);
    if (configured.length) return [...new Set(configured)];
    return netMap[asset] || [asset];
  }, [addrs, asset, netMap]);

  // Pick a valid network whenever the coin changes or the URL preselects one.
  useEffect(() => {
    if (!netOptions.length) return;
    if (!netOptions.includes(network)) setNetwork(netOptions[0]);
  }, [asset, netOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = addrs.find(a => a.asset === asset && a.network === network);
  const canSubmit = !!current;

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      await api("/api/wallet/deposit/", { method: "POST", body: { asset, network, amount, txid } });
      setMsg("ok:Deposit submitted. Admin has been notified to credit your balance after confirming the transfer.");
      setTxid("");
      load();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  const okMsg = msg.startsWith("ok:");
  return (
    <>
      <Nav />
      <div className="container" style={{ paddingTop: 24, maxWidth: 720, paddingBottom: 56 }}>
        <h2 style={{ margin: 0 }}>Deposit crypto</h2>
        <p className="note" style={{ marginTop: 4 }}>
          Send funds to the platform address below, then submit the form so admin can credit your balance.
        </p>
        <form className="card" style={{ marginTop: 16 }} onSubmit={submit}>
          <label>Coin</label>
          <select value={asset} onChange={e => { setAsset(e.target.value); setMsg(""); }}>
            {coinOptions.map(a => <option key={a}>{a}</option>)}
          </select>

          <label>Network</label>
          <select value={network} onChange={e => { setNetwork(e.target.value); setMsg(""); }}>
            {netOptions.map(n => <option key={n}>{n}</option>)}
          </select>

          <label>Platform deposit address</label>
          <input readOnly
            value={current?.address || "Admin has not set an address for this network yet"}
            style={{ color: canSubmit ? "var(--text)" : "var(--muted)" }} />
          {current?.memo && (<><label>Memo</label><input readOnly value={current.memo} /></>)}

          <label>Amount you sent</label>
          <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />

          <label>TxID</label>
          <input value={txid} onChange={e => setTxid(e.target.value)} placeholder="Transaction hash from your wallet" />

          {msg && <div className={okMsg ? "ok" : "err"}>{okMsg ? msg.slice(3) : msg}</div>}
          <button className="btn btn-o" style={{ marginTop: 16, padding: 12 }} disabled={busy || !canSubmit}>
            {busy ? "Submitting…" : "I have sent the funds"}
          </button>
        </form>

        <h3 style={{ margin: "28px 0 8px" }}>Deposit history</h3>
        {deps.length === 0 ? (
          <div className="card" style={{ padding: 30, textAlign: "center" }}>
            <p className="note" style={{ margin: 0 }}>No deposits yet.</p>
          </div>
        ) : (
          <div className="card">
            <div className="table-scroll">
              <table>
                <thead><tr><th>Asset</th><th>Amount</th><th>Network</th><th>Status</th><th style={{ textAlign: "right" }}>Date</th></tr></thead>
                <tbody>
                  {deps.map(d => (
                    <tr key={d.id}>
                      <td>{d.asset}</td>
                      <td>{d.amount}</td>
                      <td>{d.network}</td>
                      <td><span className={`badge ${d.status}`}>{d.status}</span></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
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
