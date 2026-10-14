import { useEffect, useState } from "react";
import { apiGet } from "./client";

// The corridor ranking from GET /api/risk-areas: corridors ranked by their 12-month
// severity score (1 x damage-only + 3 x injury + 10 x fatal crashes). Top 10 are
// High priority, the next 10 Medium, the rest Low. See backend/app/ranking.py.
function mapCorridor(row) {
  return {
    corridor: row.corridor,
    rank: row.rank,
    risk: row.risk_level,
    score: row.severity_score,
    crashes: row.crashes,
    damage: row.damage,
    injury: row.injury,
    fatal: row.fatal,
    confirmedIncidents: row.confirmed_incidents,
    totalIncidents: row.total_incidents,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

const monthLabel = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });

export function useRiskAreas() {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiGet("/api/risk-areas")
      .then((res) => {
        if (cancelled) return;
        setData(res.corridors.map(mapCorridor));
        setMeta({
          windowLabel: `${monthLabel(res.window_start)} – ${monthLabel(res.data_through)}`,
          dataThroughLabel: monthLabel(res.data_through),
          weights: res.weights,
          highSlots: res.high_slots,
          mediumSlots: res.medium_slots,
          confirmedAfterWindow: res.confirmed_after_window,
          confirmedInWindow: res.corridors.reduce((n, c) => n + c.confirmed_incidents, 0),
        });
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

  return { data, meta, loading, error };
}
