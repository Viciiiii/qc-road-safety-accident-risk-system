"""
Trains the three priority models the app uses and writes them to backend/models/.

    python scripts/train_models.py "C:/path/to/folder/with/RAW_Data_QC_20XX.xlsx"

What it does, in order:
  1. Reads the four MMDA files (sheet "QC road crash data"), cleans them the same way the
     original notebook did, and maps Classification -> Priority (Fatal=High,
     Non Fatal Injury=Medium, Damage to Property=Low).
  2. Splits 80/20 (random_state=42, stratified) - the same split as the notebook, so the
     test set is the same 25,723 crashes.
  3. Builds the features with app/ml/features.py (the same code the API uses).
  4. For each model, picks the High cutoff with 3-fold cross-validation on the TRAINING
     set only: the cutoff at which cross-validated recall reaches TARGET_RECALL.
  5. Trains each model on the full training set, evaluates once on the test set, and
     saves the models, priority_model_config.json (cutoffs) and priority_metadata.yaml.

The settings below were chosen in a separate experiment (cross-validated on the training
set, average precision for High as the yardstick). See README -> "Improving precision".
"""
import json
import os
import pickle
import sys
import warnings
from datetime import date

import numpy as np
import openpyxl
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import average_precision_score, confusion_matrix
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from app.ml.features import (  # noqa: E402
    ENCODED_COLUMNS, FEATURE_COLUMNS, VEHICLE_FIELDS, build_features, decide,
)

MODELS_DIR = os.path.join(HERE, "..", "models")
RAW_DIR = sys.argv[1] if len(sys.argv) > 1 else "."
YEARS = (2022, 2023, 2024, 2025)
CLASSES = ["High", "Medium", "Low"]

# The cutoff keeps each model catching at least as many fatal crashes as the
# previous (pre-feature-engineering) model did on the test set.
TARGET_RECALL = {"random_forest": 0.4022, "svm": 0.7717, "naive_bayes": 0.8696}


def smote_full(X, y):
    return SMOTE(random_state=42).fit_resample(X, y)


def smote_gentle(X, y):  # raise High to 10% of the Low count only
    return SMOTE(sampling_strategy={"High": int(0.1 * (y == "Low").sum())}, random_state=42).fit_resample(X, y)


def no_resampling(X, y):
    return X, y


MODELS = {
    "random_forest": dict(
        make=lambda: RandomForestClassifier(n_estimators=100, max_depth=15, min_samples_leaf=5,
                                            n_jobs=-1, random_state=42),
        resample=smote_gentle,
        summary="Random Forest (100 trees, depth 15, min leaf 5); gentler SMOTE (High raised to 10% of Low)"),
    "svm": dict(
        make=lambda: make_pipeline(StandardScaler(),
                                   LinearSVC(C=0.01, class_weight="balanced", random_state=42, max_iter=5000)),
        resample=no_resampling,
        summary="Linear SVM (C=0.01) on standardised features; balanced class weights, no SMOTE"),
    "naive_bayes": dict(
        make=lambda: GaussianNB(),
        resample=smote_full,
        summary="Gaussian Naive Bayes; SMOTE (all classes balanced)"),
}


def read_raw():
    frames = []
    wanted = ["Hour", "Minute", "Day", "Month", "Weather", "Collision Type", "Accident Factor",
              "District (City)", "Street", "Classification"] + VEHICLE_FIELDS
    for year in YEARS:
        path = os.path.join(RAW_DIR, f"RAW_Data_QC_{year}.xlsx")
        ws = openpyxl.load_workbook(path, read_only=True, data_only=True)["QC road crash data"]
        rows = ws.iter_rows(max_col=60, values_only=True)   # sheets declare ~16k empty columns
        header = [h if h is not None else f"_c{i}" for i, h in enumerate(next(rows))]
        df = pd.DataFrame(list(rows), columns=header)
        df = df[[c for c in wanted if c in df.columns]]     # 2022-2024 have no E-Bike/E-Trike/E-Scooter
        df["Year"] = year
        frames.append(df)
        print(f"  {year}: {len(df):,} rows")
    d = pd.concat(frames, ignore_index=True)
    for c in VEHICLE_FIELDS:
        d[c] = d[c].fillna(0)
    for c in ["District (City)", "Street", "Weather", "Collision Type", "Accident Factor"]:
        d[c] = d[c].fillna("Unknown")
    d = d.dropna(subset=["Hour", "Minute", "Day", "Classification"])
    d["Priority"] = d["Classification"].map({"Fatal": "High", "Non Fatal Injury": "Medium",
                                             "Damage to Property": "Low"})
    return d.dropna(subset=["Priority"]).reset_index(drop=True)


def encode(d):
    with open(os.path.join(MODELS_DIR, "priority_encoders.pkl"), "rb") as f:
        encoders = pickle.load(f)
    return pd.DataFrame({c: encoders[c].transform(d[c].astype(str)) for c in ENCODED_COLUMNS}, index=d.index)


def scores(model, X):
    s = model.predict_proba(X) if hasattr(model, "predict_proba") else model.decision_function(X)
    return pd.DataFrame(s, columns=list(model.classes_))[CLASSES].values


