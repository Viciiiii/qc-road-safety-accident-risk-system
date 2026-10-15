// Trend arrow for a corridor: is it getting worse faster than the rest of the city?
// Last 6 months vs the 6 before, compared with the citywide change (backend/app/ranking.py).
// Always shows a word as well as the arrow, so it never relies on colour alone.
const STYLES = {
  rising: { icon: "▲", label: "Rising", cls: "text-high" },
  steady: { icon: "→", label: "Steady", cls: "text-muted" },
  falling: { icon: "▼", label: "Falling", cls: "text-low" },
};

function trendTitle(row, meta) {
  if (row.trendChangePct == null || !meta) return undefined;
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
  return `Severity score ${sign(row.trendChangePct)}% (${row.trendBefore.toLocaleString()} → ${row.trendRecent.toLocaleString()}), city ${sign(meta.cityChangePct)}%, ${meta.trendLabel}`;
}

export function TrendBadge({ row, meta }) {
  const s = STYLES[row.trend] || STYLES.steady;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${s.cls}`} title={trendTitle(row, meta)}>
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
    </span>
  );
}

// "+3 confirmed · 1 fatal, 2 damage only" - staff-logged incidents an admin confirmed
export function ConfirmedTag({ row }) {
  if (!row.confirmedIncidents) return null;
  const { fatal = 0, injury = 0, damage = 0 } = row.confirmedByOutcome || {};
  const parts = [
    fatal && `${fatal} fatal`,
    injury && `${injury} injury`,
    damage && `${damage} damage only`,
  ].filter(Boolean);
  const detail = parts.length === 1 && row.confirmedIncidents > 1 ? `all ${parts[0].replace(/^\d+ /, "")}` : parts.join(", ");
  return (
    <span className="text-[11px] text-muted ml-1.5" title="Staff-logged incidents confirmed by an admin">
      +{row.confirmedIncidents} confirmed · {detail}
    </span>
  );
}
