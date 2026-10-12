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
  { href: "/markets", label: "Markets", icon: "📊" },
  { href: "/trade", label: "Spot", icon: "💹" },
  { href: "/futures", label: "Futures", icon: "🛡️" },
  { href: "/earn", label: "Earn", icon: "📈" },
  { href: "/convert", label: "Convert", icon: "🔄" },
  { href: "/p2p", label: "P2P", icon: "🤝" },
  { href: "/copy", label: "Copy", icon: "📋" },
  { href: "/bots", label: "Bots", icon: "🤖" },
  { href: "/assets", label: "Assets", icon: "💰" },
  { href: "/testimonials", label: "Testimonials", icon: "⭐" },
];

export default function Nav() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => setUser(getUser()), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
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

      {/* Bottom Navigation for Mobile */}
      <nav className="bottom-nav" aria-label="Mobile bottom navigation">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="bottom-nav-item"
            aria-label={l.label}
          >
            <span className="bottom-nav-icon">{l.icon}</span>
            <span className="bottom-nav-label">{l.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
