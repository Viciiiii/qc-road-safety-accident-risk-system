import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useRiskAreas } from "../api/useRiskAreas";
import { useLanguage } from "../i18n/LanguageContext";

const riskColor = { High: "#c0392b", Medium: "#b8790a", Low: "#2f8f5b" };

export default function MapView() {
  const { t } = useLanguage();
  const { data, loading, error } = useRiskAreas();
  // Coordinates now come straight from the backend (seeded into risk_areas),
  // not a separate frontend lookup table - filter out any corridor missing them.
  const points = data.filter((r) => r.latitude != null && r.longitude != null);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight">{t("map_title")}</h1>
        <p className="text-sm text-muted mt-1">{t("map_subtitle")}</p>
      </div>

      {loading && <div className="text-sm text-muted text-center py-8">Loading map…</div>}

      {error && (
        <div className="text-sm text-high bg-high-bg rounded-lg px-3 py-2.5">
          Couldn't load data from the server ({error}). Is the backend running at localhost:8000?
        </div>
      )}

      {!loading && !error && (
      <>
      <div className="bg-elevated border border-border rounded-xl overflow-hidden relative" style={{ height: 560 }}>
        <MapContainer
          center={[14.676, 121.0437]}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((r) => (
            <CircleMarker
              key={r.corridor}
              center={[r.latitude, r.longitude]}
              radius={9}
              pathOptions={{
                color: riskColor[r.risk],
                fillColor: riskColor[r.risk],
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-[13px] leading-relaxed">
                  <b>{r.corridor}</b>
                  <br />
                  {r.incidents.toLocaleString()} incidents (2022–2025)
                  <br />
                  High-priority rate: {r.rate}
                  <br />
                  Risk level: <span style={{ color: riskColor[r.risk], fontWeight: 600 }}>{r.risk}</span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-3 right-3 z-[1000] bg-elevated border border-border rounded-lg px-3 py-2.5 text-xs shadow-sm">
          <div className="font-semibold mb-1.5">Risk Level</div>
          {["High", "Medium", "Low"].map((level) => (
            <div key={level} className="flex items-center gap-1.5 py-0.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ background: riskColor[level] }}
              />
              {level}
            </div>
          ))}
        </div>
      </div>

      <div className="text-[11.5px] text-muted bg-surface rounded-lg px-2.5 py-2 mt-3.5 leading-relaxed">
        Corridor locations are approximate (manually estimated general positions along each road), not
        precisely geocoded. Showing {points.length} of {data.length} monitored corridors. Click a
        marker for details.
      </div>
      </>
      )}
    </>
  );
}
