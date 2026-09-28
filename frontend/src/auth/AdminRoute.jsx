import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Only admins get through; staff who type /accounts into the URL bar are sent home.
// (Frontend-only check - a real backend must also enforce this on every admin API call.)
export default function AdminRoute() {
  const { session } = useAuth();
  return session?.role === "admin" ? <Outlet /> : <Navigate to="/" replace />;
}
