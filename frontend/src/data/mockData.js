// Static figures the app shows that don't come from the API.
// modelMetrics and featureImportance are the real held-out test results of the
// trained models (backend/models/priority_metadata.yaml and the Random Forest's
// feature_importances_). Corridor data and incidents now come from the backend.

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
export const vehicleFields = [
  "Bike", "E-Bike", "E-Trike", "E-Scooter", "Motorcycle", "Tricycle",
  "Car", "PUJ", "Fx / Taxi", "Bus", "Van", "Truck", "Train",
];
