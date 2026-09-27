import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { summary, topCorridorsByVolume, riskAreasPreview } from "../data/mockData";
import { useLanguage } from "../i18n/LanguageContext";

export default function Dashboard() {
  const { t } = useLanguage();
  const maxVolume = Math.max(...topCorridorsByVolume.map((c) => c.incidents));

  return (
    <>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{t("dashboard_title")}</h1>
          <p className="text-sm text-muted mt-1">{t("dashboard_subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="text-sm bg-elevated border border-border rounded-lg px-3 py-2">
            <option>Next month</option>
            <option>Next quarter</option>
            <option>Next year</option>
          </select>
          <select className="text-sm bg-elevated border border-border rounded-lg px-3 py-2">
            <option>All corridors</option>
            <option>Top 10 by volume</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <Card>
          <div className="text-sm text-muted">Corridors Monitored</div>
          <div className="text-3xl font-semibold tracking-tight mt-1.5">{summary.corridorsMonitored}</div>
          <div className="text-xs text-muted mt-1">Top roads by incident volume, 2022–2025</div>
        </Card>
        <Card>
          <div className="text-sm text-muted flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-high" />High Risk
          </div>
          <div className="text-3xl font-semibold tracking-tight mt-1.5">{summary.high}</div>
          <div className="text-xs text-muted mt-1">33% of monitored corridors</div>
        </Card>
        <Card>
          <div className="text-sm text-muted flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-med" />Medium Risk
          </div>
          <div className="text-3xl font-semibold tracking-tight mt-1.5">{summary.medium}</div>
          <div className="text-xs text-muted mt-1">33% of monitored corridors</div>
        </Card>
        <Card>
          <div className="text-sm text-muted flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-low" />Low Risk
          </div>
          <div className="text-3xl font-semibold tracking-tight mt-1.5">{summary.low}</div>
          <div className="text-xs text-muted mt-1">33% of monitored corridors</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-3.5 mb-6">
        <Card>
          <div className="text-[15px] font-semibold">Historical incident volume by corridor</div>
          <div className="text-xs text-muted mb-4">Total recorded incidents, 2022–2025 (top 5 by volume)</div>
          <div className="flex items-end gap-2.5 h-36">
            {topCorridorsByVolume.map((c) => (
              <div
                key={c.name}
                className="flex-1 bg-accent-soft rounded-t relative"
                style={{ height: `${(c.incidents / maxVolume) * 100}%` }}
              >
                <div className="absolute inset-0 bg-accent/85 rounded-t" />
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 mt-2">
            {topCorridorsByVolume.map((c) => (
              <span key={c.name} className="flex-1 text-center text-[10.5px] text-muted">
                {c.name}
                <br />
                {c.incidents.toLocaleString()}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-[15px] font-semibold">Risk level distribution</div>
          <div className="text-xs text-muted mb-4">30 corridors, ranked by historical High-priority rate</div>
          <div className="flex flex-col gap-3.5">
            {[
              { label: "High", count: summary.high, color: "bg-high" },
              { label: "Medium", count: summary.medium, color: "bg-med" },
              { label: "Low", count: summary.low, color: "bg-low" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span>{row.label}</span>
                  <span>{row.count} corridors</span>
                </div>
                <div className="h-1.5 bg-surface rounded overflow-hidden">
                  <div className={`h-full rounded ${row.color}`} style={{ width: "33.3%" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="flex justify-between items-center mb-3.5">
          <div>
            <div className="text-[15px] font-semibold">Risk areas</div>
            <div className="text-xs text-muted">Ranked by historical High-priority rate</div>
          </div>
          <Link to="/risk-areas" className="text-xs text-accent font-medium">View all corridors</Link>
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
            {riskAreasPreview.map((r) => (
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
          {riskAreasPreview.map((r) => (
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

        <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
          Risk Level is a relative ranking (tertile) of historical High-priority rate across the 30 monitored
          corridors — it describes 2022–2025 data, not a forecast for a future period.
        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[15px] font-semibold">Report an incident</div>
            <div className="text-xs text-muted">Log incidents as they happen, with an instant priority estimate</div>
          </div>
          <Link to="/report-incident" className="text-xs text-accent font-medium">Open form →</Link>
        </div>
      </Card>
    </>
  );
}
