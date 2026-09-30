import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../auth/AuthContext";
import { useIncidents } from "../incidents/IncidentsContext";

const statusChoices = ["All statuses", "Pending review", "Confirmed", "Included in training"];
const OUTCOMES = ["Fatal", "Non Fatal Injury", "Damage to Property"];

function withinRange(iso, range) {
  if (range === "All logged") return true;
  const days = range === "Last 7 days" ? 7 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(iso) >= cutoff;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// Admin-only control: confirm the real outcome for a Pending-review incident.
// Once confirmed it becomes real, exportable training data (see exportConfirmed()).
function ConfirmOutcome({ incident, onConfirm }) {
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        className="text-xs bg-elevated border border-border rounded-lg px-2 py-1"
      >
        {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
      </select>
      <button
        onClick={() => onConfirm(incident.id, outcome)}
        className="text-xs font-medium text-accent bg-surface px-2 py-1 rounded-lg"
      >
        Confirm
      </button>
    </div>
  );
}

function StatusCell({ incident, isAdmin, onConfirm }) {
  if (incident.status === "Pending review" && isAdmin) {
    return <ConfirmOutcome incident={incident} onConfirm={onConfirm} />;
  }
  return (
    <div>
      <div className="text-xs text-muted">{incident.status}</div>
      {incident.confirmedOutcome && (
        <div className="text-[11px] text-muted mt-0.5">{incident.confirmedOutcome}</div>
      )}
    </div>
  );
}

export default function Records() {
  const { t } = useLanguage();
  const { session } = useAuth();
  const { incidents, confirmOutcome, exportConfirmed } = useIncidents();
  const isAdmin = session?.role === "admin";

  const [range, setRange] = useState("Last 30 days");
  const [corridor, setCorridor] = useState("All corridors");
  const [status, setStatus] = useState("All statuses");

  const corridorChoices = useMemo(
    () => ["All corridors", ...new Set(incidents.map((r) => r.corridor))],
    [incidents]
  );

  const rows = useMemo(() => {
    return incidents
      .filter((r) => withinRange(r.datetime, range))
      .filter((r) => corridor === "All corridors" || r.corridor === corridor)
      .filter((r) => status === "All statuses" || r.status === status)
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  }, [incidents, range, corridor, status]);

  const confirmedCount = incidents.filter((r) => r.status === "Confirmed").length;

  function handleExport() {
    const n = exportConfirmed();
    if (n === 0) alert("No confirmed incidents ready to export yet.");
  }

  return (
    <>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{t("records_title")}</h1>
          <p className="text-sm text-muted mt-1">{t("records_subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={range} onChange={(e) => setRange(e.target.value)} className="text-sm bg-elevated border border-border rounded-lg px-3 py-2">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>All logged</option>
          </select>
          <select value={corridor} onChange={(e) => setCorridor(e.target.value)} className="text-sm bg-elevated border border-border rounded-lg px-3 py-2">
            {corridorChoices.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm bg-elevated border border-border rounded-lg px-3 py-2">
            {statusChoices.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <div className="text-xs text-muted">
            Showing {rows.length} of {incidents.length} logged incidents
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={handleExport}
                className="text-xs font-medium text-accent bg-surface px-2.5 py-1.5 rounded-lg"
              >
                Export for retraining {confirmedCount > 0 ? `(${confirmedCount})` : ""}
              </button>
            )}
            <Link to="/report-incident" className="text-xs text-accent font-medium">+ Log new incident</Link>
          </div>
        </div>

        {/* Table: sm and up */}
        <table className="hidden sm:table w-full text-sm border-collapse">
          <thead>
            <tr>
              {["Date & Time", "Corridor", "Collision Type", "Estimated Priority", "Logged By", "Status"].map((h) => (
                <th key={h} className="text-left font-medium text-muted text-xs pb-2.5 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-3 border-b border-border last:border-0">{formatDateTime(r.datetime)}</td>
                <td className="py-3 border-b border-border last:border-0">{r.corridor}</td>
                <td className="py-3 border-b border-border last:border-0">{r.collisionType}</td>
                <td className="py-3 border-b border-border last:border-0"><Badge level={r.priority} /></td>
                <td className="py-3 border-b border-border last:border-0">{r.loggedBy}</td>
                <td className="py-3 border-b border-border last:border-0">
                  <StatusCell incident={r} isAdmin={isAdmin} onConfirm={confirmOutcome} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Stacked cards: below sm */}
        <div className="sm:hidden flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="border border-border rounded-lg px-3 py-1">
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Date &amp; Time</span>
                <span>{formatDateTime(r.datetime)}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Corridor</span>
                <span>{r.corridor}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Collision Type</span>
                <span>{r.collisionType}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Priority</span>
                <Badge level={r.priority} />
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border">
                <span className="text-xs text-muted">Logged By</span>
                <span>{r.loggedBy}</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-xs text-muted">Status</span>
                <StatusCell incident={r} isAdmin={isAdmin} onConfirm={confirmOutcome} />
              </div>
            </div>
          ))}
        </div>

        {rows.length === 0 && (
          <div className="text-sm text-muted text-center py-8">No logged incidents match your filters.</div>
        )}

        <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
          Status flow: <b className="text-ink">Pending review</b> (just logged, real outcome unknown) →{" "}
          <b className="text-ink">Confirmed</b> (an admin recorded what actually happened) →{" "}
          <b className="text-ink">Included in training</b> (exported as CSV for the next retraining run).
          "Estimated Priority" is the triage estimate at logging time, not the confirmed outcome.
        </div>
      </Card>
    </>
  );
}
