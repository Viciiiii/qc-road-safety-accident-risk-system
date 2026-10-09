import { useMemo, useState } from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { useRiskAreas } from "../api/useRiskAreas";
import { useLanguage } from "../i18n/LanguageContext";

export default function RiskAreas() {
  const { t } = useLanguage();
  const { data: allRiskAreas, loading, error } = useRiskAreas();
  const [riskFilter, setRiskFilter] = useState("All");
  const [sortBy, setSortBy] = useState("volume");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    let data = [...allRiskAreas];

    if (riskFilter !== "All") {
      data = data.filter((r) => r.risk === riskFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((r) => r.corridor.toLowerCase().includes(q));
    }
    data.sort((a, b) =>
      sortBy === "volume" ? b.incidents - a.incidents : b.rateValue - a.rateValue
    );
    return data;
  }, [allRiskAreas, riskFilter, sortBy, search]);

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
            className="text-sm bg-elevated border border-border rounded-lg px-3 py-2 w-44"
          />
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="text-sm bg-elevated border border-border rounded-lg px-3 py-2"
          >
            <option value="All">All risk levels</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm bg-elevated border border-border rounded-lg px-3 py-2"
          >
            <option value="volume">Sort: Incident volume</option>
            <option value="rate">Sort: High-priority rate</option>
          </select>
        </div>
      </div>

      <Card>
        {loading && <div className="text-sm text-muted text-center py-8">Loading risk areas…</div>}

        {error && (
          <div className="text-sm text-high bg-high-bg rounded-lg px-3 py-2.5">
            Couldn't load data from the server ({error}). Is the backend running at localhost:8000?
          </div>
        )}

        {!loading && !error && (
        <>
        <div className="text-xs text-muted mb-3">
          Showing {rows.length} of {allRiskAreas.length} monitored corridors
        </div>

        {/* Table: sm and up */}
        <table className="hidden sm:table w-full text-sm border-collapse">
          <thead>
            <tr>
              {["Corridor", "Total Incidents", "High-Priority Rate", "Risk Level"].map((h) => (
                <th key={h} className="text-left font-medium text-muted text-xs pb-2.5 border-b border-border">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.corridor}>
                <td className="py-3 border-b border-border last:border-0">{r.corridor}</td>
                <td className="py-3 border-b border-border last:border-0">{r.incidents.toLocaleString()}</td>
                <td className="py-3 border-b border-border last:border-0">{r.rate}</td>
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
                <span className="text-xs text-muted">Corridor</span>
                <span>{r.corridor}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Total Incidents</span>
                <span>{r.incidents.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Rate</span>
                <span>{r.rate}</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-xs text-muted">Risk</span>
                <Badge level={r.risk} />
              </div>
            </div>
          ))}
        </div>

        {rows.length === 0 && (
          <div className="text-sm text-muted text-center py-8">No corridors match your filters.</div>
        )}

        <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
          Excludes 1 corridor recorded as "Unknown" location in the source data. Risk Level is a tertile
          ranking by historical High-priority rate, not a forecast.
        </div>
        </>
        )}
      </Card>
    </>
  );
}
