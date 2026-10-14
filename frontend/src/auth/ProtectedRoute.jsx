import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Wraps routes that need a signed-in account. While the app is still asking the
// server whether this browser has a session, show nothing instead of flashing the
// sign-in page. The API checks every request too; this only decides what to show.
export default function ProtectedRoute() {
  const { isAuthenticated, checking } = useAuth();
  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted">Loading…</div>;
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
