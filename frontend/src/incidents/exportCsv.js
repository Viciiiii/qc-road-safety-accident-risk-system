import { vehicleFields } from "../data/mockData";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Column names mirror the raw MMDA dataset so the retraining notebook can append
// the file directly. Casualty counts aren't collected by the form (and are excluded
// from the model as label leakage anyway), so they're not part of this export.
const HEADERS = [
  "District (City)", "Street", "Year", "Month", "Day", "Hour", "Minute",
  "Weather", "Collision Type", "Accident Factor",
  ...vehicleFields,
  "Classification",
];

function esc(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function incidentsToCsv(incidents) {
  const rows = incidents.map((i) => {
    const d = new Date(i.datetime);
    return [
      "Central (Quezon)", i.corridor, d.getFullYear(), MONTHS[d.getMonth()], d.getDate(),
      d.getHours(), d.getMinutes(),
      i.weather, i.collisionType, i.accidentFactor,
      ...vehicleFields.map((f) => i.vehicles?.[f] ?? 0),
      i.confirmedOutcome, // Fatal / Non Fatal Injury / Damage to Property = the training label
    ].map(esc).join(",");
  });
  return [HEADERS.map(esc).join(","), ...rows].join("\n");
}

export function downloadCsv(filename, text) {
  // Leading BOM so Excel opens the file as UTF-8.
  const blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
