"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

export default function P2P() {
  const [side, setSide] = useState("sell");
  const [ads, setAds] = useState(null); // null === still loading
  const [orders, setOrders] = useState([]);
  const [amount, setAmount] = useState("100");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const [taking, setTaking] = useState(null);

  async function load() {
    const list = await api(`/api/products/p2p/ads/?side=${side}`);
    setAds(Array.isArray(list) ? list : []);
    try {
      const mine = await api("/api/products/p2p/orders/");
      setOrders(Array.isArray(mine) ? mine : []);
    } catch {
      /* Orders are secondary — never let them block the order book. */
    }
  }

  useEffect(() => {
    setMsg("");
    setOk("");
    setAds(null);
    load().catch((e) => {
      setMsg(e.message);
      setAds([]);
    });
  }, [side]);

  async function take(a) {
    if (taking) return;
    setMsg("");
    setOk("");

    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      setMsg("Enter an amount greater than zero.");
      return;
    }
    if (value < Number(a.min_limit) || value > Number(a.max_limit)) {
      setMsg(`Amount must be between ${a.min_limit} and ${a.max_limit} ${a.fiat}.`);
      return;
    }

    setTaking(a.id);
    try {
      await api(`/api/products/p2p/ads/${a.id}/take/`, {
        method: "POST",
        body: { amount_fiat: amount },
      });
      setOk(`Order placed — ${amount} ${a.fiat} for ${a.asset}. It is held in escrow until released.`);
      await load();
    } catch (e) {
      setMsg(e.message);
    }
    setTaking(null);
  }

  const counterpart = side === "sell" ? "sellers" : "buyers";

  return (
    <><Nav />
    <div className="container page">
      <h2>P2P</h2>
      <p className="note">
        Buy and sell USDT directly with other users in USD. Funds stay in escrow until the seller confirms payment.
      </p>
      <div className="pill" style={{ margin: "14px 0" }}>
        <button className={side==="sell"?"on":""} onClick={()=>setSide("sell")}>Buy USDT</button>
        <button className={side==="buy"?"on":""} onClick={()=>setSide("buy")}>Sell USDT</button>
      </div>

      {msg && <div className="err shake" key={msg} role="alert">{msg}</div>}
      {ok && <div className="ok msg-in" key={ok} role="status">{ok}</div>}

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Advertiser</th><th>Price</th><th>Limit</th>
                <th>Method</th><th>Available</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ads === null && [0, 1, 2].map((i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={6}><div className="sk w80" /></td>
                </tr>
              ))}

              {ads && ads.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">No {counterpart} are taking orders right now.</div>
                  </td>
                </tr>
              )}

              {ads && ads.map((a, i) => {
                const busy = taking === a.id;
                return (
                  <tr key={a.id} className="row-in" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                    <td>{a.username}</td>
                    <td><b>{Number(a.price).toLocaleString()} {a.fiat}</b></td>
                    <td>{a.min_limit} – {a.max_limit}</td>
                    <td>{a.method}</td>
                    <td>{a.available} {a.asset}</td>
                    <td>
                      <input
                        style={{ width: 110, marginRight: 8 }}
                        aria-label="Amount"
                        value={amount}
                        onChange={e=>setAmount(e.target.value)}
                      />
                      <button
                        className={`btn btn-o${busy ? " btn-busy" : ""}`}
                        disabled={busy}
                        onClick={()=>take(a)}
                      >
                        {busy ? <><span className="spinner" />Placing…</> : "Take"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <h3 style={{ margin: "24px 0 8px" }}>My P2P orders</h3>
      <div className="card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>Fiat</th><th>Crypto</th><th>Status</th></tr></thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={3}><div className="empty">You have no P2P orders yet.</div></td></tr>
              ) : (
                orders.map((o, i) => (
                  <tr key={o.id} className="row-in" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                    <td>{o.amount_fiat}</td>
                    <td>{o.amount_asset}</td>
                    <td><span className="badge pending">{o.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div></>
  );
}
