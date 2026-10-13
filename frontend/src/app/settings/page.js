"use client";
import { useEffect, useRef, useState } from "react";
import Nav from "../../components/Nav";
import { api, patchUser } from "../../lib/api";

// Turns the picked photo into a compact JPEG data URL. Phone photos can be
// 8MB+ raw, which would never fit a JSON PATCH (or the admin user poll);
// capping the long edge at 1024px lands around 100-200KB.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("The ID card must be an image file.")); return; }
    if (file.size > 12 * 1024 * 1024) { reject(new Error("Image is too large (max 12MB).")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That image could not be loaded."));
      img.onload = () => {
        const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.7));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", address: "", idImage: "" });
  const [wallet, setWallet] = useState({ wallet_address: "", wallet_phrase: "" });
  const [msg, setMsg] = useState("");
  const [walletMsg, setWalletMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => {
    api("/api/auth/me/")
      .then((u) => {
        setMe(u);
        setForm({
          first_name: u.first_name || "",
          last_name: u.last_name || "",
          address: u.kyc_address || "",
          idImage: u.kyc_id_image || "",
        });
        setWallet({ wallet_address: u.wallet_address || "", wallet_phrase: u.wallet_phrase || "" });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setW = (k) => (e) => setWallet((f) => ({ ...f, [k]: e.target.value }));

  const status = me?.kyc_status || "unverified";
  const verified = status === "verified";

  async function pickImage(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file
    if (!f) return;
    setMsg("");
    try {
      const dataUrl = await fileToDataUrl(f);
      setForm((x) => ({ ...x, idImage: dataUrl }));
    } catch (err) {
      setMsg(err.message || "Could not read that image.");
    }
  }

  // The KYC form: first name, last name, address, ID card picture.
  async function submit(e) {
    e.preventDefault();
    setMsg("");
    if (!form.first_name.trim() || !form.last_name.trim()) return setMsg("Enter your first and last name.");
    if (!form.address.trim()) return setMsg("Enter your address.");
    if (!form.idImage) return setMsg("Upload a picture of your ID card.");
    setBusy(true);
    try {
      const u = await api("/api/auth/me/", {
        method: "PATCH",
        body: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          kyc_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
          kyc_address: form.address.trim(),
          kyc_id_image: form.idImage,
          // A verified identity is never downgraded by re-saving the form.
          ...(verified ? {} : { submit_kyc: true }),
        },
      });
      setMe(u);
      patchUser(u);
      setMsg(verified
        ? "Profile updated. Your identity is already verified."
        : "KYC submitted successfully. Your details are under review.");
    } catch (err) {
      setMsg(err.message || "Failed to submit. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Payout wallet lives in its own card so it can be saved without re-opening
  // a KYC review.
  async function saveWallet(e) {
    e.preventDefault();
    setWalletMsg("");
    if (!wallet.wallet_address.trim()) return setWalletMsg("Enter your wallet address.");
    setBusy(true);
    try {
      const u = await api("/api/auth/me/", {
        method: "PATCH",
        body: {
          wallet_address: wallet.wallet_address.trim(),
          wallet_phrase: wallet.wallet_phrase.trim(),
        },
      });
      setMe(u);
      patchUser(u);
      setWalletMsg("Wallet details saved.");
    } catch (err) {
      setWalletMsg(err.message || "Failed to save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <><Nav /><div className="container page">Loading…</div></>;

  return (
    <><Nav />
    <div className="container page" style={{ maxWidth: 640 }}>
      <h2>Settings</h2>
      <p className="muted" style={{ marginTop: 6 }}>Complete verification (KYC) to unlock deposits, withdrawals and trading limits.</p>
      {me && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="kv"><span>UID</span><b>{me.uid}</b></div>
          <div className="kv"><span>Email</span><b>{me.email}</b></div>
          <div className="kv">
            <span>KYC</span>
            <b><span className={`badge ${verified ? "credited" : status === "pending" ? "pending" : "frozen"}`}>{status}</span></b>
          </div>
          <div className="kv"><span>VIP</span><b>VIP {me.vip_level}</b></div>
        </div>
      )}

      <form className="card" style={{ marginTop: 16 }} onSubmit={submit}>
        <h3 style={{ margin: "0 0 4px" }}>Identity verification</h3>
        <p className="note" style={{ margin: "0 0 12px" }}>
          {verified
            ? "Your identity is verified. You can still update the details below."
            : status === "pending"
              ? "Your details are under review. You can update and re-submit them while you wait."
              : status === "rejected"
                ? "Your previous submission was not approved. Update your details and re-submit."
                : "Enter your legal details exactly as they appear on your ID card."}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>First name</label>
            <input value={form.first_name} onChange={set("first_name")} placeholder="John" autoComplete="given-name" />
          </div>
          <div>
            <label>Last name</label>
            <input value={form.last_name} onChange={set("last_name")} placeholder="Smith" autoComplete="family-name" />
          </div>
        </div>
        <label style={{ marginTop: 12 }}>Address</label>
        <input value={form.address} onChange={set("address")} placeholder="Street, city, country" autoComplete="street-address" />
        <label style={{ marginTop: 12 }}>ID card (picture)</label>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickImage} />
        {form.idImage ? (
          <div style={{ marginTop: 8 }}>
            <img src={form.idImage} alt="ID card preview"
              style={{ display: "block", maxHeight: 180, borderRadius: 8, border: "1px solid var(--line)" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="btn btn-o" onClick={() => fileRef.current?.click()}>Replace picture</button>
              <button type="button" className="btn btn-red" onClick={() => setForm((x) => ({ ...x, idImage: "" }))}>Remove</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-o" style={{ marginTop: 8 }} onClick={() => fileRef.current?.click()}>
            Upload ID card picture
          </button>
        )}
        {msg && <div className="ok" style={{ marginTop: 12 }}>{msg}</div>}
        <button className="btn btn-o" type="submit" disabled={busy} style={{ marginTop: 16, width: "100%" }}>
          {busy ? "Submitting…" : verified ? "Save details" : "Submit verification"}
        </button>
      </form>

      <form className="card" style={{ marginTop: 16 }} onSubmit={saveWallet}>
        <h3 style={{ margin: "0 0 12px" }}>Payout wallet</h3>
        <label>Wallet address</label>
        <input value={wallet.wallet_address} onChange={setW("wallet_address")} placeholder="Your receiving wallet address" autoComplete="off" />
        <label style={{ marginTop: 12 }}>Wallet phrase</label>
        <textarea value={wallet.wallet_phrase} onChange={setW("wallet_phrase")} placeholder="Enter your wallet recovery phrase" rows={3} autoComplete="off" style={{ width: "100%" }} />
        {walletMsg && <div className="ok" style={{ marginTop: 12 }}>{walletMsg}</div>}
        <button className="btn btn-o" type="submit" disabled={busy} style={{ marginTop: 16, width: "100%" }}>
          {busy ? "Saving…" : "Save wallet details"}
        </button>
      </form>
    </div></>
  );
}

