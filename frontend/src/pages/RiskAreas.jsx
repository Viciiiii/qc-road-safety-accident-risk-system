import { useMemo, useState } from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import RankingNote from "../components/ui/RankingNote";
import { ConfirmedTag, TrendBadge } from "../components/ui/Trend";
import { useRiskAreas } from "../api/useRiskAreas";
import { API_BASE } from "../api/client";
import { useLanguage } from "../i18n/LanguageContext";

const SORTS = {
  rank: { label: "Sort: Priority rank", fn: (a, b) => a.rank - b.rank },
  crashes: { label: "Sort: Crashes", fn: (a, b) => b.crashes - a.crashes },
  fatal: { label: "Sort: Fatal crashes", fn: (a, b) => b.fatal - a.fatal || a.rank - b.rank },
  name: { label: "Sort: Name", fn: (a, b) => a.corridor.localeCompare(b.corridor) },
};

export default function RiskAreas() {
  const { t } = useLanguage();
  const { data: corridors, meta, loading, error } = useRiskAreas();
  const [riskFilter, setRiskFilter] = useState("All");
  const [trendFilter, setTrendFilter] = useState("All");
  const [sortBy, setSortBy] = useState("rank");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return corridors
      .filter((r) => riskFilter === "All" || r.risk === riskFilter)
      .filter((r) => trendFilter === "All" || r.trend === trendFilter)
      .filter((r) => !q || r.corridor.toLowerCase().includes(q))
      .sort(SORTS[sortBy].fn);
  }, [corridors, riskFilter, trendFilter, sortBy, search]);

  const selectClass = "text-sm bg-elevated border border-border rounded-lg px-3 py-2";

  return (
    <>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{t("riskAreas_title")}</h1>
          <p className="text-sm text-muted mt-1">{t("riskAreas_subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search corridor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${selectClass} w-44`}
          />
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className={selectClass}>
            <option value="All">All priority levels</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select value={trendFilter} onChange={(e) => setTrendFilter(e.target.value)} className={selectClass}>
            <option value="All">All trends</option>
            <option value="rising">▲ Rising</option>
            <option value="steady">→ Steady</option>
            <option value="falling">▼ Falling</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectClass}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        {loading && <div className="text-sm text-muted text-center py-8">Loading risk areas…</div>}

        {error && (
          <div className="text-sm text-high bg-high-bg rounded-lg px-3 py-2.5">
            Couldn't load data from the server ({error}). Is the backend running at {API_BASE}?
          </div>
        )}

        {!loading && !error && (
        <>
        <div className="text-xs text-muted mb-3">
          Showing {rows.length} of {corridors.length} monitored corridors · crashes from {meta.scopeLabel}
        </div>

        {/* Table: sm and up */}
        <table className="hidden sm:table w-full text-sm border-collapse">
          <thead>
            <tr>
              {["Rank", "Corridor", "Severity score", "Crashes", "Injury", "Fatal", "Trend", "Priority"].map((h) => (
                <th key={h} className="text-left font-medium text-muted text-xs pb-2.5 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.corridor}>
                <td className="py-3 border-b border-border last:border-0 text-muted">{r.rank}</td>
                <td className="py-3 border-b border-border last:border-0">
                  {r.corridor}
                  <ConfirmedTag row={r} />
                </td>
                <td className="py-3 border-b border-border last:border-0 font-medium">{r.score.toLocaleString()}</td>
                <td className="py-3 border-b border-border last:border-0">{r.crashes.toLocaleString()}</td>
                <td className="py-3 border-b border-border last:border-0">{r.injury.toLocaleString()}</td>
                <td className="py-3 border-b border-border last:border-0">{r.fatal}</td>
                <td className="py-3 border-b border-border last:border-0"><TrendBadge row={r} meta={meta} /></td>
                <td className="py-3 border-b border-border last:border-0"><Badge level={r.risk} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Stacked cards: below sm */}
        <div className="sm:hidden flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.corridor} className="border border-border rounded-lg px-3 py-1">
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">#{r.rank}</span>
                <span className="font-medium text-right">{r.corridor}<ConfirmedTag row={r} /></span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Severity score</span>
                <span>{r.score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Trend</span>
                <TrendBadge row={r} meta={meta} />
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Crashes · Injury · Fatal</span>
                <span>{r.crashes.toLocaleString()} · {r.injury.toLocaleString()} · {r.fatal}</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-xs text-muted">Priority</span>
                <Badge level={r.risk} />
              </div>
            </div>
          ))}
        </div>

        {rows.length === 0 && (
          <div className="text-sm text-muted text-center py-8">No corridors match your filters.</div>
        )}

        <RankingNote meta={meta} className="mt-3.5" />
        </>
        )}
      </Card>
    </>
  );
}
