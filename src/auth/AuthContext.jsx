import { createContext, useContext, useState } from "react";

const STORAGE_KEY = "qc_auth_session";

// Fake credentials for local/demo use only - there is no real backend auth yet.
// Replace this whole check with a real POST /api/auth/login once FastAPI has
// authentication. Never ship hardcoded credentials like this to production.
const FAKE_USERS = {
  admin: { email: "admin@qc.gov.ph".toLowerCase(), password: "Admin@123".toLowerCase(), name: "Admin Account" },
  staff: { email: "staff@qc.gov.ph".toLowerCase(), password: "Staff@123".toLowerCase(), name: "Staff Account" },
};

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  function login(role, email, password) {
    const account = FAKE_USERS[role];
    if (!account || account.email !== email || account.password !== password) {
      return { ok: false, error: "Incorrect email or password for the selected role." };
    }
    const newSession = { role, email: account.email, name: account.name };
    setSession(newSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
    return { ok: true };
  }

  function logout() {
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ session, isAuthenticated: !!session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
