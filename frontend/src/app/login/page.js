"use client";
import { useState } from "react";
import Link from "next/link";
import Nav from "../../components/Nav";
import { api, setAuth } from "../../lib/api";

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const data = await api("/api/auth/login/", { method: "POST", body: form });
      setAuth(data);
      window.location.href = data.user.is_staff ? "/admin" : "/trade";
    } catch (e) { setErr(e.message); }
  }
  return (
    <>
      <Nav />
      <form className="auth" onSubmit={submit}>
        <h2>Log in to Vyne</h2>
        <label>Username or email</label>
        <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
        <label>Password</label>
        <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        {err && <div className="err">{err}</div>}
        <button className="btn btn-o" style={{ width: "100%", marginTop: 16, padding: 12 }}>Log in</button>
        <p className="note">Demo user: demo / demo1234 · Admin: admin / admin1234</p>
        <p className="note">No account? <Link href="/register">Sign up</Link></p>
      </form>
    </>
  );
}
