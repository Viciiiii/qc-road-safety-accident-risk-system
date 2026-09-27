import Card from "../components/ui/Card";
import { modelMetrics, featureImportance } from "../data/mockData";
import { useLanguage } from "../i18n/LanguageContext";

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
            <span>{row.value}{suffix}</span>
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
          <div className="text-xs text-muted mb-4">SMOTE-trained, evaluated on held-out real test data</div>
          <MetricList rows={accuracyRows} colorClass="bg-accent" />
        </Card>
        <Card>
          <div className="text-[15px] font-semibold">Precision on High priority</div>
          <div className="text-xs text-muted mb-4">Of everything flagged High, % actually High</div>
          <MetricList rows={precisionRows} colorClass="bg-high" />
        </Card>
      </div>

      <Card className="mb-6">
        <div className="text-[15px] font-semibold">Recall on High priority</div>
        <div className="text-xs text-muted mb-4">Of all actual High-priority incidents, % correctly caught</div>
        <MetricList rows={recallRows} colorClass="bg-low" />
        <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
          Trade-off: higher recall models (Naive Bayes, SVM) catch more true High cases but flood staff with
          false alarms. Random Forest is the most balanced of the three.
        </div>
      </Card>

      <Card>
        <div className="text-[15px] font-semibold">Feature importance (Random Forest)</div>
        <div className="text-xs text-muted mb-4">Which inputs the model relies on most</div>
        <MetricList rows={featureRows} colorClass="bg-accent" max={featureRows[0].value} />
      </Card>
    </>
  );
}
