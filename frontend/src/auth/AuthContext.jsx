import { createContext, useContext, useEffect, useState } from "react";

const SESSION_KEY = "qc_auth_session";
const ACCOUNTS_KEY = "qc_accounts";

// Demo-only "database" seeded on first load. There is no real backend yet -
// once FastAPI/PostgreSQL exists, accounts live in a users table (with hashed
// passwords) and every function below becomes an API call.
const SEED_ACCOUNTS = [
  { id: 1, name: "Admin Account", email: "admin@qc.gov.ph", role: "admin", password: "Admin@123", disabled: false, createdAt: "2026-09-01" },
  { id: 2, name: "Staff Account", email: "staff@qc.gov.ph", role: "staff", password: "Staff@123", disabled: false, createdAt: "2026-09-01" },
];

const AuthContext = createContext(null);

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Emails and passwords are both case-sensitive (exact match); only surrounding
// whitespace is trimmed from the email. The duplicate check on account creation
// still ignores case, so look-alikes like "Juan@x" and "juan@x" can't both exist.
const trimEmail = (v) => v.trim();
const sameEmailIgnoringCase = (a, b) => a.toLowerCase() === b.toLowerCase();
const samePassword = (a, b) => a === b;

export function AuthProvider({ children }) {
  const [accounts, setAccounts] = useState(() => readJSON(ACCOUNTS_KEY, SEED_ACCOUNTS));
  const [sessionEmail, setSessionEmail] = useState(() => readJSON(SESSION_KEY, null)?.email ?? null);

  useEffect(() => {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }, [accounts]);

  // The session is derived from the live account record, so disabling an
  // account signs that user out automatically on the next render/reload.
  const account = accounts.find((a) => a.email === sessionEmail && !a.disabled) ?? null;
  const session = account ? { email: account.email, name: account.name, role: account.role } : null;

  function login(role, email, password) {
    const target = accounts.find((a) => a.email === trimEmail(email) && a.role === role);
    if (!target || !samePassword(target.password, password)) {
      return { ok: false, error: "Incorrect email or password for the selected role." };
    }
    // Checked only after the credentials match, so a stranger can't probe which emails exist.
    if (target.disabled) {
      return { ok: false, error: "This account has been disabled. Contact your administrator." };
    }
    setSessionEmail(target.email);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: target.email }));
    return { ok: true };
  }

  function logout() {
    setSessionEmail(null);
    localStorage.removeItem(SESSION_KEY);
  }

  // --- Admin actions (the Accounts page is only reachable by admins) ---

  function createAccount({ name, email, password }) {
    const cleanName = name.trim();
    const cleanEmail = trimEmail(email);
    if (!cleanName || !cleanEmail || !password) {
      return { ok: false, error: "All fields are required." };
    }
    if (password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }
    if (accounts.some((a) => sameEmailIgnoringCase(a.email, cleanEmail))) {
      return { ok: false, error: "An account with that email already exists." };
    }
    setAccounts((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: cleanName,
        email: cleanEmail,
        role: "staff",
        password,
        disabled: false,
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    return { ok: true };
  }

  function resetPassword(id, newPassword) {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, password: newPassword } : a)));
    return { ok: true };
  }

  function setAccountDisabled(id, disabled) {
    if (disabled && account?.id === id) {
      return { ok: false, error: "You can't disable your own account." };
    }
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, disabled } : a)));
    return { ok: true };
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: !!session,
        login,
        logout,
        accounts,
        createAccount,
        resetPassword,
        setAccountDisabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
