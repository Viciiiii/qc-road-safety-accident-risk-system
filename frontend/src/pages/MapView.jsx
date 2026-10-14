import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import RankingNote from "../components/ui/RankingNote";
import { useRiskAreas } from "../api/useRiskAreas";
import { API_BASE } from "../api/client";
import { useLanguage } from "../i18n/LanguageContext";

const riskColor = { High: "#c0392b", Medium: "#b8790a", Low: "#2f8f5b" };
const riskRadius = { High: 11, Medium: 9, Low: 7 };

export default function MapView() {
  const { t } = useLanguage();
  const { data, meta, loading, error } = useRiskAreas();
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
          Couldn't load data from the server ({error}). Is the backend running at {API_BASE}?
        </div>
      )}

      {!loading && !error && (
      <>
      <div className="bg-elevated border border-border rounded-xl overflow-hidden relative" style={{ height: 560 }}>
        <MapContainer center={[14.676, 121.0437]} zoom={12} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Draw Low first so High markers sit on top where they overlap */}
          {[...points].reverse().map((r) => (
            <CircleMarker
              key={r.corridor}
              center={[r.latitude, r.longitude]}
              radius={riskRadius[r.risk]}
              pathOptions={{ color: riskColor[r.risk], fillColor: riskColor[r.risk], fillOpacity: 0.7, weight: 2 }}
            >
              <Popup>
                <div className="text-[13px] leading-relaxed">
                  <b>#{r.rank} {r.corridor}</b>
                  <br />
                  Priority: <span style={{ color: riskColor[r.risk], fontWeight: 600 }}>{r.risk}</span>
                  <br />
                  Severity score: {r.score.toLocaleString()}
                  <br />
                  {r.crashes.toLocaleString()} crashes · {r.injury.toLocaleString()} injury · {r.fatal} fatal
                  <br />
                  <span style={{ color: "#6e6e73" }}>{meta.windowLabel}</span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        <div className="absolute bottom-3 right-3 z-[1000] bg-elevated border border-border rounded-lg px-3 py-2.5 text-xs shadow-sm">
          <div className="font-semibold mb-1.5">Priority next month</div>
          {["High", "Medium", "Low"].map((level) => (
            <div key={level} className="flex items-center gap-1.5 py-0.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: riskColor[level] }} />
              {level}
            </div>
          ))}
        </div>
      </div>

      <RankingNote meta={meta} className="mt-3.5" />
      <div className="text-[11.5px] text-muted mt-2 leading-relaxed px-1">
        Marker positions are approximate (one hand-placed point per road), not geocoded. Showing{" "}
        {points.length} of {data.length} corridors. Click a marker for details.
      </div>
      </>
      )}
    </>
  );
}
