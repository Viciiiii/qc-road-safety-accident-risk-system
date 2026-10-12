// Where the FastAPI backend lives. Set VITE_API_URL to point somewhere else
// (see frontend/.env.example); otherwise the local dev server is used.
export const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");

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
