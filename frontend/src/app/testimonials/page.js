"use client";
import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "withdraw", label: "Withdrawals" },
  { key: "earn", label: "Earn" },
  { key: "p2p", label: "P2P" },
  { key: "convert", label: "Convert" },
  { key: "general", label: "General" },
];

function Stars({ n }) {
  return (
    <div className="stars" aria-label={`${n} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "on" : ""}>★</span>
      ))}
    </div>
  );
}

export default function Testimonials() {
  const [items, setItems] = useState([]);
  const [allDemo, setAllDemo] = useState(false);
  const [filter, setFilter] = useState("all");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api("/api/products/testimonials/")
      .then((d) => {
        setItems(d.items || []);
        setAllDemo(Boolean(d.all_demo));
      })
      .catch((e) => setMsg(e.message));
  }, []);

  const shown = filter === "all" ? items : items.filter((t) => t.highlight === filter);

  return (
    <>
      <Nav />
      <div className="container page route-view">
        <h2>Testimonials</h2>
        <p className="note" style={{ marginBottom: 18 }}>
          What users say about depositing, holding and withdrawing on Vyne.
        </p>

        {allDemo && (
          <div className="card demo-banner">
            <b>Sample content.</b> These quotes are placeholders shipped with the
            demo, not verified customer feedback. They are labelled as such so they
            are never mistaken for real endorsements.
          </div>
        )}

        <div className="pill" style={{ marginTop: 14 }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? "on" : ""}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {msg && <div className="err">{msg}</div>}

        {!msg && shown.length === 0 && (
          <p className="note" style={{ marginTop: 18 }}>No testimonials in this category yet.</p>
        )}

        <div className="tgrid">
          {shown.map((t) => (
            <div key={t.id} className="card tcard">
              <Stars n={t.rating} />
              <p className="tquote">&ldquo;{t.quote}&rdquo;</p>
              <div className="tauthor">
                <div className="tavatar">{t.initials}</div>
                <div>
                  <b>{t.name}</b>
                  {t.role && <div className="note" style={{ marginTop: 2 }}>{t.role}</div>}
                </div>
              </div>
              {t.is_demo && <div className="tdemo">sample</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
