import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiGet, apiPost, SESSION_EXPIRED_EVENT } from "../api/client";

// Who is signed in, checked with the backend. The session itself is an httpOnly
// cookie the browser sends automatically; this page never sees the token, and
// nothing about the account is kept in localStorage.

const AuthContext = createContext(null);

function toSession(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    mustChangePassword: u.must_change_password, // still on a temporary password from an admin
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true); // true until we know whether a session exists

  // On first load, ask the server whether this browser is already signed in.
  useEffect(() => {
    let cancelled = false;
    apiGet("/api/auth/me")
      .then((u) => !cancelled && setSession(toSession(u)))
      .catch(() => !cancelled && setSession(null))
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 from the API means the session ended (expired, password reset, disabled).
  useEffect(() => {
    const onExpired = () => setSession(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // Returns { ok } or { ok: false, error } so the form can show the server's message.
  const login = useCallback(async (email, password, remember) => {
    try {
      const u = await apiPost("/api/auth/login", { email, password, remember });
      setSession(toSession(u));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost("/api/auth/logout");
    } catch {
      /* already signed out on the server - fine */
    }
    setSession(null);
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      const u = await apiPost("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSession(toSession(u));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, checking, isAuthenticated: !!session, login, logout, changePassword }}
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
