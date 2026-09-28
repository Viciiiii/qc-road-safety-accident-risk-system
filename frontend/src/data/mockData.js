// Real figures computed from priority_risk_lookups.pkl and priority_metadata.yaml.
// Once FastAPI is running, these get replaced by fetch/axios calls to endpoints like
// GET /api/risk-areas, GET /api/metrics, etc. — keep that swap in mind as you build pages.

export const summary = {
  corridorsMonitored: 30,
  high: 10,
  medium: 10,
  low: 10,
};

export const topCorridorsByVolume = [
  { name: "Commonwealth Ave.", incidents: 17646 },
  { name: "EDSA", incidents: 16426 },
  { name: "C-5/Katipunan", incidents: 10896 },
  { name: "Quezon Ave.", incidents: 7944 },
  { name: "Quirino Hwy", incidents: 6572 },
];

export const riskAreasPreview = [
  { corridor: "Payatas Road", incidents: 877, rate: "1.14%", risk: "High" },
  { corridor: "Congressional Ave.", incidents: 2322, rate: "0.60%", risk: "High" },
  { corridor: "Quirino Highway", incidents: 6572, rate: "0.44%", risk: "Medium" },
  { corridor: "Commonwealth Ave.", incidents: 17646, rate: "0.31%", risk: "Medium" },
  { corridor: "C-5 Road", incidents: 4405, rate: "0.09%", risk: "Low" },
];

// Full 29 monitored corridors (excludes 1 corridor recorded as "Unknown" location
// in the source data). rateValue is the numeric High-priority rate used for sorting;
// rate is the same value pre-formatted for display.
export const allRiskAreas = [
  { corridor: "Commonwealth Ave.", incidents: 17646, rateValue: 0.31, rate: "0.31%", risk: "Medium" },
  { corridor: "EDSA", incidents: 16426, rateValue: 0.27, rate: "0.27%", risk: "Medium" },
  { corridor: "C-5 Road / Katipunan Ave.", incidents: 10896, rateValue: 0.20, rate: "0.20%", risk: "Low" },
  { corridor: "Quezon Ave.", incidents: 7944, rateValue: 0.24, rate: "0.24%", risk: "Medium" },
  { corridor: "Quirino Highway", incidents: 6572, rateValue: 0.44, rate: "0.44%", risk: "Medium" },
  { corridor: "Mindanao Ave.", incidents: 4900, rateValue: 0.41, rate: "0.41%", risk: "Medium" },
  { corridor: "C-5 Road", incidents: 4405, rateValue: 0.09, rate: "0.09%", risk: "Low" },
  { corridor: "Aurora Blvd.", incidents: 3317, rateValue: 0.39, rate: "0.39%", risk: "Medium" },
  { corridor: "Elliptical Road", incidents: 2950, rateValue: 0.24, rate: "0.24%", risk: "Medium" },
  { corridor: "Congressional Ave.", incidents: 2322, rateValue: 0.60, rate: "0.60%", risk: "High" },
  { corridor: "E. Rodriguez Sr. Ave.", incidents: 1971, rateValue: 0.51, rate: "0.51%", risk: "High" },
  { corridor: "A. Bonifacio Ave.", incidents: 1916, rateValue: 0.89, rate: "0.89%", risk: "High" },
  { corridor: "G. Araneta Ave.", incidents: 1585, rateValue: 0.57, rate: "0.57%", risk: "High" },
  { corridor: "Col. Bonny Serrano Ave.", incidents: 1209, rateValue: 0.08, rate: "0.08%", risk: "Low" },
  { corridor: "IBP Road", incidents: 1108, rateValue: 0.99, rate: "0.99%", risk: "High" },
  { corridor: "Regalado Ave.", incidents: 933, rateValue: 0.21, rate: "0.21%", risk: "Low" },
  { corridor: "Visayas Ave.", incidents: 916, rateValue: 0.22, rate: "0.22%", risk: "Low" },
  { corridor: "Timog Ave.", incidents: 902, rateValue: 0.00, rate: "0.00%", risk: "Low" },
  { corridor: "Payatas Road", incidents: 877, rateValue: 1.14, rate: "1.14%", risk: "High" },
  { corridor: "East Ave.", incidents: 870, rateValue: 0.46, rate: "0.46%", risk: "Medium" },
  { corridor: "North Ave.", incidents: 868, rateValue: 0.23, rate: "0.23%", risk: "Medium" },
  { corridor: "Tandang Sora Ave.", incidents: 840, rateValue: 0.71, rate: "0.71%", risk: "High" },
  { corridor: "Del Monte Ave.", incidents: 661, rateValue: 0.61, rate: "0.61%", risk: "High" },
  { corridor: "Kalayaan Ave.", incidents: 651, rateValue: 0.00, rate: "0.00%", risk: "Low" },
  { corridor: "P. Tuazon Blvd.", incidents: 613, rateValue: 0.49, rate: "0.49%", risk: "High" },
  { corridor: "Zabarte Road", incidents: 579, rateValue: 0.17, rate: "0.17%", risk: "Low" },
  { corridor: "Tomas Morato Ave.", incidents: 543, rateValue: 0.18, rate: "0.18%", risk: "Low" },
  { corridor: "Panay Ave.", incidents: 528, rateValue: 0.00, rate: "0.00%", risk: "Low" },
  { corridor: "Gen. Luis St.", incidents: 449, rateValue: 0.89, rate: "0.89%", risk: "High" },
];

export const modelMetrics = {
  randomForest: { accuracy: 81.6, highPrecision: 12.8, highRecall: 40.2 },
  svm: { accuracy: 69.9, highPrecision: 2.2, highRecall: 77.2 },
  naiveBayes: { accuracy: 47.0, highPrecision: 0.7, highRecall: 87.0 },
};

