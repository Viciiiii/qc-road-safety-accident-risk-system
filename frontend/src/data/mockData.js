// Static figures the app shows that don't come from the API.
// modelMetrics and featureImportance are the real held-out test results of the deployed
// models (backend/models/priority_metadata.yaml, written by backend/scripts/train_models.py).
// Test set: 25,723 crashes, 92 of them fatal. Corridor data and incidents come from the backend.

export const modelMetrics = {
  randomForest: { accuracy: 84.4, highPrecision: 15.8, highRecall: 45.7, flagged: 265, caught: 42 },
  svm: { accuracy: 77.7, highPrecision: 4.3, highRecall: 83.7, flagged: 1786, caught: 77 },
  naiveBayes: { accuracy: 72.1, highPrecision: 2.1, highRecall: 91.3, flagged: 3922, caught: 84 },
};
// The first version of the models (21 raw features, full SMOTE, highest score wins), same test set.
export const previousMetrics = {
  randomForest: { accuracy: 81.6, highPrecision: 12.8, highRecall: 40.2, flagged: 288, caught: 37 },
  svm: { accuracy: 69.9, highPrecision: 2.2, highRecall: 77.2, flagged: 3179, caught: 71 },
  naiveBayes: { accuracy: 47.0, highPrecision: 0.7, highRecall: 87.0, flagged: 11938, caught: 80 },
};
export const TEST_FATAL = 92;
export const FATAL_BASE_RATE = 0.36; // % of all crashes that were fatal

export const featureImportance = [
  { feature: "Two-wheelers involved (count)", value: 17.7 },
  { feature: "Motorcycle involved", value: 12.9 },
  { feature: "Motorcycle (count)", value: 11.7 },
  { feature: "Collision: hit pedestrian", value: 6.6 },
  { feature: "Car (count)", value: 6.4 },
];
export const vehicleFields = [
  "Bike", "E-Bike", "E-Trike", "E-Scooter", "Motorcycle", "Tricycle",
  "Car", "PUJ", "Fx / Taxi", "Bus", "Van", "Truck", "Train",
];
