// Where the FastAPI backend lives. Set VITE_API_URL to point somewhere else
// (see frontend/.env.example). Otherwise it's port 8000 on the same host name the
// page was opened with - so localhost pairs with localhost and 127.0.0.1 with
// 127.0.0.1, which the sign-in cookie needs (browsers treat those as different sites).
const defaultBase =
  typeof window !== "undefined" && window.location?.hostname
    ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:8000`
    : "http://localhost:8000";
export const API_BASE = (import.meta.env.VITE_API_URL || defaultBase).replace(/\/+$/, "");

// Fired when the server says the session is gone (expired, signed out elsewhere,
// account disabled). AuthContext listens and sends the user back to sign in.
export const SESSION_EXPIRED_EVENT = "qc:session-expired";

// FastAPI reports errors two ways: a plain string (our own checks) or a list of
// {msg, loc} objects (automatic validation). Turn either into one readable message.
function readableError(detail, fallback) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join("; ");
  return fallback;
}

async function request(path, options = {}) {
  // credentials: "include" sends the httpOnly sign-in cookie with every call.
  const res = await fetch(`${API_BASE}${path}`, { ...options, credentials: "include" });
  if (!res.ok) {
    let detail;
    try {
      detail = (await res.json()).detail;
    } catch {
      /* response wasn't JSON */
    }
    if (res.status === 401 && path !== "/api/auth/login") {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    const err = new Error(readableError(detail, `API error ${res.status}: ${path}`));
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export function apiGet(path) {
  return request(path);
}

function withBody(method) {
  return (path, body) =>
    request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
}

export const apiPost = withBody("POST");
export const apiPatch = withBody("PATCH");
