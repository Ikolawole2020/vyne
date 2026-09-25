"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getUser, logout } from "../lib/api";

function ThemeToggle() {
  const [theme, setTheme] = useState("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") || "dark");
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("vyne_theme", next); } catch (e) {}
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      <span className="ico" key={theme}>{mounted && theme === "light" ? "☀" : "☾"}</span>
    </button>
  );
}

export default function Nav() {
  const [user, setUser] = useState(null);
  useEffect(() => setUser(getUser()), []);
  return (
    <header className="nav">
      <Link href="/" className="logo">Vyne<span>.</span></Link>
      <nav className="nav-links">
        <Link href="/markets">Markets</Link>
        <Link href="/trade">Spot</Link>
        <Link href="/futures">Futures</Link>
        <Link href="/earn">Earn</Link>
        <Link href="/convert">Convert</Link>
        <Link href="/p2p">P2P</Link>
        <Link href="/copy">Copy</Link>
        <Link href="/bots">Bots</Link>
        <Link href="/assets">Assets</Link>
        {user?.is_staff && <Link href="/admin">Admin</Link>}
      </nav>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <ThemeToggle />
        {user ? (
          <>
            <Link href="/inbox" className="btn btn-g">Alerts</Link>
            <Link href="/settings" style={{ fontSize: 13, color: "var(--muted)" }}>{user.username} · {user.uid}</Link>
            <button className="btn btn-g" onClick={logout}>Log out</button>
          </>
        ) : (
          <>
            <Link href="/login" className="btn btn-g">Log in</Link>
            <Link href="/register" className="btn btn-o">Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
}
