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

const LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/trade", label: "Spot" },
  { href: "/futures", label: "Futures" },
  { href: "/earn", label: "Earn" },
  { href: "/convert", label: "Convert" },
  { href: "/p2p", label: "P2P" },
  { href: "/copy", label: "Copy" },
  { href: "/bots", label: "Bots" },
  { href: "/assets", label: "Assets" },
];

export default function Nav() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => setUser(getUser()), []);

  // Dismiss the mobile menu with Escape while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={`nav${open ? " open" : ""}`}>
      <Link href="/" className="logo" onClick={close}>Vyne<span>.</span></Link>

      <nav id="primary-nav" className="nav-links" aria-label="Primary">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} onClick={close}>{l.label}</Link>
        ))}
        {user?.is_staff && <Link href="/admin" onClick={close}>Admin</Link>}
      </nav>

      <div className="nav-actions">
        <button
          type="button"
          className="nav-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="primary-nav"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        >
          {open ? "✕" : "☰"}
        </button>
        <ThemeToggle />
        {user ? (
          <>
            <Link href="/inbox" className="btn btn-g" onClick={close}>Alerts</Link>
            <Link href="/settings" className="nav-user" onClick={close}>{user.username} · {user.uid}</Link>
            <button className="btn btn-g" onClick={logout}>Log out</button>
          </>
        ) : (
          <>
            <Link href="/login" className="btn btn-g" onClick={close}>Log in</Link>
            <Link href="/register" className="btn btn-o" onClick={close}>Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
}
