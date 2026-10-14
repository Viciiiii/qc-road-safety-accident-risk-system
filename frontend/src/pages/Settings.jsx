import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { useLanguage } from "../i18n/LanguageContext";

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-border last:border-0 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

const fieldClass =
  "w-full text-sm bg-elevated border border-border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:border-accent";

function ChangePassword() {
  const { session, changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setDone(false);
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    const result = await changePassword(current, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
  }

  return (
    <div id="password" className="scroll-mt-6">
    <Card className="mb-5">
      <div className="text-[15px] font-semibold mb-1">Change password</div>
      <div className="text-xs text-muted mb-4">
        {session?.mustChangePassword
          ? "You're signed in with a temporary password from your administrator. Choose your own below."
          : "At least 8 characters, with a letter and a number. Other browsers you're signed in on will be signed out."}
      </div>
      {error && <div className="text-[13px] text-high bg-high-bg rounded-lg px-3 py-2.5 mb-4">{error}</div>}
      {done && (
        <div className="text-[13px] text-low bg-low-bg rounded-lg px-3 py-2.5 mb-4">
          Password changed. Use your new password next time you sign in.
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <label className="block">
          <span className="text-xs text-muted">{session?.mustChangePassword ? "Temporary password" : "Current password"}</span>
          <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password" className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-muted">New password</span>
          <input type="password" required value={next} onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password" className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Confirm new password</span>
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password" className={fieldClass} />
        </label>
        <div className="md:col-span-3">
          <button type="submit" disabled={busy}
            className="bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-60">
            {busy ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </Card>
    </div>
  );
}

export default function Settings() {
  const { session, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, changeLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const { hash } = useLocation();

  // "Create password" in the temporary-password notice links to /settings#password.
  useEffect(() => {
    if (hash === "#password") document.getElementById("password")?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight">{t("settings_title")}</h1>
        <p className="text-sm text-muted mt-1">{t("settings_subtitle")}</p>
      </div>

      <Card className="mb-5">
        <div className="text-[15px] font-semibold mb-1">{t("settings_appearance")}</div>

        <div className="flex justify-between items-center py-2.5 border-b border-border text-sm">
          <span className="text-muted">{t("settings_darkMode")}</span>
          <button
            role="switch"
            aria-checked={theme === "dark"}
            onClick={toggleTheme}
            className={`w-11 h-6 rounded-full relative transition-colors ${
              theme === "dark" ? "bg-accent" : "bg-surface"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-elevated shadow-sm transition-transform ${
                theme === "dark" ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex justify-between items-center py-2.5 text-sm">
          <span className="text-muted">{t("settings_language")}</span>
          <div className="flex bg-surface rounded-lg p-[3px] gap-0.5">
            {[
              { code: "en", label: "English" },
              { code: "tl", label: "Tagalog" },
            ].map((opt) => (
              <button
                key={opt.code}
                onClick={() => changeLanguage(opt.code)}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  language === opt.code
                    ? "bg-elevated font-semibold shadow-sm"
                    : "text-muted font-medium"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mb-5">
        <div className="text-[15px] font-semibold mb-1">Model status</div>
        <Row label="Trained on" value="QC road crash data, 2022–2025 (129k records)" />
        <Row label="Models active" value="Random Forest, SVM, Naive Bayes" />
        <Row label="Retraining" value="Manual, periodic (offline)" />
        <Row label="Last trained" value="Oct 14, 2026" />
      </Card>

      <ChangePassword />

      <Card>
        <div className="text-[15px] font-semibold mb-1">Account</div>
        <Row label="Name" value={session?.name || "—"} />
        <Row label="Email" value={session?.email || "—"} />
        <Row label="Role" value={session?.role === "admin" ? "Admin" : "Staff"} />

        <button
          onClick={handleLogout}
          className="mt-4 text-sm font-semibold text-high bg-high-bg px-4 py-2 rounded-lg"
        >
          {t("settings_logout")}
        </button>
      </Card>
    </>
  );
}
