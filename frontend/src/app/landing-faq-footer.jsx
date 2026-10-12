"use client";
import Link from "next/link";
import { useState } from "react";

const FAQS = [
  ["Which markets can I trade?", "Vyne lists spot pairs quoted in USDT, including BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX and DOT."],
  ["How do deposits work?", "Each asset and network has a deposit address. After you send funds, submit the transaction ID and the request stays pending until it is confirmed and credited."],
  ["Are my funds safe in open orders?", "Yes. Placing a limit order reserves the required balance, and cancelling an order releases it immediately."],
  ["What fees apply?", "Spot trades use a 0.1% fee, charged on settlement and reflected in your order history."],
  ["Can I trade on mobile?", "Yes. The interface is responsive and works on phones, tablets and desktops."],
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="container section" style={{ paddingTop: 0, maxWidth: 820 }}>
      <div className="section-head anim-up">
        <h2>Frequently asked questions</h2>
      </div>
      <div className="card anim-up">
        {FAQS.map(([q, a], i) => (
          <div className={`faq-item ${open === i ? "open" : ""}`} key={q}>
            <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
              {q}<span className="caret">＋</span>
            </button>
            <div className="faq-a"><div><p>{a}</p></div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="container section" style={{ paddingTop: 0 }}>
      <div className="cta-band anim-up">
        <h2 style={{ fontSize: 28, letterSpacing: "-.6px" }}>Open your free account today</h2>
        <p className="note" style={{ maxWidth: 460, margin: "10px auto 0" }}>
          Sign up, fund your wallet and start trading in minutes.
        </p>
        <div className="hero-cta" style={{ justifyContent: "center" }}>
          <Link href="/register" className="btn btn-o" style={{ padding: "12px 22px" }}>Get started</Link>
          <Link href="/markets" className="btn btn-g" style={{ padding: "12px 22px" }}>View markets</Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const cols = [
    ["Trade", [["/markets", "Markets"], ["/trade", "Spot"], ["/futures", "Futures"], ["/convert", "Convert"]]],
    ["Earn", [["/earn", "Earn"], ["/copy", "Copy trading"], ["/bots", "Grid bots"], ["/p2p", "P2P"]]],
    ["Account", [["/assets", "Assets"], ["/deposit", "Deposit"], ["/withdraw", "Withdraw"], ["/testimonials", "Testimonials"], ["/settings", "Settings"]]],
  ];
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-cols">
          <div>
            <div className="logo" style={{ marginBottom: 8 }}>Vyne<span>.</span></div>
            <p className="note" style={{ marginTop: 0 }}>A complete crypto trading experience across spot, futures and P2P.</p>
          </div>
          {cols.map(([head, links]) => (
            <div key={head}>
              <h5>{head}</h5>
              {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Vyne. All rights reserved.</span>
          <span>Crypto involves risk. Only trade what you can afford.</span>
        </div>
      </div>
    </footer>
  );
}