export const featureImportance = [
  { feature: "Car (count)", value: 21.0 },
  { feature: "Accident Factor", value: 18.8 },
  { feature: "Motorcycle (count)", value: 15.7 },
  { feature: "Collision Type", value: 10.2 },
  { feature: "Truck (count)", value: 8.5 },
];

// --- Map view: approximate coordinates for each corridor ---
// These are manually estimated general locations along each road, NOT properly
// geocoded - good enough for a prototype map, but a real deployment should
// geocode each street/segment centerline properly (e.g. Google Geocoding API,
// or matching against an actual QC road-network GIS layer).
export const corridorCoordinates = {
  "Commonwealth Ave.": [14.6971, 121.0813],
  "EDSA": [14.6560, 121.0294],
  "C-5 Road / Katipunan Ave.": [14.6350, 121.0730],
  "Quezon Ave.": [14.6425, 121.0244],
  "Quirino Highway": [14.7150, 121.0430],
  "Mindanao Ave.": [14.6800, 121.0130],
  "C-5 Road": [14.6100, 121.0650],
  "Aurora Blvd.": [14.6180, 121.0550],
  "Elliptical Road": [14.6510, 121.0490],
  "Congressional Ave.": [14.6650, 121.0330],
  "E. Rodriguez Sr. Ave.": [14.6180, 121.0330],
  "A. Bonifacio Ave.": [14.6600, 121.0100],
  "G. Araneta Ave.": [14.6220, 121.0100],
  "Col. Bonny Serrano Ave.": [14.6180, 121.0620],
  "IBP Road": [14.6720, 121.0620],
  "Regalado Ave.": [14.7250, 121.0550],
  "Visayas Ave.": [14.6720, 121.0350],
  "Timog Ave.": [14.6360, 121.0400],
  "Payatas Road": [14.7080, 121.1080],
  "East Ave.": [14.6480, 121.0430],
  "North Ave.": [14.6560, 121.0350],
  "Tandang Sora Ave.": [14.6870, 121.0530],
  "Del Monte Ave.": [14.6320, 121.0060],
  "Kalayaan Ave.": [14.6350, 121.0680],
  "P. Tuazon Blvd.": [14.6190, 121.0620],
  "Zabarte Road": [14.7320, 121.0480],
  "Tomas Morato Ave.": [14.6330, 121.0380],
  "Panay Ave.": [14.6360, 121.0330],
  "Gen. Luis St.": [14.7250, 121.0680],
};
// Collision Type and Accident Factor have hundreds of messy raw categories in the
// real encoders (see priority_encoders.pkl notes) - these are the curated, cleaned
// options planned for the actual form once the backend/encoder cleanup is done.
export const collisionTypeOptions = [
  "Self Accident",
  "Rear End",
  "Side Swipe",
  "Head On",
  "Hit Pedestrian",
  "Hit Object",
  "Hit and Run",
  "Other",
];

export const accidentFactorOptions = [
  "Human Error",
  "Mechanical Defect",
  "Road Condition",
  "Weather Condition",
];

export const weatherOptions = ["Fair (Day)", "Fair (Night)"];

// Matches feature_columns vehicle-count fields from priority_metadata.yaml, in order.
export const vehicleFields = [
  "Bike", "E-Bike", "E-Trike", "E-Scooter", "Motorcycle", "Tricycle",
  "Car", "PUJ", "Fx / Taxi", "Bus", "Van", "Truck", "Train",
];

// Corridor names for the Report Incident dropdown, reused from the Risk Areas dataset.
export const corridorOptions = allRiskAreas.map((r) => r.corridor);

// Illustrative only: looks up the corridor's historical risk tier from allRiskAreas.
// This is NOT a real model prediction - once FastAPI is wired up, this whole function
// gets replaced by an actual POST to /api/predict-incident.
export function estimateFromHistoricalRisk(corridorName) {
  const match = allRiskAreas.find((r) => r.corridor === corridorName);
  return match ? match.risk : "Medium";
}

// --- Records page: incidents staff have logged through Report Incident ---
// Dates are ISO strings so "Last 7 days" / "Last 30 days" filtering works against
// the real current date, not a hardcoded reference point.
export const loggedIncidents = [
  { id: 1, datetime: "2026-09-22T15:10", corridor: "Commonwealth Ave.", collisionType: "Rear End", priority: "Medium", loggedBy: "J. Santos", status: "Pending review" },
  { id: 2, datetime: "2026-09-21T21:42", corridor: "Katipunan Ave.", collisionType: "Head On", priority: "High", loggedBy: "M. Cruz", status: "Pending review" },
  { id: 3, datetime: "2026-09-20T07:05", corridor: "Quezon Ave.", collisionType: "Hit Pedestrian", priority: "Medium", loggedBy: "J. Santos", status: "Pending review" },
  { id: 4, datetime: "2026-09-18T17:30", corridor: "Payatas Road", collisionType: "Self Accident", priority: "Low", loggedBy: "R. Reyes", status: "Included in training" },
  { id: 5, datetime: "2026-09-10T09:15", corridor: "EDSA", collisionType: "Side Swipe", priority: "Low", loggedBy: "M. Cruz", status: "Included in training" },
  { id: 6, datetime: "2026-08-28T13:50", corridor: "Congressional Ave.", collisionType: "Hit and Run", priority: "High", loggedBy: "R. Reyes", status: "Included in training" },
  { id: 7, datetime: "2026-08-14T06:20", corridor: "Commonwealth Ave.", collisionType: "Rear End", priority: "Low", loggedBy: "J. Santos", status: "Included in training" },
];
