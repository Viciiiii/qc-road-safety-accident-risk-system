"""
Trains the three priority models the app uses and writes them to backend/models/.

    python scripts/train_models.py "C:/path/to/folder/with/RAW_Data_QC_20XX.xlsx"

A fair comparison: the three models get exactly the same treatment.
  1. Data: the four MMDA files (sheet "QC road crash data"), Classification -> Priority
     (Fatal = High, Non Fatal Injury = Medium, Damage to Property = Low).
  2. Split by year: train on 2022-2023, choose settings and cutoffs on 2024, test once on 2025.
     This is how the app is used: models built on past years, applied to crashes that come later.
  3. Inputs (app/ml/features.py, the same code the API uses): time, vehicles, engineered flags,
     category columns as one column per value, and street history from the training years.
     Street history for training crashes is computed out-of-fold (5 folds), so a crash never sees
     its own outcome.
  4. Tuning: 6 settings per model, the one with the best High PR-AUC on 2024 is kept.
  5. Cutoff: the High cutoff that maximises F2 on 2024 (recall weighted above precision).
  6. Evaluation: once, on 2025. Also on 2025 corridor crashes only (what the app predicts), and
     without the street history (to measure what location adds).
The deployed models are exactly the evaluated ones (trained on 2022-2023).

Writes: priority_<model>.pkl, priority_model_config.json (inputs, categories, cutoffs),
priority_street_history.json (street lookups) and priority_metadata.yaml (all results).
"""
import json
import os
import re
import sys
import time
import warnings
from datetime import date

import numpy as np
import openpyxl
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import average_precision_score, balanced_accuracy_score, confusion_matrix, precision_recall_curve
from sklearn.model_selection import KFold
from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import QuantileTransformer, StandardScaler
from sklearn.svm import LinearSVC

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from app.ml.features import (  # noqa: E402
    CATEGORY_COLUMNS, CLASSES, HISTORY_COLUMNS, VEHICLE_FIELDS, build_features, category_value, decide,
    feature_columns, history_features, make_history, model_scores, street_key,
)

MODELS_DIR = os.path.join(HERE, "..", "models")
DB_DIR = os.path.join(HERE, "..", "db")
RAW_DIR = sys.argv[1] if __name__ == "__main__" and len(sys.argv) > 1 else "."
YEARS = (2022, 2023, 2024, 2025)
TRAIN_YEARS, VALIDATION_YEAR, TEST_YEAR = (2022, 2023), 2024, 2025
MIN_CATEGORY_COUNT = 20      # rarer category values are grouped as "Other"
HISTORY_SMOOTHING = 20
KEYS = {"random_forest": "Random Forest", "svm": "SVM", "naive_bayes": "Naive Bayes"}


# ---------- the 6 settings tried per model ----------

def gentle_smote(X, y):  # raise High to 10% of the Low count only
    return SMOTE(sampling_strategy={"High": int(0.1 * (y == "Low").sum())}, random_state=42).fit_resample(X, y)


def full_smote(X, y):
    return SMOTE(random_state=42).fit_resample(X, y)


def no_resampling(X, y):
    return X, y


def _rf(depth, leaf, weights):
    return lambda: RandomForestClassifier(n_estimators=200, max_depth=depth, min_samples_leaf=leaf,
                                          class_weight=weights, n_jobs=-1, random_state=42)


def _svm(c):
    return lambda: make_pipeline(StandardScaler(), LinearSVC(C=c, class_weight="balanced", random_state=42, max_iter=5000))


def _normal_nb(smoothing=1e-9):
    return lambda: make_pipeline(QuantileTransformer(output_distribution="normal", n_quantiles=200, random_state=42),
                                 GaussianNB(var_smoothing=smoothing))


SETTINGS = {
    "random_forest": [
        ("200 trees, depth 15, min leaf 5, gentler SMOTE", _rf(15, 5, None), gentle_smote),
        ("200 trees, depth 15, min leaf 5, balanced class weights", _rf(15, 5, "balanced_subsample"), no_resampling),
        ("200 trees, no depth limit, min leaf 5, balanced class weights", _rf(None, 5, "balanced_subsample"), no_resampling),
        ("200 trees, no depth limit, min leaf 25, balanced class weights", _rf(None, 25, "balanced_subsample"), no_resampling),
        ("200 trees, depth 20, min leaf 10, gentler SMOTE", _rf(20, 10, None), gentle_smote),
        ("200 trees, no depth limit, min leaf 25, gentler SMOTE", _rf(None, 25, None), gentle_smote),
    ],
    "svm": [(f"linear, C = {c}, standardised inputs, balanced class weights", _svm(c), no_resampling)
            for c in (0.0003, 0.001, 0.003, 0.01, 0.1, 1.0)],
    "naive_bayes": [
        ("Gaussian, SMOTE", lambda: GaussianNB(), full_smote),
        ("Gaussian, no resampling", lambda: GaussianNB(), no_resampling),
        ("Gaussian, var_smoothing 0.1", lambda: GaussianNB(var_smoothing=0.1), no_resampling),
        ("Gaussian on normal-shaped inputs, var_smoothing 0.01", _normal_nb(0.01), no_resampling),
        ("Gaussian on normal-shaped inputs, var_smoothing 0.1", _normal_nb(0.1), no_resampling),
        ("Gaussian on normal-shaped inputs, SMOTE", _normal_nb(), full_smote),
    ],
}


