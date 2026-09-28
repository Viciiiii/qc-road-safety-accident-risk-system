import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Wraps routes that require a signed-in session. Anyone not authenticated is
// redirected to /login. Replace this check once real backend auth exists -
// same idea, but reading a real token/session instead of the fake one.
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
