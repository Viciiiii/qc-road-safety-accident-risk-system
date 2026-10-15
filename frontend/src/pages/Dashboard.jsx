import { useMemo } from "react";
import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import RankingNote from "../components/ui/RankingNote";
import { TrendBadge } from "../components/ui/Trend";
import { useRiskAreas } from "../api/useRiskAreas";
import { API_BASE } from "../api/client";
import { useLanguage } from "../i18n/LanguageContext";

export default function Dashboard() {
  const { t } = useLanguage();
  const { data, meta, loading, error } = useRiskAreas();

  const summary = useMemo(() => ({
    corridors: data.length,
    high: data.filter((r) => r.risk === "High").length,
    medium: data.filter((r) => r.risk === "Medium").length,
    low: data.filter((r) => r.risk === "Low").length,
  }), [data]);

  const top = data.slice(0, 5); // already sorted by rank
  const rising = data.filter((r) => r.trend === "rising");
  const fallingCount = data.filter((r) => r.trend === "falling").length;
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
  const maxScore = top.length ? top[0].score : 1;
  const pct = (n) => (summary.corridors ? Math.round((n / summary.corridors) * 100) : 0);

  return (
    <>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{t("dashboard_title")}</h1>
          <p className="text-sm text-muted mt-1">{t("dashboard_subtitle")}</p>
        </div>
        {meta && (
          <div className="text-xs text-muted bg-surface rounded-lg px-3 py-2 text-right">
            Priorities for next month · based on {meta.scopeLabel}
            <br />
            <Link to="/settings" className="text-accent">Model status →</Link>
          </div>
        )}
      </div>

      {loading && <div className="text-sm text-muted text-center py-8">Loading dashboard…</div>}

      {error && (
        <div className="text-sm text-high bg-high-bg rounded-lg px-3 py-2.5">
          Couldn't load data from the server ({error}). Is the backend running at {API_BASE}?
        </div>
      )}

      {!loading && !error && (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <Card>
          <div className="text-sm text-muted">Corridors Monitored</div>
          <div className="text-3xl font-semibold tracking-tight mt-1.5">{summary.corridors}</div>
          <div className="text-xs text-muted mt-1">Ranked by 12-month severity score</div>
        </Card>
        <Card>
          <div className="text-sm text-muted flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-high" />High Priority
          </div>
          <div className="text-3xl font-semibold tracking-tight mt-1.5">{summary.high}</div>
          <div className="text-xs text-muted mt-1">Focus resources here first</div>
        </Card>
        <Card>
          <div className="text-sm text-muted flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-med" />Medium Priority
          </div>
          <div className="text-3xl font-semibold tracking-tight mt-1.5">{summary.medium}</div>
          <div className="text-xs text-muted mt-1">{pct(summary.medium)}% of monitored corridors</div>
        </Card>
        <Card>
          <div className="text-sm text-muted flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-low" />Low Priority
          </div>
          <div className="text-3xl font-semibold tracking-tight mt-1.5">{summary.low}</div>
          <div className="text-xs text-muted mt-1">{pct(summary.low)}% of monitored corridors</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-3.5 mb-6">
        <Card>
          <div className="text-[15px] font-semibold">Highest severity scores</div>
          <div className="text-xs text-muted mb-4">Top 5 corridors, {meta.windowLabel}</div>
          <div className="flex items-end gap-2.5 h-36">
            {top.map((c) => (
              <div
                key={c.corridor}
                className="flex-1 bg-accent-soft rounded-t relative"
                style={{ height: `${(c.score / maxScore) * 100}%` }}
                title={`${c.corridor}: score ${c.score.toLocaleString()}`}
              >
                <div className="absolute inset-0 bg-accent/85 rounded-t" />
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 mt-2">
            {top.map((c) => (
              <span key={c.corridor} className="flex-1 text-center text-[10.5px] text-muted">
                {c.corridor}
                <br />
                {c.score.toLocaleString()}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-[15px] font-semibold">Priority levels</div>
          <div className="text-xs text-muted mb-4">{summary.corridors} corridors, ranked by severity score</div>
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
                  <div className={`h-full rounded ${row.color}`} style={{ width: `${pct(row.count)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="flex justify-between items-center mb-3.5">
          <div>
            <div className="text-[15px] font-semibold">Rising faster than the city</div>
            <div className="text-xs text-muted">
              Severity score {meta.trendLabel} · city {sign(meta.cityChangePct)}% · {fallingCount} corridor
              {fallingCount === 1 ? "" : "s"} falling
            </div>
          </div>
          <Link to="/risk-areas" className="text-xs text-accent font-medium">See all trends</Link>
        </div>
        {rising.length === 0 ? (
          <div className="text-sm text-muted py-2">No corridor is rising faster than the city right now.</div>
        ) : (
          <div className="flex flex-col">
            {rising.map((r) => (
              <div key={r.corridor} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 border-b border-border last:border-0">
                <TrendBadge row={r} meta={meta} />
                <span className="text-sm font-medium flex-1 min-w-[140px]">{r.corridor}</span>
                <span className="text-xs text-muted">
                  {r.trendChangePct != null ? `${sign(r.trendChangePct)}%` : "new"} ({r.trendBefore.toLocaleString()} →{" "}
                  {r.trendRecent.toLocaleString()})
                </span>
                <Badge level={r.risk} />
              </div>
            ))}
          </div>
        )}
        <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3 leading-relaxed">
          These corridors' severity scores grew at least {meta.trendThreshold} points faster than the city's. Some are
          only Medium or Low priority, so this list can flag roads the ranking alone wouldn't. A Rising road usually stays
          elevated for the next few months, but doesn't always keep climbing.
        </div>
      </Card>

      <Card className="mb-6">
        <div className="flex justify-between items-center mb-3.5">
          <div>
            <div className="text-[15px] font-semibold">Priority corridors for next month</div>
            <div className="text-xs text-muted">Top 5 by severity score</div>
          </div>
          <Link to="/risk-areas" className="text-xs text-accent font-medium">View all corridors</Link>
        </div>

        {/* Table: sm and up */}
        <table className="hidden sm:table w-full text-sm border-collapse">
          <thead>
            <tr>
              {["Rank", "Corridor", "Severity score", "Crashes", "Fatal", "Trend", "Priority"].map((h) => (
                <th key={h} className="text-left font-medium text-muted text-xs pb-2.5 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.corridor}>
                <td className="py-3 border-b border-border last:border-0 text-muted">{r.rank}</td>
                <td className="py-3 border-b border-border last:border-0">{r.corridor}</td>
                <td className="py-3 border-b border-border last:border-0 font-medium">{r.score.toLocaleString()}</td>
                <td className="py-3 border-b border-border last:border-0">{r.crashes.toLocaleString()}</td>
                <td className="py-3 border-b border-border last:border-0">{r.fatal}</td>
                <td className="py-3 border-b border-border last:border-0"><TrendBadge row={r} meta={meta} /></td>
                <td className="py-3 border-b border-border last:border-0"><Badge level={r.risk} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Stacked cards: below sm */}
        <div className="sm:hidden flex flex-col gap-2">
          {top.map((r) => (
            <div key={r.corridor} className="border border-border rounded-lg px-3 py-1">
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">#{r.rank}</span>
                <span className="font-medium">{r.corridor}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Severity score</span>
                <span>{r.score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Crashes · Fatal</span>
                <span>{r.crashes.toLocaleString()} · {r.fatal}</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-xs text-muted">Priority</span>
                <Badge level={r.risk} />
              </div>
            </div>
          ))}
        </div>

        <RankingNote meta={meta} className="mt-3.5" />
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
      )}
    </>
  );
}
