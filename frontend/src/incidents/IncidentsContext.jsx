import { createContext, useContext, useEffect, useState } from "react";
import { loggedIncidents } from "../data/mockData";
import { incidentsToCsv, downloadCsv } from "./exportCsv";

const STORAGE_KEY = "qc_incidents";
const OUTCOME_FOR_PRIORITY = { High: "Fatal", Medium: "Non Fatal Injury", Low: "Damage to Property" };

// Status flow:  Pending review  ->  Confirmed  ->  Included in training
//   Pending review        staff logged it; real outcome not yet known
//   Confirmed             an admin recorded the actual outcome (the training label)
//   Included in training  exported for retraining (marked when the CSV is downloaded)

const IncidentsContext = createContext(null);

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Demo seed built from the mock rows; fills in the fields the mock rows don't have.
function seed() {
  return loggedIncidents.map((r) => {
    const hour = new Date(r.datetime).getHours();
    return {
      accidentFactor: "Human Error",
      weather: hour < 6 || hour >= 18 ? "Fair (Night)" : "Fair (Day)",
      vehicles: {},
      confirmedOutcome: r.status === "Included in training" ? OUTCOME_FOR_PRIORITY[r.priority] : null,
      ...r,
    };
  });
}

export function IncidentsProvider({ children }) {
  const [incidents, setIncidents] = useState(() => readJSON(STORAGE_KEY, null) ?? seed());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
  }, [incidents]);

  function addIncident(data) {
    setIncidents((prev) => [
      { id: Date.now(), status: "Pending review", confirmedOutcome: null, ...data },
      ...prev,
    ]);
  }

  function confirmOutcome(id, outcome) {
    setIncidents((prev) =>
      prev.map((i) => (i.id === id ? { ...i, confirmedOutcome: outcome, status: "Confirmed" } : i))
    );
  }

  // Downloads all Confirmed incidents as CSV, then marks them Included in training.
  // Returns how many were exported.
  function exportConfirmed() {
    const ready = incidents.filter((i) => i.status === "Confirmed");
    if (ready.length === 0) return 0;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`qc-confirmed-incidents-${stamp}.csv`, incidentsToCsv(ready));
    setIncidents((prev) =>
      prev.map((i) => (i.status === "Confirmed" ? { ...i, status: "Included in training" } : i))
    );
    return ready.length;
  }

  return (
    <IncidentsContext.Provider value={{ incidents, addIncident, confirmOutcome, exportConfirmed }}>
      {children}
    </IncidentsContext.Provider>
  );
}

export function useIncidents() {
  const ctx = useContext(IncidentsContext);
  if (!ctx) throw new Error("useIncidents must be used within IncidentsProvider");
  return ctx;
}
