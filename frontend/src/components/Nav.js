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

// SVG Icons (professional)
function IconHome(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconMarket(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l3-4 3 3 4-6" />
    </svg>
  );
}

function IconAssets(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M15 9c-2 3-5 4-7 4" />
      <path d="M15 15c-2-3-5-4-7-4" />
    </svg>
  );
}

function IconTrade(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4M7 4L3 8M7 4l4 4" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}


const BOTTOM_LINKS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/markets", label: "Markets", icon: "markets" },
  { href: "/trade", label: "Trade", icon: "trade" },
  { href: "/assets", label: "Assets", icon: "assets" },
];

// Every real frontend page — nothing removed.
const MAIN_LINKS = [
  { href: "/", label: "Home" },
  { href: "/markets", label: "Markets" },
  { href: "/trade", label: "Trade" },
  { href: "/futures", label: "Futures" },
  { href: "/earn", label: "Earn" },
  { href: "/convert", label: "Convert" },
  { href: "/p2p", label: "P2P" },
  { href: "/copy", label: "Copy" },
  { href: "/bots", label: "Bots" },
  { href: "/assets", label: "Assets" },
  { href: "/testimonials", label: "Testimonials" },
  { href: "/deposit", label: "Deposit" },
  { href: "/withdraw", label: "Withdraw" },
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
          {MAIN_LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={close}>{l.label}</Link>
          ))}
          {user?.is_staff && <Link href="/admin" onClick={close}>Admin</Link>}
        </nav>

        <div className="nav-actions right">
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
        </div>
      </header>

      {/* Bottom Navigation for Mobile */}
      <nav className="bottom-nav" aria-label="Mobile bottom navigation">
        <div className="bottom-nav-container">
          {BOTTOM_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="bottom-nav-item"
              aria-label={l.label}
            >
              <span className="bottom-nav-icon">
                {l.icon === "home" && <IconHome />}
                {l.icon === "markets" && <IconMarket />}
                {l.icon === "trade" && <IconTrade />}
                {l.icon === "assets" && <IconAssets />}
              </span>
              <span className="bottom-nav-label">{l.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
