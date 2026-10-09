import { useEffect, useState } from "react";
import { apiGet } from "./client";

// Maps the backend's field names to the shape every page already expects
// (same as the old mockData.js shape), so page components barely change.
function mapRow(row) {
  return {
    corridor: row.corridor,
    incidents: row.total_incidents,
    rateValue: row.high_priority_rate,
    rate: `${row.high_priority_rate.toFixed(2)}%`,
    risk: row.risk_level,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export function useRiskAreas() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiGet("/api/risk-areas")
      .then((rows) => {
        if (!cancelled) setData(rows.map(mapRow));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
