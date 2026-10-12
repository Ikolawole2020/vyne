export const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vyne_token");
}
export function getUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("vyne_user") || "null"); } catch { return null; }
}
export function setAuth(data) {
  localStorage.setItem("vyne_token", data.access);
  localStorage.setItem("vyne_user", JSON.stringify(data.user));
}
export function logout() {
  localStorage.removeItem("vyne_token");
  localStorage.removeItem("vyne_user");
  window.location.href = "/login";
}

export async function api(path, opts = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || JSON.stringify(data) || "Request failed");
  return data;
}

// Polls the price-feed tick endpoint.
//
// Unlike `api()`, this never throws and never returns an error body. The tick
// endpoint is throttled, so a 429 returns {"detail": "..."} — piping that into
// setMarkets() would replace the markets array with an object and crash every
// page that renders it. Callers get `null` instead and keep their last good data.
export async function fetchTick() {
  try {
    const res = await fetch(`${API}/api/trading/tick/`, { method: "POST" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}
