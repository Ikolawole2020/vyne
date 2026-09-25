"use client";
import { useState } from "react";
import Link from "next/link";
import Nav from "../../components/Nav";
import { api, setAuth } from "../../lib/api";

export default function Register() {
  const [form, setForm] = useState({ username: "", email: "", password: "", referral_code: "" });
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const data = await api("/api/auth/register/", { method: "POST", body: form });
      setAuth(data);
      window.location.href = "/deposit";
    } catch (e) { setErr(e.message); }
  }
  return (
    <>
      <Nav />
      <form className="auth" onSubmit={submit}>
        <h2>Create Vyne account</h2>
        <label>Username</label>
        <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
        <label>Email</label>
        <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <label>Password</label>
        <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <label>Referral code (optional)</label>
        <input value={form.referral_code} onChange={e => setForm({ ...form, referral_code: e.target.value })} />
        {err && <div className="err">{err}</div>}
        <button className="btn btn-o" style={{ width: "100%", marginTop: 16, padding: 12 }}>Sign up</button>
        <p className="note">Already have an account? <Link href="/login">Log in</Link></p>
      </form>
    </>
  );
}
