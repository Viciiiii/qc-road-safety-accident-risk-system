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
    confirmedByOutcome: row.confirmed_by_outcome,
    trend: row.trend, // "rising" | "steady" | "falling", compared with the citywide change
    trendChangePct: row.trend_change_pct,
    trendRecent: row.trend_recent_score,
    trendBefore: row.trend_before_score,
    totalIncidents: row.total_incidents,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

// "2025-07-01" -> "2025-06-01"
const prevMonth = (iso) => {
  const [y, m] = iso.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
};

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
          confirmedSinceData: res.confirmed_since_data,
          trendLabel: `${monthLabel(res.trend_recent_start)} – ${monthLabel(res.data_through)} vs ${monthLabel(res.trend_before_start)} – ${monthLabel(prevMonth(res.trend_recent_start))}`,
          cityChangePct: res.city_change_pct,
          trendThreshold: res.trend_threshold_pct,
          // e.g. "Jan 2025 – Dec 2025 + 2 confirmed reports since" when newer confirmed incidents count too
          scopeLabel:
            `${monthLabel(res.window_start)} – ${monthLabel(res.data_through)}` +
            (res.confirmed_since_data > 0
              ? ` + ${res.confirmed_since_data} confirmed report${res.confirmed_since_data === 1 ? "" : "s"} since`
              : ""),
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
