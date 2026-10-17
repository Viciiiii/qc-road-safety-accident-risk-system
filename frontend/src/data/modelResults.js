// Static figures the app shows that don't come from the API.
// modelMetrics and featureImportance are the real test results of the deployed models
// (backend/models/priority_metadata.yaml, written by backend/scripts/train_models.py).
// Trained on 2022-2023, settings and cutoffs chosen on 2024, tested once on all 35,504 crashes
// from 2025 (106 of them fatal). Corridor data and incidents come from the backend.

export const modelMetrics = {
  randomForest: { accuracy: 85.5, highPrecision: 26.5, highRecall: 46.2, flagged: 185, caught: 49, prAuc: 0.283, fatalCalledLow: 28 },
  svm: { accuracy: 81.9, highPrecision: 13.3, highRecall: 50.9, flagged: 406, caught: 54, prAuc: 0.124, fatalCalledLow: 12 },
  naiveBayes: { accuracy: 80.5, highPrecision: 5.8, highRecall: 17.0, flagged: 310, caught: 18, prAuc: 0.039, fatalCalledLow: 27 },
};
// The previous version of the models (48 inputs without location, settings from a random 80/20 split,
// cutoffs set to keep recall high), retrained on 2022-2023 and tested on the same 2025 crashes.
export const previousMetrics = {
  randomForest: { accuracy: 84.6, highPrecision: 12.4, highRecall: 58.5, flagged: 498, caught: 62, prAuc: 0.221 },
  svm: { accuracy: 75.7, highPrecision: 2.9, highRecall: 87.7, flagged: 3158, caught: 93, prAuc: 0.151 },
  naiveBayes: { accuracy: 64.9, highPrecision: 1.0, highRecall: 84.0, flagged: 8805, caught: 89, prAuc: 0.041 },
};
// Random Forest without the street-history inputs (same setting, same test): what location adds.
export const withoutHistory = { randomForest: { highPrecision: 17.0, highRecall: 43.4, prAuc: 0.207 } };
export const TEST_CRASHES = 35504;
export const TEST_FATAL = 106;
export const FATAL_BASE_RATE = 0.3; // % of 2025 crashes that were fatal (106 of 35,504)

export const featureImportance = [
  { feature: "Two-wheelers involved (count)", value: 14.1 },
  { feature: "Motorcycle involved", value: 12.7 },
  { feature: "Motorcycle (count)", value: 12.6 },
  { feature: "Car (count)", value: 6.8 },
  { feature: "Collision: hit pedestrian", value: 6.3 },
];
export const STREET_HISTORY_IMPORTANCE = 4.6; // the four street-history inputs together
export const vehicleFields = [
  "Bike", "E-Bike", "E-Trike", "E-Scooter", "Motorcycle", "Tricycle",
  "Car", "PUJ", "Fx / Taxi", "Bus", "Van", "Truck", "Train",
];
