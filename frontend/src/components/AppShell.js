"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const WELCOME_KEY = "vyne_welcome";
const WELCOME_TTL = 24 * 60 * 60 * 1000;

/**
 * Thin indeterminate bar pinned to the top of the viewport while a route is
 * resolving. Remounting the fill (via `key`) restarts the animation on every
 * navigation, so back-to-back transitions each get their own sweep.
 */
function RouteProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState("idle");
  const [nav, setNav] = useState(0);
  const timer = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    // Don't animate on the very first paint — the page is already there.
    if (first.current) {
      first.current = false;
      return;
    }
    setNav((n) => n + 1);
    setPhase("loading");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPhase("done"), 620);
    return () => window.clearTimeout(timer.current);
  }, [pathname]);

  return (
    <div className={`route-bar route-bar--${phase}`} aria-hidden="true">
      <span className="route-bar-fill" key={nav} />
    </div>
  );
}

/**
 * One-shot greeting surfaced on the first page load after a signup. Written to
 * localStorage by the register page and consumed (then cleared) here, so it
 * appears once rather than on every navigation.
 */
function WelcomeToast() {
  const [state, setState] = useState({ name: null, closing: false });

  useEffect(() => {
    let raw = null;
    try {
      raw = window.localStorage.getItem(WELCOME_KEY);
      window.localStorage.removeItem(WELCOME_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    const name = parsed && typeof parsed.username === "string" ? parsed.username : "";
    const at = Number((parsed && parsed.at) || 0);
    if (!name || !at || Date.now() - at > WELCOME_TTL) return;

    setState({ name, closing: false });
  }, []);

  const close = () => {
    setState((s) => ({ ...s, closing: true }));
    window.setTimeout(() => setState({ name: null, closing: false }), 220);
  };

  if (!state.name) return null;

  return (
    <aside className={`welcome${state.closing ? " closing" : ""}`} role="status">
      <button type="button" className="welcome-x" onClick={close} aria-label="Dismiss welcome message">
        ✕
      </button>
      <div className="welcome-badge">✓</div>
      <h4>Welcome to Vyne, {state.name}</h4>
      <p>Your account is ready. Fund your wallet, then place your first trade.</p>
      <div className="welcome-actions">
        <Link href="/deposit" className="btn btn-o" onClick={close}>Fund account</Link>
        <Link href="/markets" className="btn btn-g" onClick={close}>Browse markets</Link>
      </div>
    </aside>
  );
}

export default function AppShell({ children }) {
  const pathname = usePathname();

  return (
    <>
      <RouteProgress />
      <WelcomeToast />
      {/* Keyed on the path so each route mounts fresh and replays the entrance. */}
      <div className="route-view" key={pathname}>
        {children}
      </div>
    </>
  );
}
