"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "../../components/Nav";
import { api, setAuth } from "../../lib/api";

// Shown in the left-hand brand panel. Purely decorative — nothing removed
// from the form, this is the modern split-panel marketing side.
const HIGHLIGHTS = [
  { t: "Spot & futures", d: "Trade BTC, ETH and 40+ pairs" },
  { t: "Deep liquidity", d: "Instant fills at market price" },
  { t: "Bank-grade security", d: "Verified KYC on every account" },
  { t: "Earn while you hold", d: "Flexible staking from day one" },
];

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setErr("");

    if (!form.username.trim() || !form.password) {
      setErr("Enter your username and password to continue.");
      return;
    }

    setBusy(true);
    try {
      const data = await api("/api/auth/login/", { method: "POST", body: form });
      setAuth(data);
      // Client-side navigation keeps the route transition animation intact,
      // where window.location would flash a blank document first.
      router.push(data?.user?.is_staff ? "/admin" : "/trade");
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />
      <div className="auth-wrap">
        <div className="auth-shell anim-up">
          {/* Brand panel — desktop only; it hides itself on phones in CSS. */}
          <aside className="auth-aside">
            <div className="auth-logo">
              <span className="mark">V</span> Vyne<span className="dot">.</span>
            </div>
            <h2>Trade crypto with confidence.</h2>
            <p>One account for spot, futures and staking — built for speed on every device.</p>
            <ul className="auth-points">
              {HIGHLIGHTS.map((h) => (
                <li key={h.t}>
                  <span className="tick" aria-hidden="true">✓</span>
                  <span>
                    <b>{h.t}</b>
                    <em>{h.d}</em>
                  </span>
                </li>
              ))}
            </ul>
            <div className="auth-stats">
              <div><b>40+</b><em>Markets</em></div>
              <div><b>24/7</b><em>Trading</em></div>
              <div><b>0.1%</b><em>Fees</em></div>
            </div>
          </aside>

          {/* Form panel — the card itself. */}
          <div className="auth-card">
            <div className="auth-brand">
              <div className="mark">V</div>
              <h2>Welcome back</h2>
              <p>Log in to continue to your portfolio.</p>
            </div>

            <label htmlFor="login-username">Username or email</label>
            <input
              id="login-username"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />

            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            {err && <div className="err shake" key={err} role="alert">{err}</div>}

            <button className={`btn btn-o${busy ? " btn-busy" : ""}`} disabled={busy}>
              {busy ? <><span className="spinner" />Signing in…</> : "Log in"}
            </button>

            <div className="auth-divider"><span>or</span></div>

            <p className="auth-foot">
              New to Vyne? <Link href="/register">Create an account</Link>
            </p>
          </div>
        </div>
      </div>
    </> 
  );
}
