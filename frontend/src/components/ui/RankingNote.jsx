// Plain-language explanation of how the corridor ranking works, shared by the
// Dashboard, Risk Areas and Map pages so they always describe it the same way.
export default function RankingNote({ meta, className = "" }) {
  if (!meta) return null;
  const { damage, injury, fatal } = meta.weights;
  return (
    <div className={`text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 leading-relaxed ${className}`}>
      <b className="text-ink">How corridors are ranked:</b> each corridor's crashes from{" "}
      {meta.windowLabel} (MMDA data), plus crashes staff logged and an admin confirmed since then, are scored by seriousness — {damage} point for damage only, {injury} for an injury,{" "}
      {fatal} for a death. The top {meta.highSlots} corridors are High priority, the next {meta.mediumSlots}{" "}
      Medium, and the rest Low. Tested on 2025 data, about 9 in 10 corridors ranked High were again among the
      10 worst the following month.
      {meta.trendLabel && (
        <>
          {" "}
          <b className="text-ink">Trend:</b> ▲ Rising means a corridor's severity score grew at least{" "}
          {meta.trendThreshold} points faster than the whole city's ({meta.cityChangePct > 0 ? "+" : ""}
          {meta.cityChangePct}%) comparing {meta.trendLabel}; ▼ Falling, at least {meta.trendThreshold} points slower;
          → Steady, about the same. Confirmed incidents add to the recent period. Tested on 2022–2025, the arrow
          still held 3 months later about 3 in 4 times.
        </>
      )}
      {meta.confirmedInWindow > 0 && (
        <>
          {" "}
          Includes {meta.confirmedInWindow} confirmed staff-logged incident{meta.confirmedInWindow === 1 ? "" : "s"}
          {meta.confirmedSinceData > 0 && <>, {meta.confirmedSinceData} of them from after {meta.dataThroughLabel}</>}.
        </>
      )}
    </div>
  );
}
