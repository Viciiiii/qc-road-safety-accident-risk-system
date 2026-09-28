import { useState } from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { useLanguage } from "../i18n/LanguageContext";
import {
  corridorOptions,
  collisionTypeOptions,
  accidentFactorOptions,
  weatherOptions,
  vehicleFields,
  estimateFromHistoricalRisk,
} from "../data/mockData";

const emptyVehicleCounts = Object.fromEntries(vehicleFields.map((f) => [f, 0]));

export default function ReportIncident() {
  const { t } = useLanguage();
  const [corridor, setCorridor] = useState(corridorOptions[0]);
  const [datetime, setDatetime] = useState("");
  const [weather, setWeather] = useState(weatherOptions[0]);
  const [collisionType, setCollisionType] = useState(collisionTypeOptions[0]);
  const [accidentFactor, setAccidentFactor] = useState(accidentFactorOptions[0]);
  const [vehicleCounts, setVehicleCounts] = useState(emptyVehicleCounts);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  function handleVehicleChange(field, value) {
    const n = Math.max(0, parseInt(value, 10) || 0);
    setVehicleCounts((prev) => ({ ...prev, [field]: n }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Illustrative only - a real submit would POST all these fields (plus the
    // hardcoded District="Central (Quezon)") to FastAPI's /api/predict-incident,
    // which would run RF/SVM/NB and return real predictions + confidences.
    const risk = estimateFromHistoricalRisk(corridor);
    setResult({ risk });
    setSubmitted(true);
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight">{t("reportIncident_title")}</h1>
        <p className="text-sm text-muted mt-1">{t("reportIncident_subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <Card>
          <div className="text-[15px] font-semibold mb-4">Incident details</div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="block">
              <span className="text-xs text-muted">Corridor / street</span>
              <select
                value={corridor}
                onChange={(e) => setCorridor(e.target.value)}
                className="w-full text-sm bg-elevated border border-border rounded-lg px-3 py-2 mt-1"
              >
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
                className="w-full text-sm bg-elevated border border-border rounded-lg px-3 py-2 mt-1"
              />
            </label>

            <label className="block">
              <span className="text-xs text-muted">Weather</span>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="w-full text-sm bg-elevated border border-border rounded-lg px-3 py-2 mt-1"
              >
                {weatherOptions.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-muted">Collision type</span>
              <select
                value={collisionType}
                onChange={(e) => setCollisionType(e.target.value)}
                className="w-full text-sm bg-elevated border border-border rounded-lg px-3 py-2 mt-1"
              >
                {collisionTypeOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-muted">Accident factor</span>
              <select
                value={accidentFactor}
                onChange={(e) => setAccidentFactor(e.target.value)}
                className="w-full text-sm bg-elevated border border-border rounded-lg px-3 py-2 mt-1"
              >
                {accidentFactorOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-xs text-muted">Vehicles involved (count)</span>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1">
                {vehicleFields.map((field) => (
                  <label key={field} className="block">
                    <span className="text-[10.5px] text-muted block truncate" title={field}>{field}</span>
                    <input
                      type="number"
                      min="0"
                      value={vehicleCounts[field]}
                      onChange={(e) => handleVehicleChange(field, e.target.value)}
                      className="w-full text-sm bg-elevated border border-border rounded-lg px-2 py-1.5 mt-0.5"
                    />
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded-lg mt-2 self-start"
            >
              Log incident &amp; get estimate
            </button>
          </form>
        </Card>

        <Card>
          <div className="text-[15px] font-semibold">Estimated priority</div>
          <div className="text-xs text-muted mb-4">
            Instant triage estimate — compared across all three trained models
          </div>

          {!submitted ? (
            <div className="text-sm text-muted py-6 text-center">
              Fill out the form and submit to see an estimate.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2.5 py-2.5 border-b border-border">
                <span className="text-xs font-semibold w-[88px] flex-none">Random Forest</span>
                <Badge level={result.risk} />
                <span className="text-xs text-muted">
                  Precision on High is low (12.8%) — expect false alarms
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 py-2.5 border-b border-border">
                <span className="text-xs font-semibold w-[88px] flex-none">SVM</span>
                <Badge level={result.risk} />
                <span className="text-xs text-muted">
                  No confidence score (linear SVM) · precision on High only 2.2%
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 py-2.5">
                <span className="text-xs font-semibold w-[88px] flex-none">Naive Bayes</span>
                <Badge level={result.risk} />
                <span className="text-xs text-muted">
                  ⚠ Precision on High only 0.7% — treat this model's High flags with caution
                </span>
              </div>
              <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3 leading-relaxed">
                Illustrative only — based on {corridor}'s historical risk tier, not a live model
                call. Real predictions require the FastAPI backend. Logged incidents are stored
                and included the next time the risk model is retrained, once confirmed.
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
