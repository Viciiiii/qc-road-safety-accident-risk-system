// Base URL for the FastAPI backend. Hardcoded for local dev - once this gets
// deployed, this should come from an env variable instead (Vite exposes those
// via import.meta.env.VITE_API_URL).
const API_BASE = "http://localhost:8000";

// FastAPI reports errors two ways: a plain string (our own checks) or a list of
// {msg, loc} objects (automatic validation). Turn either into one readable message.
function readableError(detail, fallback) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join("; ");
  return fallback;
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail;
    try {
      detail = (await res.json()).detail;
    } catch {
      /* response wasn't JSON */
    }
    throw new Error(readableError(detail, `API error ${res.status}: ${path}`));
  }
  return res.json();
}
