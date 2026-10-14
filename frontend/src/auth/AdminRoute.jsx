import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Only admins get through; staff who type /accounts into the URL bar are sent home.
// The API enforces the same rule on every admin call (403 for staff).
export default function AdminRoute() {
  const { session } = useAuth();
  return session?.role === "admin" ? <Outlet /> : <Navigate to="/" replace />;
}
