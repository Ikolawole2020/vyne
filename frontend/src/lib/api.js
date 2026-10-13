export const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const TOKEN_KEY = "vyne_token";
const REFRESH_KEY = "vyne_refresh";
const USER_KEY = "vyne_user";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function getUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
}
export function setAuth(data) {
  localStorage.setItem(TOKEN_KEY, data.access);
  // The refresh token is what keeps a session alive past the 60-minute access
  // lifetime. Dropping it meant every expired token was a hard logout -- the
  // admin console went blank after an hour with "Given token not valid for any
  // token type".
  if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = "/login";
}

// Merges fresh /auth/me fields into the cached user. Pages must call this
// whenever they refetch the profile -- the withdraw page used to read
// `kyc_status` from the copy written at login, so an admin approval never
// reached it and the KYC gate stayed shut forever.
export function patchUser(partial) {
  try {
    const cur = JSON.parse(localStorage.getItem(USER_KEY) || "null") || {};
    const next = { ...cur, ...partial };
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    return next;
  } catch {
    return partial;
  }
}

// A refresh already in flight. Every caller that 401s concurrently (the admin
// console fires six requests on load, then six more every 8s) awaits this one
// instead of racing: ROTATE_REFRESH_TOKENS means each refresh issues a new
// refresh token, so six parallel refreshes would leave five of them stale and
// burn through the `login` throttle bucket.
let refreshing = null;

async function refreshToken() {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error("no refresh token");
  const res = await fetch(`${API}/api/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) throw new Error("refresh rejected");
  const data = await res.json().catch(() => ({}));
  if (!data.access) throw new Error("refresh returned no access token");
  localStorage.setItem(TOKEN_KEY, data.access);
  if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
  return data.access;
}

export async function api(path, opts = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const send = () => fetch(`${API}${path}`, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let res = await send();

  // Access tokens expire after ACCESS_TOKEN_LIFETIME (60 min by default). Retry
  // once behind a fresh token rather than surfacing the raw JWT error to the
  // user. The block runs at most once per call, so it can never loop.
  if (res.status === 401 && token) {
    try {
      if (!refreshing) refreshing = refreshToken().finally(() => { refreshing = null; });
      headers.Authorization = `Bearer ${await refreshing}`;
      res = await send();
    } catch {
      // The refresh token is gone or expired (7-day lifetime): the session is
      // genuinely over, so sign out instead of retrying forever.
      logout();
      throw new Error("Your session expired. Please sign in again.");
    }
  }

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