# ---------- data ----------

def read_raw(raw_dir=None):
    raw_dir = raw_dir or RAW_DIR
    frames = []
    wanted = ["Hour", "Minute", "Day", "Month", "Weather", "Collision Type", "Accident Factor",
              "District (City)", "Street", "Classification"] + VEHICLE_FIELDS
    for year in YEARS:
        path = os.path.join(raw_dir, f"RAW_Data_QC_{year}.xlsx")
        ws = openpyxl.load_workbook(path, read_only=True, data_only=True)["QC road crash data"]
        rows = ws.iter_rows(max_col=60, values_only=True)   # sheets declare ~16k empty columns
        header = [h if h is not None else f"_c{i}" for i, h in enumerate(next(rows))]
        df = pd.DataFrame(list(rows), columns=header)
        df = df[[c for c in wanted if c in df.columns]]     # 2022-2024 have no E-Bike/E-Trike/E-Scooter
        df["Year"] = year                                   # the file's year (one 2025 row says "202")
        frames.append(df)
        print(f"  {year}: {len(df):,} rows")
    d = pd.concat(frames, ignore_index=True)
    for c in VEHICLE_FIELDS:
        if c not in d:
            d[c] = 0
        d[c] = d[c].fillna(0)
    for c in ["District (City)", "Street", "Weather", "Collision Type", "Accident Factor"]:
        d[c] = d[c].fillna("Unknown")
    d = d.dropna(subset=["Hour", "Minute", "Day", "Classification"])
    d["Priority"] = d["Classification"].map({"Fatal": "High", "Non Fatal Injury": "Medium",
                                             "Damage to Property": "Low"})
    d = d.dropna(subset=["Priority"]).reset_index(drop=True)
    d["Hour"] = pd.to_numeric(d["Hour"], errors="coerce").astype(int)
    d["street"] = street_key(d["Street"])
    d["is_high"] = (d["Priority"] == "High").astype(int)
    return d


def corridors():
    seed = open(os.path.join(DB_DIR, "02_seed_risk_areas.sql"), encoding="utf-8").read()
    return [c.replace("''", "'") for c in re.findall(r"VALUES \('((?:[^']|'')*)'", seed)]


def on_corridor(d):
    """Same matching as build_corridor_monthly.py (the ranking)."""
    name = d["Street"].astype(str).str.strip().str.replace(r"\s+", " ", regex=True)
    name = name.str.replace(r"\s*\((NB|SB|EB|WB)\)$", "", regex=True)
    return name.isin(set(corridors())).values


def choose_categories(d_train):
    cats = {}
    for col in CATEGORY_COLUMNS:
        counts = category_value(col, d_train[col]).value_counts()
        cats[col] = sorted(counts[counts >= MIN_CATEGORY_COUNT].index.tolist())
    return cats


def out_of_fold_history(d_train):
    """History inputs for training crashes, each computed from the other 4 folds only."""
    h = pd.DataFrame(index=d_train.index, columns=HISTORY_COLUMNS, dtype=float)
    pos = np.arange(len(d_train))
    for a, b in KFold(5, shuffle=True, random_state=42).split(pos):
        part = d_train.iloc[a].rename(columns={"Hour": "hour"})
        tables = make_history(part[["street", "hour", "is_high"]], HISTORY_SMOOTHING)
        rows = d_train.iloc[b]
        h.iloc[b] = history_features(rows["street"], rows["Hour"], tables).values
    return h


def build_all(d):
    """Inputs for every crash: out-of-fold history for training years, training-year history for the rest."""
    tr = d["Year"].isin(TRAIN_YEARS).values
    cats = choose_categories(d[tr])
    tables = make_history(d[tr].rename(columns={"Hour": "hour"})[["street", "hour", "is_high"]], HISTORY_SMOOTHING)
    hist = pd.DataFrame(index=d.index, columns=HISTORY_COLUMNS, dtype=float)
    hist.loc[tr] = out_of_fold_history(d[tr]).values
    hist.loc[~tr] = history_features(d.loc[~tr, "street"], d.loc[~tr, "Hour"], tables).values
    X = build_features(d, cats, hist)
    return X, cats, tables


