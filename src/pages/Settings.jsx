import { useNavigate } from "react-router-dom";
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

export default function Settings() {
  const { session, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, changeLanguage, t } = useLanguage();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
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
        <Row label="Last trained" value="Sep 23, 2026" />
      </Card>

      <Card>
        <div className="text-[15px] font-semibold mb-1">Account</div>
        <Row label="Name" value={session?.name || "—"} />
        <Row label="Email" value={session?.email || "—"} />
        <Row label="Role" value={session?.role === "admin" ? "Admin" : "Staff"} />
        <Row label="Notifications" value="Email on new High-priority report" />

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
