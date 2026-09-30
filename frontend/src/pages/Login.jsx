import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";

const ShieldIcon = ({ className = "" }) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.4" />
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [role, setRole] = useState("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Already signed in (e.g. visiting /login directly with a session already
  // stored) - skip straight to the app instead of showing the form again.
  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const result = login(role, email.trim(), password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate("/");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
      {/* Brand panel - desktop only */}
      <div className="hidden lg:flex relative bg-accent-soft overflow-hidden flex-col justify-center p-14">
        <div
          className="absolute w-[520px] h-[520px] rounded-full -top-28 -left-24"
          style={{
            background: "radial-gradient(circle, rgba(0,113,227,.28), rgba(0,113,227,0) 70%)",
            filter: "blur(10px)",
          }}
        />
        <div className="relative z-10 max-w-[380px]">
          <div className="w-10 h-10 rounded-[10px] bg-accent flex items-center justify-center mb-7">
            <ShieldIcon className="w-5 h-5 stroke-white" />
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight leading-tight">
            QC Road Safety
            <br />
            Accident Risk System
          </h1>
          <p className="text-sm text-muted mt-2.5 leading-relaxed">
            Sign in to monitor corridor risk levels, report incidents, and review historical
            accident data across Quezon City.
          </p>

          <svg viewBox="0 0 340 180" fill="none" className="mt-11 w-full max-w-[340px]">
            <path d="M-10 150 C 70 110, 120 170, 200 120 S 320 60, 360 90" stroke="#0071e3" strokeOpacity="0.35" strokeWidth="2" />
            <path d="M-10 170 C 70 130, 120 190, 200 140 S 320 80, 360 110" stroke="#0071e3" strokeOpacity="0.18" strokeWidth="2" />
            <circle cx="215" cy="108" r="5" fill="#0071e3" />
            <path
              d="M215 60 C 195 60 180 75 180 95 C 180 118 215 150 215 150 C 215 150 250 118 250 95 C 250 75 235 60 215 60 Z"
              stroke="#0071e3" strokeWidth="2" fill="#eaf3fe"
            />
            <circle cx="215" cy="93" r="9" stroke="#0071e3" strokeWidth="2" fill="#fff" />
          </svg>
        </div>
      </div>

      {/* Login panel */}
      <div className="flex items-center justify-center p-8 lg:p-14">
        <div className="w-full max-w-[380px]">

          {/* Mobile-only compact mark */}
          <div className="flex lg:hidden items-center gap-2.5 mb-9">
            <div className="w-[34px] h-[34px] rounded-[10px] bg-accent flex items-center justify-center">
              <ShieldIcon className="w-[18px] h-[18px] stroke-white" />
            </div>
            <span className="text-[15px] font-semibold">QC Road Safety</span>
          </div>

          <h2 className="text-[22px] font-semibold tracking-tight">{t("login_welcome")}</h2>
          <p className="text-[13.5px] text-muted mt-1.5 mb-7">{t("login_subtitle")}</p>

          <div className="flex bg-surface rounded-lg p-[3px] gap-0.5 mb-5">
            {["staff", "admin"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 text-[13px] py-2 rounded-md transition-colors ${
                  role === r
                    ? "bg-elevated font-semibold shadow-sm"
                    : "text-muted font-medium"
                }`}
              >
                {r === "staff" ? t("login_staff") : t("login_admin")}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="text-[13px] text-high bg-high-bg rounded-lg px-3 py-2.5 mb-4">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs text-muted mb-1.5">{t("login_email")}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@qc.gov.ph"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full text-sm px-3.5 py-2.5 border border-border rounded-lg focus:outline-none focus:border-accent"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs text-muted mb-1.5">{t("login_password")}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  className="w-full text-sm px-3.5 py-2.5 border border-border rounded-lg focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted font-medium px-1.5 py-1 hover:text-ink"
                >
                  {showPassword ? t("login_hide") : t("login_show")}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center mt-0.5 mb-5">
              <label className="flex items-center gap-1.5 text-[13px] text-muted">
                <input type="checkbox" className="w-3.5 h-3.5 accent-accent" />
                {t("login_remember")}
              </label>
              <a href="#" className="text-[13px] text-accent font-medium">{t("login_forgot")}</a>
            </div>

            <button
              type="submit"
              className="w-full bg-accent text-white text-[14.5px] font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              {t("login_signin")}
            </button>
          </form>

          <div className="text-xs text-muted text-center mt-6 leading-relaxed">
            Authorized <span className="font-semibold text-ink">LGU personnel</span> only. Contact your
            administrator for access.
          </div>

          <div className="text-[11.5px] text-muted bg-surface rounded-lg px-3 py-2.5 mt-4 leading-relaxed">
            <b className="text-ink">Demo credentials</b> (case-sensitive) — Admin: admin@qc.gov.ph / Admin@123 · Staff:
            staff@qc.gov.ph / Staff@123
          </div>
        </div>
      </div>
    </div>
  );
}