# ---------- evaluation ----------

def f2_cutoff(is_high, high_scores):
    p, r, t = precision_recall_curve(is_high, high_scores)
    f2 = 5 * p[:-1] * r[:-1] / np.maximum(4 * p[:-1] + r[:-1], 1e-9)
    return float(t[np.argmax(f2)])


def evaluate(pred, y_true, high_scores):
    hi = y_true == "High"
    flagged = pred == "High"
    tp = int((flagged & hi).sum())
    out = dict(accuracy=float((pred == y_true).mean()),
               balanced_accuracy=float(balanced_accuracy_score(y_true, pred)),
               high_precision=tp / int(flagged.sum()) if flagged.sum() else 0.0,
               high_recall=tp / int(hi.sum()),
               high_flagged=int(flagged.sum()), high_caught=tp, high_total=int(hi.sum()),
               high_average_precision=float(average_precision_score(hi, high_scores)),
               fatal_called_low=int((hi & (pred == "Low")).sum()),
               high_flags_serious=float(np.isin(y_true[flagged], ["High", "Medium"]).mean()) if flagged.sum() else 0.0)
    for i, c in enumerate(CLASSES):
        tp_c = int(((pred == c) & (y_true == c)).sum())
        out[f"{c.lower()}_precision"] = tp_c / max(int((pred == c).sum()), 1)
        out[f"{c.lower()}_recall"] = tp_c / max(int((y_true == c).sum()), 1)
    f1 = [2 * out[f"{c.lower()}_precision"] * out[f"{c.lower()}_recall"] /
          max(out[f"{c.lower()}_precision"] + out[f"{c.lower()}_recall"], 1e-12) for c in CLASSES]
    out["macro_f1"] = float(np.mean(f1))
    out["confusion_matrix"] = confusion_matrix(y_true, pred, labels=CLASSES).tolist()
    return out


def fit(spec, X, y):
    _, make, resample = spec
    Xr, yr = resample(X, y)
    return make().fit(Xr, yr)


