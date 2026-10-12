"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "../../components/Nav";
import { api, setAuth } from "../../lib/api";

// Mirrors RegisterSerializer's `min_length=6` so the hint matches the server.
const MIN_PASSWORD = 6;
const WELCOME_KEY = "vyne_welcome";

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", referral_code: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function validate() {
    if (!form.username.trim()) return "Choose a username.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Enter a valid email address.";
    if (form.password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
    return "";
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setErr("");

    const problem = validate();
    if (problem) {
      setErr(problem);
      return;
    }

    setBusy(true);
    try {
      const data = await api("/api/auth/register/", { method: "POST", body: form });
      setAuth(data);
      // Handed to AppShell's welcome greeting, which reads and clears it once.
      try {
        window.localStorage.setItem(
          WELCOME_KEY,
          JSON.stringify({ username: data?.user?.username || form.username.trim(), at: Date.now() }),
        );
      } catch {}
      router.push("/deposit");
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />
      <div className="auth-wrap">
        <form className="auth anim-up" onSubmit={submit} noValidate>
          <div className="auth-brand">
            <div className="mark">V</div>
            <h2>Create your account</h2>
            <p>Set up in under a minute. No deposit required to start.</p>
          </div>

          <label htmlFor="reg-username">Username</label>
          <input
            id="reg-username"
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />

          <label htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <label htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <p className="auth-hint">At least {MIN_PASSWORD} characters.</p>

          <label htmlFor="reg-referral">Referral code (optional)</label>
          <input
            id="reg-referral"
            autoComplete="off"
            value={form.referral_code}
            onChange={(e) => setForm({ ...form, referral_code: e.target.value })}
          />

          {err && <div className="err shake" key={err} role="alert">{err}</div>}

          <button className={`btn btn-o${busy ? " btn-busy" : ""}`} disabled={busy}>
            {busy ? <><span className="spinner" />Creating account…</> : "Sign up"}
          </button>

          <p className="auth-foot">
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        </form>
      </div>
    </>
  );
}
