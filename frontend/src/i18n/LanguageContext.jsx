import { createContext, useContext, useState } from "react";

const STORAGE_KEY = "qc_language";
const LanguageContext = createContext(null);

// Covers UI chrome only - nav, page headers, login, settings. Table data,
// corridor names, and status labels are intentionally left untranslated;
// full localization of dynamic content is a larger task for later.
const translations = {
  en: {
    nav_dashboard: "Dashboard",
    nav_riskAreas: "Risk Areas",
    nav_map: "Map",
    nav_reportIncident: "Report Incident",
    nav_records: "Records",
    nav_analytics: "Analytics",
    nav_settings: "Settings",
    nav_accounts: "Accounts",

    dashboard_title: "Dashboard",
    dashboard_subtitle: "Predicted accident risk by road corridor — Quezon City, next period forecast",
    riskAreas_title: "Risk Areas",
    riskAreas_subtitle: "All monitored corridors, ranked by historical High-priority rate (2022–2025)",
    map_title: "Map",
    map_subtitle: "Monitored corridors plotted by location and predicted risk level",
    reportIncident_title: "Report Incident",
    reportIncident_subtitle: "Log a road accident as it's reported — stored for the next model retraining cycle",
    records_title: "Records",
    records_subtitle: "Incidents logged by staff through the Report Incident form — pending inclusion in the next model retraining",
    analytics_title: "Analytics",
    analytics_subtitle: "Model performance comparison — Random Forest, SVM, Naive Bayes",
    settings_title: "Settings",
    settings_subtitle: "System information and account preferences",
    accounts_title: "Manage Accounts",
    accounts_subtitle: "Create staff accounts, reset passwords, and disable access",

    login_welcome: "Welcome back",
    login_subtitle: "Sign in to your account to continue",
    login_staff: "Staff",
    login_admin: "Admin",
    login_email: "Email",
    login_password: "Password",
    login_remember: "Remember me",
    login_forgot: "Forgot password?",
    login_signin: "Sign In",
    login_show: "Show",
    login_hide: "Hide",

    settings_appearance: "Appearance",
    settings_darkMode: "Dark mode",
    settings_language: "Language",
    settings_logout: "Log out",
  },
  tl: {
    nav_dashboard: "Dashboard",
    nav_riskAreas: "Mga Panganib na Lugar",
    nav_map: "Mapa",
    nav_reportIncident: "Mag-ulat ng Insidente",
    nav_records: "Mga Talaan",
    nav_analytics: "Analytics",
    nav_settings: "Mga Setting",
    nav_accounts: "Mga Account",

    dashboard_title: "Dashboard",
    dashboard_subtitle: "Hinulaang antas ng panganib ng aksidente kada kalsada — Quezon City, susunod na hula",
    riskAreas_title: "Mga Panganib na Lugar",
    riskAreas_subtitle: "Lahat ng minomonitor na kalsada, ayon sa antas ng High-priority na insidente (2022–2025)",
    map_title: "Mapa",
    map_subtitle: "Mga minomonitor na kalsada ayon sa lokasyon at antas ng panganib",
    reportIncident_title: "Mag-ulat ng Insidente",
    reportIncident_subtitle: "Itala ang aksidente sa kalsada — isasama sa susunod na pagsasanay ng modelo",
    records_title: "Mga Talaan",
    records_subtitle: "Mga insidenteng itinala ng staff — hinihintay ang pagsasama sa susunod na pagsasanay ng modelo",
    analytics_title: "Analytics",
    analytics_subtitle: "Paghahambing ng performance ng modelo — Random Forest, SVM, Naive Bayes",
    settings_title: "Mga Setting",
    settings_subtitle: "Impormasyon ng sistema at mga kagustuhan ng account",
    accounts_title: "Pamahalaan ang mga Account",
    accounts_subtitle: "Gumawa ng account ng staff, mag-reset ng password, at i-disable ang access",

    login_welcome: "Maligayang pagbabalik",
    login_subtitle: "Mag-sign in sa iyong account para magpatuloy",
    login_staff: "Staff",
    login_admin: "Admin",
    login_email: "Email",
    login_password: "Password",
    login_remember: "Tandaan ako",
    login_forgot: "Nakalimutan ang password?",
    login_signin: "Mag-Sign In",
    login_show: "Ipakita",
    login_hide: "Itago",

    settings_appearance: "Hitsura",
    settings_darkMode: "Madilim na mode",
    settings_language: "Wika",
    settings_logout: "Mag-log out",
  },
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem(STORAGE_KEY) || "en");

  function changeLanguage(lang) {
    setLanguage(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  function t(key) {
    return translations[language]?.[key] ?? translations.en[key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
