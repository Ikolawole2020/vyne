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
// SVG Icons (professional, no external dependencies)
function IconMarkets(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l3-4 3 3 4-6" />
    </svg>
  );
}

function IconSpot(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5" />
      <path d="M4 12l4-4 3 3 5-6" />
      <path d="M17 8h3M17 12h3" />
    </svg>
  );
}

function IconFutures(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M12 12l-4 4M12 15h8" />
    </svg>
  );
}

function IconEarn(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

function IconConvert(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M8 11v6M12 11v6M16 11v6" />
      <circle cx="9" cy="14" r="1.5" fill="currentColor" />
      <circle cx="15" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconP2P(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11V6a2 2 0 00-2-2H5a2 2 0 00-2 2v11" />
      <path d="M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </svg>
  );
}

function IconCopy(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function IconBots(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M2 16c2-2 4-4 8-4s6 2 8 4" />
      <path d="M8 12h8" />
      <path d="M8 16h4" />
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

function IconTestimonials(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

const ICONS = { markets: IconMarkets, spot: IconSpot, futures: IconFutures, earn: IconEarn, convert: IconConvert, p2p: IconP2P, copy: IconCopy, bots: IconBots, assets: IconAssets, testimonials: IconTestimonials };



const LINKS = [
  { href: "/markets", label: "Markets", icon: "markets" },
  { href: "/trade", label: "Spot", icon: "spot" },
  { href: "/futures", label: "Futures", icon: "futures" },
  { href: "/earn", label: "Earn", icon: "earn" },
  { href: "/convert", label: "Convert", icon: "convert" },
  { href: "/p2p", label: "P2P", icon: "p2p" },
  { href: "/copy", label: "Copy", icon: "copy" },
  { href: "/bots", label: "Bots", icon: "bots" },
  { href: "/assets", label: "Assets", icon: "assets" },
  { href: "/testimonials", label: "Testimonials", icon: "testimonials" },
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
        <div className="bottom-nav-container">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="bottom-nav-item"
              aria-label={l.label}
            >
              <span className="bottom-nav-icon">
                <ICONS[l.icon] />
              </span>
              <span className="bottom-nav-label">{l.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
