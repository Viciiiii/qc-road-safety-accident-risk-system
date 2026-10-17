import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import { useAuth } from "../auth/AuthContext";
import { apiGet, apiPatch, apiPost } from "../api/client";
import { useLanguage } from "../i18n/LanguageContext";

// Accounts live in PostgreSQL. Passwords are hashed by the server; a temporary
// password is generated there and shown here exactly oncefire.
function fromApi(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    disabled: u.disabled,
    temporary: u.must_change_password,
    lastLogin: u.last_login_at,
  };
}

function formatLastLogin(iso) {
  if (!iso) return "Never";
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`); // the server sends UTC
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const inputClass =
  "w-full text-sm bg-elevated border border-border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:border-accent";

function StatusPill({ account }) {
  const { disabled, temporary } = account;
  const style = disabled ? "bg-surface text-muted" : temporary ? "bg-med-bg text-med" : "bg-low-bg text-low";
  return (
    <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ${style}`}>
      {disabled ? "Disabled" : temporary ? "Temporary password" : "Active"}
    </span>
  );
}

function Actions({ account, isSelf, busy, onReset, onToggle }) {
  if (isSelf) return <span className="text-xs text-muted">You · change your password in Settings</span>;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onReset(account)}
        disabled={busy}
        className="text-xs font-medium text-accent bg-surface px-2.5 py-1.5 rounded-lg disabled:opacity-40"
      >
        Reset password
      </button>
      <button
        onClick={() => onToggle(account)}
        disabled={busy}
        className={`text-xs font-medium bg-surface px-2.5 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed ${
          account.disabled ? "text-low" : "text-high"
        }`}
      >
        {account.disabled ? "Enable" : "Disable"}
      </button>
    </div>
  );
}

function CardRow({ label, children, last }) {
  return (
    <div className={`flex justify-between items-center py-2.5 gap-3 ${last ? "" : "border-b border-border"}`}>
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  );
}

export default function Accounts() {
  const { t } = useLanguage();
  const { session } = useAuth();

  const [accounts, setAccounts] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null); // { message, email, password }
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet("/api/users")
      .then((rows) => !cancelled && setAccounts(rows.map(fromApi)))
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  function upsert(u) {
    const a = fromApi(u);
    setAccounts((prev) => (prev.some((x) => x.id === a.id) ? prev.map((x) => (x.id === a.id ? a : x)) : [...prev, a]));
  }

  function showNotice(n) {
    setNotice(n);
    setCopied(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setCreating(true);
    try {
      const res = await apiPost("/api/users", { name, email });
      upsert(res.user);
      showNotice({ message: `Account created for ${res.user.name}.`, email: res.user.email, password: res.temporary_password });
      setName("");
      setEmail("");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleReset(account) {
    setActionError("");
    setBusyId(account.id);
    try {
      const res = await apiPost(`/api/users/${account.id}/reset-password`);
      upsert(res.user);
      showNotice({ message: `Password reset for ${account.name}.`, email: account.email, password: res.temporary_password });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggle(account) {
    setActionError("");
    setBusyId(account.id);
    try {
      upsert(await apiPatch(`/api/users/${account.id}`, { disabled: !account.disabled }));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(notice.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable - the password is shown on screen to copy manually */
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight">{t("accounts_title")}</h1>
        <p className="text-sm text-muted mt-1">{t("accounts_subtitle")}</p>
      </div>

      <Card className="mb-5">
        <div className="text-[15px] font-semibold mb-1">Create staff account</div>
        <div className="text-xs text-muted mb-4">
          The system generates a temporary password. Give it to the staff member with their email; the
          password is case-sensitive. When they sign in, they're reminded to choose their own.
        </div>

        {formError && (
          <div className="text-[13px] text-high bg-high-bg rounded-lg px-3 py-2.5 mb-4">{formError}</div>
        )}

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <label className="block">
            <span className="text-xs text-muted">Full name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Dela Cruz"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs text-muted">Email (username)</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@qc.gov.ph"
              autoCapitalize="none"
              className={inputClass}
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create staff account"}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="text-[15px] font-semibold">All accounts</div>
        <div className="text-xs text-muted mb-4">
          Disabling an account or resetting its password signs that person out everywhere, right away.
          Admin accounts are created on the server (scripts/create_admin.py).
        </div>

        {notice && (
          <div className="bg-accent-soft rounded-lg px-3.5 py-3 mb-4 text-sm">
            <div className="font-semibold">{notice.message}</div>
            <div className="text-xs text-muted mt-1">
              Share these with the staff member. The password is shown only here, only once; it isn't
              stored anywhere readable.
            </div>
            <div className="mt-2 text-[13px]">
              <span className="text-muted">Email: </span>
              <span className="font-mono">{notice.email}</span>
              <span className="text-muted ml-4">Password: </span>
              <span className="font-mono font-semibold">{notice.password}</span>
            </div>
            <div className="flex gap-2 mt-2.5">
              <button onClick={copyPassword} className="text-xs font-medium text-accent bg-elevated px-2.5 py-1.5 rounded-lg">
                {copied ? "Copied" : "Copy password"}
              </button>
              <button onClick={() => setNotice(null)} className="text-xs font-medium text-muted bg-elevated px-2.5 py-1.5 rounded-lg">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {loadError && (
          <div className="text-[13px] text-high bg-high-bg rounded-lg px-3 py-2.5 mb-4">Couldn't load accounts ({loadError}).</div>
        )}

        {actionError && (
          <div className="text-[13px] text-high bg-high-bg rounded-lg px-3 py-2.5 mb-4">{actionError}</div>
        )}

        {/* Table: sm and up */}
        <table className="hidden sm:table w-full text-sm border-collapse">
          <thead>
            <tr>
              {["Name", "Email", "Role", "Status", "Last sign-in", ""].map((h, i) => (
                <th key={i} className="text-left font-medium text-muted text-xs pb-2.5 border-b border-border">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="py-3 border-b border-border last:border-0">{a.name}</td>
                <td className="py-3 border-b border-border last:border-0">{a.email}</td>
                <td className="py-3 border-b border-border last:border-0">{a.role === "admin" ? "Admin" : "Staff"}</td>
                <td className="py-3 border-b border-border last:border-0"><StatusPill account={a} /></td>
                <td className="py-3 border-b border-border last:border-0 text-muted text-xs">{formatLastLogin(a.lastLogin)}</td>
                <td className="py-3 border-b border-border last:border-0">
                  <Actions account={a} isSelf={a.id === session?.id} busy={busyId === a.id} onReset={handleReset} onToggle={handleToggle} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Stacked cards: below sm */}
        <div className="sm:hidden flex flex-col gap-2">
          {accounts.map((a) => (
            <div key={a.id} className="border border-border rounded-lg px-3 py-1">
              <CardRow label="Name">{a.name}</CardRow>
              <CardRow label="Email">{a.email}</CardRow>
              <CardRow label="Role">{a.role === "admin" ? "Admin" : "Staff"}</CardRow>
              <CardRow label="Status"><StatusPill account={a} /></CardRow>
              <CardRow label="Last sign-in">{formatLastLogin(a.lastLogin)}</CardRow>
              <div className="py-2.5">
                <Actions account={a} isSelf={a.id === session?.id} busy={busyId === a.id} onReset={handleReset} onToggle={handleToggle} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
