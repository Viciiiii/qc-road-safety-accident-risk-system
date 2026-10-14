import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiGet, apiPost } from "../api/client";
import { incidentsToCsv, downloadCsv } from "./exportCsv";

// Staff-logged incidents, stored in PostgreSQL through the API so every computer
// sees the same Records.
//
// Status flow:  Pending review  ->  Confirmed  ->  Included in training
//   Pending review        staff logged it; real outcome not yet known
//   Confirmed             an admin recorded the actual outcome (the training label);
//                         from now on it also counts toward the corridor ranking
//   Included in training  exported for retraining (marked when the CSV is downloaded)

const IncidentsContext = createContext(null);

function fromApi(i) {
  return {
    id: i.id,
    corridor: i.corridor,
    datetime: i.incident_datetime,
    weather: i.weather,
    collisionType: i.collision_type,
    accidentFactor: i.accident_factor,
    vehicles: i.vehicle_counts || {},
    priority: i.priority,
    loggedBy: i.logged_by_name || "—",
    status: i.status,
    confirmedOutcome: i.confirmed_outcome,
  };
}

export function IncidentsProvider({ children }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // No state is set before the request finishes, so this is safe to call from an effect.
  const reload = useCallback(async () => {
    try {
      const rows = await apiGet("/api/incidents");
      setIncidents(rows.map(fromApi));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // First load when the app starts. (Records also calls reload() each time it opens.)
  useEffect(() => {
    let cancelled = false;
    apiGet("/api/incidents")
      .then((rows) => !cancelled && setIncidents(rows.map(fromApi)))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Each action throws on failure so the page can show the server's message.
  async function addIncident(data) {
    const saved = await apiPost("/api/incidents", {
      corridor: data.corridor,
      incident_datetime: data.datetime,
      weather: data.weather,
      collision_type: data.collisionType,
      accident_factor: data.accidentFactor,
      vehicles: data.vehicles,
      priority: data.priority,
      logged_by_name: data.loggedBy,
    });
    setIncidents((prev) => [fromApi(saved), ...prev]);
  }

  async function confirmOutcome(id, outcome) {
    const saved = fromApi(await apiPost(`/api/incidents/${id}/confirm`, { outcome }));
    setIncidents((prev) => prev.map((i) => (i.id === id ? saved : i)));
  }

  // Downloads all Confirmed incidents as CSV; the server marks them Included in training.
  // Returns how many were exported.
  async function exportConfirmed() {
    const ready = (await apiPost("/api/incidents/export")).map(fromApi);
    if (ready.length === 0) return 0;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`qc-confirmed-incidents-${stamp}.csv`, incidentsToCsv(ready));
    const exported = new Set(ready.map((i) => i.id));
    setIncidents((prev) => prev.map((i) => (exported.has(i.id) ? { ...i, status: "Included in training" } : i)));
    return ready.length;
  }

  return (
    <IncidentsContext.Provider value={{ incidents, loading, error, reload, addIncident, confirmOutcome, exportConfirmed }}>
      {children}
    </IncidentsContext.Provider>
  );
}

export function useIncidents() {
  const ctx = useContext(IncidentsContext);
  if (!ctx) throw new Error("useIncidents must be used within IncidentsProvider");
  return ctx;
}
