import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";
import { ThemeProvider } from "./theme/ThemeContext";
import { LanguageProvider } from "./i18n/LanguageContext";
import { IncidentsProvider } from "./incidents/IncidentsContext";
import AppShell from "./components/layout/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RiskAreas from "./pages/RiskAreas";
import MapView from "./pages/MapView";
import ReportIncident from "./pages/ReportIncident";
import Records from "./pages/Records";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Accounts from "./pages/Accounts";

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <IncidentsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<AppShell />}>
                  <Route index element={<Dashboard />} />
                  <Route path="risk-areas" element={<RiskAreas />} />
                  <Route path="map" element={<MapView />} />
                  <Route path="report-incident" element={<ReportIncident />} />
                  <Route path="records" element={<Records />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route element={<AdminRoute />}>
                    <Route path="accounts" element={<Accounts />} />
                  </Route>
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
          </IncidentsProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