def cutoff_for_recall(high_scores, is_high, recall):
    ranked = np.sort(high_scores[is_high])[::-1]
    return float(ranked[int(np.ceil(recall * is_high.sum())) - 1])


def evaluate(pred, y_true, high_scores):
    hi = y_true == "High"
    tp = int(((pred == "High") & hi).sum())
    flagged = int((pred == "High").sum())
    return dict(accuracy=float((pred == y_true).mean()),
                high_precision=tp / flagged if flagged else 0.0,
                high_recall=tp / int(hi.sum()),
                high_flagged=flagged, high_caught=tp, high_total=int(hi.sum()),
                high_average_precision=float(average_precision_score(hi, high_scores)),
                confusion_matrix=confusion_matrix(y_true, pred, labels=CLASSES).tolist())


def main():
    import joblib
    print("Reading raw data...")
    d = read_raw()
    X = build_features(d, encode(d))
    y = d["Priority"].values
    idx_train, idx_test = train_test_split(np.arange(len(d)), test_size=0.2, random_state=42, stratify=y)
    X_train, X_test = X.values[idx_train], X.values[idx_test]
    y_train, y_test = y[idx_train], y[idx_test]
    print(f"Train {len(y_train):,} / test {len(y_test):,} (test High: {(y_test == 'High').sum()})")

    folds = StratifiedKFold(3, shuffle=True, random_state=42)
    config, results = {"feature_columns": FEATURE_COLUMNS, "models": {}}, {}
    for key, spec in MODELS.items():
        print(f"\n{key}: choosing cutoff with 3-fold CV on the training set...")
        oof = np.zeros((len(y_train), 3))
        for a, b in folds.split(X_train, y_train):
            Xr, yr = spec["resample"](X_train[a], y_train[a])
            oof[b] = scores(spec["make"]().fit(Xr, yr), X_train[b])
        cutoff = cutoff_for_recall(oof[:, 0], y_train == "High", TARGET_RECALL[key])

        Xr, yr = spec["resample"](X_train, y_train)
        model = spec["make"]().fit(Xr, yr)
        joblib.dump(model, os.path.join(MODELS_DIR, f"priority_{key}.pkl"), compress=3)
        s = scores(model, X_test)
        results[key] = evaluate(decide(s, cutoff), y_test, s[:, 0])
        config["models"][key] = {"file": f"priority_{key}.pkl", "high_cutoff": cutoff,
                                 "score": "probability" if hasattr(model, "predict_proba") else "decision_function",
                                 "summary": spec["summary"]}
        r = results[key]
        print(f"  cutoff {cutoff:.4f} -> test precision {r['high_precision']:.1%}, recall {r['high_recall']:.1%}, "
              f"accuracy {r['accuracy']:.1%} ({r['high_caught']}/{r['high_total']} fatal caught, {r['high_flagged']} flagged)")
        if key == "random_forest":
            imp = sorted(zip(FEATURE_COLUMNS, model.feature_importances_), key=lambda t: -t[1])
            results[key]["top_features"] = [(n, round(float(v) * 100, 1)) for n, v in imp[:10]]
            print("  top features:", results[key]["top_features"][:5])

    with open(os.path.join(MODELS_DIR, "priority_model_config.json"), "w") as f:
        json.dump(config, f, indent=2)
    with open(os.path.join(MODELS_DIR, "priority_metadata.yaml"), "w") as f:
        f.write(f"trained_on: QC road crash data 2022-2025 (trained {date.today().isoformat()})\n")
        f.write("priority_mapping_source: 'Derived from Classification: Fatal=High, Non Fatal Injury=Medium, "
                "Damage to Property=Low'\n")
        f.write("split: 80/20 stratified, random_state=42 (test set = 25,723 crashes, 92 High)\n")
        f.write("decision_rule: High if the model's High score >= high_cutoff, otherwise the larger of Medium/Low\n")
        f.write("cutoff_selection: 3-fold cross-validation on the training set; cutoff reaches the previous "
                "model's High recall\n")
        f.write("excluded_leakage_columns: [Drivers Killed, Drivers Injured, Pass. Killed, Pass Injured, "
                "Pedestrian Killed, Pedestrian Injured]\n")
        f.write("feature_columns:\n" + "".join(f"- {c}\n" for c in FEATURE_COLUMNS))
        f.write("models:\n")
        for key, r in results.items():
            m = config["models"][key]
            f.write(f"  {key}:\n    file: {m['file']}\n    summary: '{m['summary']}'\n"
                    f"    high_cutoff: {m['high_cutoff']}\n    accuracy: {r['accuracy']}\n"
                    f"    high_precision: {r['high_precision']}\n    high_recall: {r['high_recall']}\n"
                    f"    high_flagged: {r['high_flagged']}\n    high_caught: {r['high_caught']}\n"
                    f"    high_average_precision: {r['high_average_precision']}\n"
                    f"    confusion_matrix_rows_true_cols_pred_HML: {r['confusion_matrix']}\n")
        f.write("priority_labels: [High, Medium, Low]\n")
    print("\nSaved models, priority_model_config.json and priority_metadata.yaml to", os.path.abspath(MODELS_DIR))


if __name__ == "__main__":
    main()
