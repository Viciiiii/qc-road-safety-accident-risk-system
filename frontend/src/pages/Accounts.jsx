import { useState } from "react";
import Card from "../components/ui/Card";
import { useAuth } from "../auth/AuthContext";
import { generateTempPassword } from "../auth/tempPassword";
import { useLanguage } from "../i18n/LanguageContext";

const inputClass =
  "w-full text-sm bg-elevated border border-border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:border-accent";

function StatusPill({ disabled }) {
  return (
    <span
      className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ${
        disabled ? "bg-surface text-muted" : "bg-low-bg text-low"
      }`}
    >
      {disabled ? "Disabled" : "Active"}
    </span>
  );
}

function Actions({ account, isSelf, onReset, onToggle }) {
  const cantDisable = isSelf && !account.disabled;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onReset(account)}
        className="text-xs font-medium text-accent bg-surface px-2.5 py-1.5 rounded-lg"
      >
        Reset password
      </button>
      <button
        onClick={() => onToggle(account)}
        disabled={cantDisable}
        title={cantDisable ? "You can't disable your own account" : undefined}
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
  const { session, accounts, createAccount, resetPassword, setAccountDisabled } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generateTempPassword());
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState(null); // { message, email, password }
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);

  function showNotice(n) {
    setNotice(n);
    setCopied(false);
  }

  function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    const result = createAccount({ name, email, password });
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    showNotice({
      message: `Account created for ${name.trim()}.`,
      email: email.trim(),
      password,
    });
    setName("");
    setEmail("");
    setPassword(generateTempPassword());
  }

  function handleReset(account) {
    setActionError("");
    const newPassword = generateTempPassword();
    resetPassword(account.id, newPassword);
    showNotice({
      message: `Password reset for ${account.name}.`,
      email: account.email,
      password: newPassword,
    });
  }

  function handleToggle(account) {
    setActionError("");
    const result = setAccountDisabled(account.id, !account.disabled);
    if (!result.ok) setActionError(result.error);
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
          Give the staff member their email and temporary password. Both are case-sensitive, so
          they must be typed exactly as shown.
        </div>

        {formError && (
          <div className="text-[13px] text-high bg-high-bg rounded-lg px-3 py-2.5 mb-4">{formError}</div>
        )}

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
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

          <label className="block">
            <span className="text-xs text-muted">Temporary password</span>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoCapitalize="none"
                className={`${inputClass} font-mono`}
              />
              <button
                type="button"
                onClick={() => setPassword(generateTempPassword())}
                className="text-xs font-medium text-accent bg-surface px-3 rounded-lg mt-1 flex-none"
              >
                Generate
              </button>
            </div>
          </label>

          <div className="md:col-span-3">
            <button type="submit" className="bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
              Create staff account
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="text-[15px] font-semibold">All accounts</div>
        <div className="text-xs text-muted mb-4">
          Disabled accounts can't sign in until re-enabled. Resetting a password signs nobody out, but
          the old password stops working immediately.
        </div>

        {notice && (
          <div className="bg-accent-soft rounded-lg px-3.5 py-3 mb-4 text-sm">
            <div className="font-semibold">{notice.message}</div>
            <div className="text-xs text-muted mt-1">
              Share these with the staff member — the password is only shown here once.
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

        {actionError && (
          <div className="text-[13px] text-high bg-high-bg rounded-lg px-3 py-2.5 mb-4">{actionError}</div>
        )}

        {/* Table: sm and up */}
        <table className="hidden sm:table w-full text-sm border-collapse">
          <thead>
            <tr>
              {["Name", "Email", "Role", "Status", ""].map((h, i) => (
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
                <td className="py-3 border-b border-border last:border-0"><StatusPill disabled={a.disabled} /></td>
                <td className="py-3 border-b border-border last:border-0">
                  <Actions account={a} isSelf={a.email === session?.email} onReset={handleReset} onToggle={handleToggle} />
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
              <CardRow label="Status"><StatusPill disabled={a.disabled} /></CardRow>
              <div className="py-2.5">
                <Actions account={a} isSelf={a.email === session?.email} onReset={handleReset} onToggle={handleToggle} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