def main():
    import joblib
    print("Reading raw data...")
    d = read_raw()
    X, cats, tables = build_all(d)
    cols = list(X.columns)
    y = d["Priority"].values
    tr = d["Year"].isin(TRAIN_YEARS).values
    va = (d["Year"] == VALIDATION_YEAR).values
    te = (d["Year"] == TEST_YEAR).values
    corr = on_corridor(d)
    print(f"Train {tr.sum():,} ({'-'.join(map(str, TRAIN_YEARS))}) / choose {va.sum():,} ({VALIDATION_YEAR}) / "
          f"test {te.sum():,} ({TEST_YEAR}); fatal {d.is_high[tr].sum()}/{d.is_high[va].sum()}/{d.is_high[te].sum()}; "
          f"{len(cols)} inputs")

    no_hist = [i for i, c in enumerate(cols) if c not in HISTORY_COLUMNS]
    Xv = X.values
    config = {"split": {"train_years": list(TRAIN_YEARS), "validation_year": VALIDATION_YEAR, "test_year": TEST_YEAR},
              "feature_columns": cols, "categories": cats, "history_file": "priority_street_history.json",
              "models": {}}
    results, tuning = {}, []
    for key, options in SETTINGS.items():
        best = None
        for spec in options:
            t0 = time.time()
            model = fit(spec, Xv[tr], y[tr])
            ap = float(average_precision_score(y[va] == "High", model_scores(model, Xv[va])[:, 0]))
            tuning.append((key, spec[0], ap))
            print(f"  {KEYS[key]:13s} {spec[0]:62s} 2024 PR-AUC {ap:.4f} ({time.time() - t0:.0f}s)")
            if best is None or ap > best[0]:
                best = (ap, spec, model)
        ap, spec, model = best
        s_va, s_te = model_scores(model, Xv[va]), model_scores(model, Xv[te])
        cutoff = f2_cutoff(y[va] == "High", s_va[:, 0])
        pred = decide(s_te, cutoff)
        r = {"setting": spec[0], "validation_average_precision": ap, "high_cutoff": cutoff,
             "test": evaluate(pred, y[te], s_te[:, 0]),
             "test_corridors": evaluate(pred[corr[te]], y[te][corr[te]], s_te[corr[te], 0])}
        # Ablation: the same setting without the street history
        m2 = fit(spec, Xv[tr][:, no_hist], y[tr])
        s2_va, s2_te = model_scores(m2, Xv[va][:, no_hist]), model_scores(m2, Xv[te][:, no_hist])
        r["test_without_history"] = evaluate(decide(s2_te, f2_cutoff(y[va] == "High", s2_va[:, 0])), y[te], s2_te[:, 0])
        if key == "random_forest":
            imp = sorted(zip(cols, model.feature_importances_), key=lambda t: -t[1])
            r["top_features"] = [(n, round(float(v) * 100, 1)) for n, v in imp[:10]]
        results[key] = r
        joblib.dump(model, os.path.join(MODELS_DIR, f"priority_{key}.pkl"), compress=3)
        config["models"][key] = {"file": f"priority_{key}.pkl", "high_cutoff": cutoff,
                                 "score": {"random_forest": "probability", "svm": "decision_function",
                                           "naive_bayes": "log_odds"}[key],
                                 "setting": spec[0]}
        t = r["test"]
        print(f"  -> {KEYS[key]}: {spec[0]}; cutoff {cutoff:.4f}; 2025: precision {t['high_precision']:.1%}, "
              f"recall {t['high_recall']:.1%}, accuracy {t['accuracy']:.1%}, PR-AUC {t['high_average_precision']:.3f} "
              f"({t['high_caught']}/{t['high_total']} fatal caught, {t['high_flagged']} flagged)")

    with open(os.path.join(MODELS_DIR, "priority_model_config.json"), "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    with open(os.path.join(MODELS_DIR, "priority_street_history.json"), "w", encoding="utf-8") as f:
        json.dump(tables, f, separators=(",", ":"))
    write_metadata(results, tuning, d, tr, va, te, corr, len(cols))
    print("\nSaved models, priority_model_config.json, priority_street_history.json and priority_metadata.yaml to",
          os.path.abspath(MODELS_DIR))


def write_metadata(results, tuning, d, tr, va, te, corr, n_inputs):
    fmt = lambda v: repr(round(v, 6)) if isinstance(v, float) else str(v)
    lines = [
        f"trained_on: QC road crash data 2022-2025 (trained {date.today().isoformat()})",
        "priority_mapping_source: 'Derived from Classification: Fatal=High, Non Fatal Injury=Medium, Damage to Property=Low'",
        f"split: train {'-'.join(map(str, TRAIN_YEARS))} ({tr.sum()} crashes, {d.is_high[tr].sum()} fatal); "
        f"settings and cutoffs chosen on {VALIDATION_YEAR} ({va.sum()} crashes, {d.is_high[va].sum()} fatal); "
        f"test {TEST_YEAR} ({te.sum()} crashes, {d.is_high[te].sum()} fatal; {corr[te].sum()} on the 29 corridors, "
        f"{d.is_high[te & corr].sum()} fatal)",
        "decision_rule: High if the model's High score >= high_cutoff, otherwise the larger of Medium/Low",
        f"model_selection: 6 settings per model, best High PR-AUC on {VALIDATION_YEAR}; cutoff maximises F2 on {VALIDATION_YEAR}",
        f"inputs: {n_inputs} (time, vehicles, engineered flags, one column per category value, street history)",
        "excluded_leakage_columns: [Drivers Killed, Drivers Injured, Pass. Killed, Pass Injured, Pedestrian Killed, Pedestrian Injured]",
        "models:",
    ]
    for key, r in results.items():   # the deployed models' 2025 results come first (read by tests/test_model_parity.py)
        lines += [f"  {key}:", f"    file: priority_{key}.pkl", f"    setting: '{r['setting']}'",
                  f"    high_cutoff: {r['high_cutoff']!r}", f"    validation_average_precision: {r['validation_average_precision']:.6f}"]
        lines += [f"    {k}: {fmt(v)}" for k, v in r["test"].items()]
    for section, title in (("test_corridors", "test_on_corridors_only"), ("test_without_history", "test_without_street_history")):
        lines.append(f"{title}:")
        for key, r in results.items():
            lines.append(f"  {key}:")
            lines += [f"    {k}: {fmt(v)}" for k, v in r[section].items() if k != "confusion_matrix"]
    lines.append("random_forest_top_features:")
    lines += [f"  - [{n!r}, {v}]" for n, v in results["random_forest"]["top_features"]]
    lines.append(f"tuning_{VALIDATION_YEAR}_average_precision:")
    lines += [f"  - [{k}, '{s}', {ap:.4f}]" for k, s, ap in tuning]
    lines.append("priority_labels: [High, Medium, Low]")
    with open(os.path.join(MODELS_DIR, "priority_metadata.yaml"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
