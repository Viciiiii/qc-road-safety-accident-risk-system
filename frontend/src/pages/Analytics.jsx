import { useEffect } from "react";
import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import {
  modelMetrics, previousMetrics, withoutHistory, featureImportance, TEST_CRASHES, TEST_FATAL, FATAL_BASE_RATE,
  STREET_HISTORY_IMPORTANCE,
} from "../data/modelResults";
import { useLanguage } from "../i18n/LanguageContext";
import { useIncidents } from "../incidents/IncidentsContext";
import { MODELS as LIVE_MODELS, SMALL_SAMPLE, tally } from "../incidents/estimateCheck";

const models = [
  { key: "randomForest", label: "Random Forest" },
  { key: "svm", label: "SVM" },
  { key: "naiveBayes", label: "Naive Bayes" },
];

function MetricList({ rows, colorClass, max = 100, suffix = "%" }) {
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex justify-between text-sm mb-1.5">
            <span>{row.label}</span>
            <span>{row.value.toFixed(1)}{suffix}</span>
          </div>
          <div className="h-1.5 bg-surface rounded overflow-hidden">
            <div
              className={`h-full rounded ${colorClass}`}
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const TEST_ACCURACY = {
  "Random Forest": modelMetrics.randomForest.accuracy,
  SVM: modelMetrics.svm.accuracy,
  "Naive Bayes": modelMetrics.naiveBayes.accuracy,
};

// Each model's estimates on incidents staff logged, checked against the outcome an admin confirmed.
// Unlike the cards above (the held-out test set), these are crashes the models had never seen.
function LiveResults() {
  const { incidents, error, reload } = useIncidents();
  useEffect(() => {
    reload();
  }, [reload]);

  const rows = LIVE_MODELS.map((m) => ({ ...m, ...tally(incidents, m.key) }));
  const confirmed = rows[0].compared; // every logged incident has a Random Forest estimate
  const cell = "py-2.5 pr-4 border-b border-border";

  return (
    <Card className="mb-6">
      <div className="text-[15px] font-semibold">Live results on logged incidents</div>
      <div className="text-xs text-muted mb-4">
        Each model's estimate when a crash was reported, checked against the outcome an admin later confirmed
      </div>

      {error && (
        <div className="text-[13px] text-high bg-high-bg rounded-lg px-3 py-2.5">Couldn't load incidents ({error}).</div>
      )}

      {!error && confirmed === 0 && (
        <div className="text-sm text-muted py-4">
          No confirmed incidents yet. Log crashes on <Link to="/report-incident" className="text-accent">Report Incident</Link>,
          then confirm their real outcome in <Link to="/records" className="text-accent">Records</Link>.
        </div>
      )}

      {!error && confirmed > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[560px]">
              <thead>
                <tr>
                  {["Model", "Matched", "Underestimated", "Overestimated", "Fatal crashes flagged High", "Test-set accuracy"].map((h) => (
                    <th key={h} className="text-left font-medium text-muted text-xs pb-2.5 pr-4 border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className={`${cell} font-medium`}>{r.name}</td>
                    <td className={cell}>
                      {r.compared ? <>{r.correct} of {r.compared} <span className="text-muted">({r.accuracy}%)</span></> : <span className="text-muted">—</span>}
                    </td>
                    <td className={cell}>{r.compared ? r.under : "—"}</td>
                    <td className={cell}>{r.compared ? r.over : "—"}</td>
                    <td className={cell}>{r.fatal ? `${r.fatalFlaggedHigh} of ${r.fatal}` : <span className="text-muted">no fatal crashes yet</span>}</td>
                    <td className={`${cell} text-muted`}>{TEST_ACCURACY[r.name]}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
            {confirmed < SMALL_SAMPLE ? (
              <>
                <b className="text-ink">Only {confirmed} confirmed incident{confirmed === 1 ? "" : "s"} so far — too few to judge the models.</b>{" "}
                The test-set results above remain the real evaluation; this table becomes meaningful after many real incidents.{" "}
              </>
            ) : null}
            Incidents logged before the model update keep the estimate the older models gave at the time.{" "}
            Underestimated means the model said a crash was less serious than it turned out (for example Low for a fatal
            crash) — the costlier mistake. SVM and Naive Bayes are compared only on incidents logged after their estimates
            started being saved.
          </div>
        </>
      )}
    </Card>
  );
}

// Before/after the model update, on the same held-out test set.
function ModelUpdate() {
  const cell = "py-2.5 pr-4 border-b border-border";
  const change = (before, after) => {
    const d = Math.round((after - before) * 10) / 10;
    return <span className={d >= 0 ? "text-low" : "text-high"}>{d >= 0 ? "+" : ""}{d.toFixed(1)}</span>;
  };
  return (
    <Card className="mb-6">
      <div className="text-[15px] font-semibold">Model update: before vs after</div>
      <div className="text-xs text-muted mb-4">
        Both trained on 2022–2023 and tested on the same {TEST_CRASHES.toLocaleString()} crashes from 2025 ({TEST_FATAL} fatal).
        After = the same inputs for all three models, including each street's crash history, with settings and cutoffs
        chosen on 2024
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[680px]">
          <thead>
            <tr>
              {["Model", "Flagged High", "Fatal caught", "Precision (High)", "Recall (High)", "Ranking quality (PR-AUC)"].map((h) => (
                <th key={h} className="text-left font-medium text-muted text-xs pb-2.5 pr-4 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const b = previousMetrics[m.key];
              const a = modelMetrics[m.key];
              return (
                <tr key={m.key}>
                  <td className={`${cell} font-medium`}>{m.label}</td>
                  <td className={cell}>{b.flagged.toLocaleString()} → {a.flagged.toLocaleString()}</td>
                  <td className={cell}>{b.caught} → {a.caught} of {TEST_FATAL}</td>
                  <td className={cell}>{b.highPrecision.toFixed(1)}% → {a.highPrecision.toFixed(1)}% <span className="text-xs">({change(b.highPrecision, a.highPrecision)})</span></td>
                  <td className={cell}>{b.highRecall.toFixed(1)}% → {a.highRecall.toFixed(1)}% <span className="text-xs">({change(b.highRecall, a.highRecall)})</span></td>
                  <td className={cell}>{b.prAuc.toFixed(3)} → {a.prAuc.toFixed(3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
        The new models raise far fewer false High alarms, so precision went up for all three. They also catch fewer
        fatal crashes: the old cutoffs were set to keep recall high whatever the cost in false alarms, while the new
        ones balance both (recall still weighted above precision). PR-AUC measures ranking quality without any
        cutoff: Random Forest clearly improved, SVM dropped slightly and Naive Bayes stayed about the same. Settings
        and cutoffs were chosen on 2024 only; 2025 was used once, for these numbers.
      </div>
    </Card>
  );
}

export default function Analytics() {
  const { t } = useLanguage();
  const accuracyRows = models.map((m) => ({ label: m.label, value: modelMetrics[m.key].accuracy }));
  const precisionRows = models.map((m) => ({ label: m.label, value: modelMetrics[m.key].highPrecision }));
  const recallRows = models.map((m) => ({ label: m.label, value: modelMetrics[m.key].highRecall }));
  const featureRows = featureImportance.map((f) => ({ label: f.feature, value: f.value }));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight">{t("analytics_title")}</h1>
        <p className="text-sm text-muted mt-1">{t("analytics_subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-6">
        <Card>
          <div className="text-[15px] font-semibold">Overall accuracy</div>
          <div className="text-xs text-muted mb-4">
            Trained on 2022–2023, tested on all {TEST_CRASHES.toLocaleString()} crashes from 2025
          </div>
          <MetricList rows={accuracyRows} colorClass="bg-accent" />
        </Card>
        <Card>
          <div className="text-[15px] font-semibold">Precision on High priority</div>
          <div className="text-xs text-muted mb-4">Of everything flagged High, % actually High</div>
          <MetricList rows={precisionRows} colorClass="bg-high" />
          <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
            Only {FATAL_BASE_RATE}% of crashes in 2025 were fatal, so a random guess would be right {FATAL_BASE_RATE}% of
            the time. Random Forest's {modelMetrics.randomForest.highPrecision}% is about{" "}
            {Math.round(modelMetrics.randomForest.highPrecision / FATAL_BASE_RATE)}× better than chance. It can't go
            much higher because the records don't hold speed, helmet use, victim age or response time.
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="text-[15px] font-semibold">Recall on High priority</div>
        <div className="text-xs text-muted mb-4">Of all actual High-priority incidents, % correctly caught</div>
        <MetricList rows={recallRows} colorClass="bg-low" />
        <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
          Trade-off: SVM catches the most fatal crashes and calls the fewest of them Low (
          {modelMetrics.svm.fatalCalledLow} vs {modelMetrics.randomForest.fatalCalledLow} for Random Forest), but most of
          its High flags are false alarms. Random Forest is the most precise and the most balanced. Naive Bayes is the
          weakest: it looked fine on 2024 but dropped on 2025, since it assumes every input is independent.
        </div>
      </Card>

      <ModelUpdate />

      <LiveResults />

      <Card>
        <div className="text-[15px] font-semibold">Feature importance (Random Forest)</div>
        <div className="text-xs text-muted mb-4">Which inputs the model relies on most</div>
        <MetricList rows={featureRows} colorClass="bg-accent" max={featureRows[0].value} />
        <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
          Street history (how often crashes on the street, and on it at that hour, were fatal in 2022–2023) is{" "}
          {STREET_HISTORY_IMPORTANCE}% of the model's importance across its four inputs, yet it matters: without it,
          Random Forest's precision drops from {modelMetrics.randomForest.highPrecision.toFixed(1)}% to{" "}
          {withoutHistory.randomForest.highPrecision.toFixed(1)}% and its PR-AUC from{" "}
          {modelMetrics.randomForest.prAuc.toFixed(3)} to {withoutHistory.randomForest.prAuc.toFixed(3)}.
        </div>
      </Card>
    </>
  );
}
