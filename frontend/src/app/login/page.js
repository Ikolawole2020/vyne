"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "../../components/Nav";
import { api, setAuth } from "../../lib/api";

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
        <form className="auth anim-up" onSubmit={submit} noValidate>
          <div className="auth-brand">
            <div className="mark">V</div>
            <h2>Log in to Vyne</h2>
            <p>Access your portfolio, orders and transfers.</p>
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

          <p className="auth-foot">
            New to Vyne? <Link href="/register">Create an account</Link>
          </p>
        </form>
      </div>
    </>
  );
}
