import { useState } from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../auth/AuthContext";
import { useIncidents } from "../incidents/IncidentsContext";
import { useRiskAreas } from "../api/useRiskAreas";
import { useFormOptions } from "../api/useFormOptions";
import { apiPost } from "../api/client";
import { modelMetrics } from "../data/mockData";

// Held-out precision on High priority, from the training notebook. Shown as a
// caution whenever a model flags High, so the number isn't taken at face value.
const MODELS = [
  { key: "random_forest", name: "Random Forest", precision: modelMetrics.randomForest.highPrecision },
  { key: "svm", name: "SVM", precision: modelMetrics.svm.highPrecision },
  { key: "naive_bayes", name: "Naive Bayes", precision: modelMetrics.naiveBayes.highPrecision },
];

const fieldClass = "w-full text-sm bg-elevated border border-border rounded-lg px-3 py-2 mt-1";

function Results({ result }) {
  const labels = MODELS.map((m) => result.predictions[m.key].label);
  const allAgree = new Set(labels).size === 1;

  return (
    <>
      {MODELS.map((m, i) => {
        const p = result.predictions[m.key];
        return (
          <div key={m.key} className={`py-2.5 ${i < MODELS.length - 1 ? "border-b border-border" : ""}`}>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold w-[88px] flex-none">{m.name}</span>
              <Badge level={p.label} />
              <span className="text-xs text-muted">
                {p.confidence != null ? `Confidence ${p.confidence}%` : "No confidence score (linear SVM)"}
              </span>
            </div>
            {p.probabilities && (
              <div className="text-[11px] text-muted mt-1 ml-[98px]">
                High {p.probabilities.High}% · Medium {p.probabilities.Medium}% · Low {p.probabilities.Low}%
              </div>
            )}
            {p.label === "High" && (
              <div className="text-[11px] text-muted mt-1 ml-[98px]">
                ⚠ When {m.name} flags High, it's right only ~{m.precision}% of the time on held-out test data.
              </div>
            )}
          </div>
        );
      })}

      <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3 leading-relaxed">
        <b className="text-ink">{allAgree ? "All three models agree." : "The models disagree."}</b>{" "}
        {allAgree
          ? ""
          : "Random Forest, the most balanced of the three, is saved as this incident's estimated priority. "}
        Saved to <b className="text-ink">Records</b>; an admin still needs to confirm the actual outcome before it
        counts toward retraining.
        <br />
        <br />
        Location isn't a model input — the models use time, weather, collision type, accident factor and
        vehicles only, so <b className="text-ink">{result.corridor}</b> is saved with the record but doesn't
        change these predictions.
        {result.adjustments.length > 0 && (
          <>
            <br />
            <br />
            <b className="text-ink">Adjusted input:</b> {result.adjustments.join(" ")}
          </>
        )}
      </div>
    </>
  );
}

export default function ReportIncident() {
  const { t } = useLanguage();
  const { session } = useAuth();
  const { addIncident } = useIncidents();
  const { data: riskAreas, loading: areasLoading, error: areasError } = useRiskAreas();
  const { options, loading: optionsLoading, error: optionsError } = useFormOptions();

  const [corridor, setCorridor] = useState("");
  const [datetime, setDatetime] = useState("");
  const [weather, setWeather] = useState("");
  const [collisionType, setCollisionType] = useState("");
  const [accidentFactor, setAccidentFactor] = useState("");
  const [vehicleCounts, setVehicleCounts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);

  const loading = areasLoading || optionsLoading;
  const loadError = areasError || optionsError;

  // Until the person touches a dropdown, it shows (and submits) its first option.
  const corridorOptions = riskAreas.map((r) => r.corridor);
  const selectedCorridor = corridor || corridorOptions[0];
  const selectedWeather = weather || options?.weather[0];
  const selectedCollision = collisionType || options?.collision_types[0].value;
  const selectedFactor = accidentFactor || options?.accident_factors[0].value;

  function handleVehicleChange(field, value) {
    const n = Math.max(0, parseInt(value, 10) || 0);
    setVehicleCounts((prev) => ({ ...prev, [field]: n }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const vehicles = Object.fromEntries(options.vehicle_fields.map((f) => [f, vehicleCounts[f] ?? 0]));
    try {
      const res = await apiPost("/api/predict-incident", {
        incident_datetime: datetime,
        weather: selectedWeather,
        collision_type: selectedCollision,
        accident_factor: selectedFactor,
        vehicles,
        corridor: selectedCorridor,
      });
      addIncident({
        corridor: selectedCorridor,
        datetime,
        weather: selectedWeather,
        collisionType: selectedCollision,
        accidentFactor: selectedFactor,
        vehicles,
        priority: res.predictions.random_forest.label, // Random Forest is the logged estimate
        loggedBy: session?.name || "Staff",
      });
      setResult({ ...res, corridor: selectedCorridor });
      setDatetime("");
      setVehicleCounts({});
    } catch (err) {
      // Nothing is saved if the models couldn't be reached, so no incident gets logged without a priority.
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight">{t("reportIncident_title")}</h1>
        <p className="text-sm text-muted mt-1">{t("reportIncident_subtitle")}</p>
      </div>

      {loading && <div className="text-sm text-muted text-center py-8">Loading form…</div>}

      {loadError && (
        <div className="text-sm text-high bg-high-bg rounded-lg px-3 py-2.5">
          Couldn't load the form from the server ({loadError}). Is the backend running at localhost:8000?
        </div>
      )}

      {!loading && !loadError && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <Card>
            <div className="text-[15px] font-semibold mb-4">Incident details</div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="block">
                <span className="text-xs text-muted">Corridor / street</span>
                <select value={selectedCorridor} onChange={(e) => setCorridor(e.target.value)} className={fieldClass}>
                  {corridorOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-muted">Date &amp; time</span>
                <input
                  type="datetime-local"
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  required
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className="text-xs text-muted">Weather</span>
                <select value={selectedWeather} onChange={(e) => setWeather(e.target.value)} className={fieldClass}>
                  {options.weather.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-muted">Collision type</span>
                <select value={selectedCollision} onChange={(e) => setCollisionType(e.target.value)} className={fieldClass}>
                  {options.collision_types.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-muted">Accident factor</span>
                <select value={selectedFactor} onChange={(e) => setAccidentFactor(e.target.value)} className={fieldClass}>
                  {options.accident_factors.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-xs text-muted">Vehicles involved (count)</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1">
                  {options.vehicle_fields.map((field) => (
                    <label key={field} className="block">
                      <span className="text-[10.5px] text-muted block truncate" title={field}>{field}</span>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={vehicleCounts[field] ?? 0}
                        onChange={(e) => handleVehicleChange(field, e.target.value)}
                        className="w-full text-sm bg-elevated border border-border rounded-lg px-2 py-1.5 mt-0.5"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {submitError && (
                <div className="text-[13px] text-high bg-high-bg rounded-lg px-3 py-2.5">
                  Couldn't get a prediction: {submitError}. The incident was not saved.
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded-lg mt-2 self-start disabled:opacity-60"
              >
                {submitting ? "Predicting…" : "Log incident & get estimate"}
              </button>
            </form>
          </Card>

          <Card>
            <div className="text-[15px] font-semibold">Estimated priority</div>
            <div className="text-xs text-muted mb-4">
              Live predictions from the three trained models — compared side by side
            </div>

            {!result ? (
              <div className="text-sm text-muted py-6 text-center">
                Fill out the form and submit to see an estimate.
              </div>
            ) : (
              <Results result={result} />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
