import { NavLink } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { useAuth } from "../../auth/AuthContext";

export default function Sidebar({ open, onNavigate }) {
  const { t } = useLanguage();
  const { session } = useAuth();

  const navItems = [
    { to: "/", label: t("nav_dashboard"), end: true },
    { to: "/risk-areas", label: t("nav_riskAreas") },
    { to: "/map", label: t("nav_map") },
    { to: "/report-incident", label: t("nav_reportIncident") },
    { to: "/records", label: t("nav_records") },
    { to: "/analytics", label: t("nav_analytics") },
    ...(session?.role === "admin" ? [{ to: "/accounts", label: t("nav_accounts") }] : []),
    { to: "/settings", label: t("nav_settings") },
  ];

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-40 w-60 flex flex-col gap-7 bg-elevated
        border-r border-border p-4 transition-transform duration-200 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:sticky lg:h-screen`}
    >
      <div className="px-2">
        <div className="text-[17px] font-semibold">QC Road Safety</div>
        <div className="text-xs text-muted mt-0.5">Accident Risk System</div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 text-sm px-2.5 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-accent-soft text-accent font-semibold"
                  : "text-muted hover:bg-surface hover:text-ink"
              }`
            }
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-55 flex-none" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
