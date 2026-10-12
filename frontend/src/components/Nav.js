"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

// Colorful gradient SVG icons for bottom nav
function IconHome(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="g-home" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0b90b" />
          <stop offset="100%" stopColor="#ff7a18" />
        </linearGradient>
      </defs>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="url(#g-home)" fill="rgba(240,185,11,.18)" />
      <polyline points="9 22 9 12 15 12 15 22" stroke="url(#g-home)" />
    </svg>
  );
}

function IconMarket(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="g-market" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0ecb81" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path d="M3 3v18h18" stroke="#848e9c" />
      <path d="M7 14l3-4 3 3 4-6" stroke="url(#g-market)" />
      <circle cx="17" cy="8" r="1.6" fill="#0ecb81" stroke="none" />
    </svg>
  );
}

function IconAssets(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="g-assets" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect x="2" y="5" width="20" height="14" rx="3" stroke="url(#g-assets)" fill="rgba(168,85,247,.16)" />
      <line x1="2" y1="10" x2="22" y2="10" stroke="url(#g-assets)" />
      <circle cx="18.5" cy="14.5" r="1.4" fill="#ec4899" stroke="none" />
    </svg>
  );
}

function IconTrade(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="g-trade" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0ecb81" />
        </linearGradient>
      </defs>
      <path d="M7 16V4M7 4L3 8M7 4l4 4" stroke="url(#g-trade)" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" stroke="#f0b90b" />
    </svg>
  );
}


function IconSettings(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="g-settings" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="3.2" stroke="url(#g-settings)" fill="rgba(56,189,248,.16)" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="url(#g-settings)" />
    </svg>
  );
}


const BOTTOM_LINKS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/markets", label: "Markets", icon: "markets" },
  { href: "/trade", label: "Trade", icon: "trade" },
  { href: "/assets", label: "Assets", icon: "assets" },
  { href: "/settings", label: "Settings", icon: "settings" },
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
  { href: "/settings", label: "Settings" },
];

// Highlights the nav link for the page you're on. "/" matches only the
// landing page exactly; every other link also lights up for pages nested
// under it (e.g. /trade/BTCUSDT keeps "Trade" active).
function isActive(href, pathname) {
  if (!pathname) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export default function Nav() {
  const [user, setUser] = useState(null);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setUser(getUser()); setMounted(true); }, []);

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
          {MAIN_LINKS.map((l) => {
            const active = isActive(l.href, pathname);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
                onClick={close}
              >
                {l.label}
              </Link>
            );
          })}
          {user?.is_staff && (
            <Link
              href="/admin"
              className={isActive("/admin", pathname) ? "active" : undefined}
              aria-current={isActive("/admin", pathname) ? "page" : undefined}
              onClick={close}
            >
              Admin
            </Link>
          )}
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

      {/* Bottom Navigation for Mobile — portalled to body so the
          .route-view entrance transform can't break position:fixed. */}
      {mounted && createPortal(
      <nav className="bottom-nav" aria-label="Mobile bottom navigation">
        <div className="bottom-nav-container">
          {BOTTOM_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`bottom-nav-item${isActive(l.href, pathname) ? " active" : ""}`}
              aria-current={isActive(l.href, pathname) ? "page" : undefined}
              aria-label={l.label}
            >
              <span className="bottom-nav-icon">
                {l.icon === "home" && <IconHome />}
                {l.icon === "markets" && <IconMarket />}
                {l.icon === "trade" && <IconTrade />}
                {l.icon === "assets" && <IconAssets />}
                {l.icon === "settings" && <IconSettings />}
              </span>
              <span className="bottom-nav-label">{l.label}</span>
            </Link>
          ))}
        </div>
      </nav>,
      document.body
      )}
    </>
  );
}
