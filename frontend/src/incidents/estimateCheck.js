// Compares a model's estimated priority with the confirmed outcome of the same crash.
// The outcome is turned into a priority the same way the training labels were:
// Fatal = High, Non Fatal Injury = Medium, Damage to Property = Low.

export const OUTCOME_PRIORITY = { Fatal: "High", "Non Fatal Injury": "Medium", "Damage to Property": "Low" };
const LEVEL = { Low: 0, Medium: 1, High: 2 };

export const MODELS = [
  { key: "priority", name: "Random Forest" },   // the estimate shown as "Estimated Priority"
  { key: "svmPriority", name: "SVM" },
  { key: "nbPriority", name: "Naive Bayes" },
];

// "correct" | "under" (estimate was less serious than reality) | "over" | null (nothing to compare)
export function compareEstimate(estimate, confirmedOutcome) {
  const actual = OUTCOME_PRIORITY[confirmedOutcome];
  if (!estimate || !actual) return null;
  if (estimate === actual) return "correct";
  return LEVEL[estimate] < LEVEL[actual] ? "under" : "over";
}

// Tally for one model across incidents that have both its estimate and a confirmed outcome.
export function tally(incidents, modelKey) {
  const t = { compared: 0, correct: 0, under: 0, over: 0, fatal: 0, fatalFlaggedHigh: 0 };
  for (const i of incidents) {
    const result = compareEstimate(i[modelKey], i.confirmedOutcome);
    if (!result) continue;
    t.compared += 1;
    t[result] += 1;
    if (i.confirmedOutcome === "Fatal") {
      t.fatal += 1;
      if (i[modelKey] === "High") t.fatalFlaggedHigh += 1;
    }
  }
  t.accuracy = t.compared ? Math.round((t.correct / t.compared) * 100) : null;
  return t;
}

// Below this many confirmed incidents the figures are anecdotes, not evidence.
export const SMALL_SAMPLE = 30;
