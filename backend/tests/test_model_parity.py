"""
Checks the deployed models against the raw MMDA data (skipped unless RAW_DATA_DIR is set):
  1. On the 25,723-crash test set they score exactly what priority_metadata.yaml reports.
  2. The live API gives the same answer as the training pipeline for the same crash.

    $env:RAW_DATA_DIR = "C:\\path\\to\\folder\\with\\RAW_Data_QC_20XX.xlsx"
    pytest -s tests/test_model_parity.py
"""
import importlib.util
import os
import re
from datetime import datetime

import numpy as np
import pandas as pd
import pytest

RAW_DIR = os.getenv("RAW_DATA_DIR", "").strip()
pytestmark = pytest.mark.skipif(not RAW_DIR, reason="set RAW_DATA_DIR to the folder with the raw Excel files")

BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MONTHS = ["january", "february", "march", "april", "may", "june",
          "july", "august", "september", "october", "november", "december"]


def load_training_script():
    spec = importlib.util.spec_from_file_location("train_models", os.path.join(BACKEND, "scripts", "train_models.py"))
    tm = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tm)
    return tm


def metadata_metrics():
    text = open(os.path.join(BACKEND, "models", "priority_metadata.yaml"), encoding="utf-8").read()
    out = {}
    for key in ("random_forest", "svm", "naive_bayes"):
        block = text.split(f"  {key}:", 1)[1]
        out[key] = {m: float(re.search(rf"{m}: ([0-9.]+)", block).group(1))
                    for m in ("accuracy", "high_precision", "high_recall")}
    return out


def test_models_match_metadata_and_api(admin_client, check):
    from app.ml.features import decide
    from app.ml.predictor import get_predictor

    tm = load_training_script()
    d = tm.read_raw(RAW_DIR)
    X = tm.build_features(d, tm.encode(d))
    y = d["Priority"].values
    _, test_idx = tm.train_test_split(np.arange(len(d)), test_size=0.2, random_state=42, stratify=y)
    check(len(test_idx) == 25723 and (y[test_idx] == "High").sum() == 92, "same test set: 25,723 crashes, 92 fatal")

    predictor = get_predictor()
    expected = metadata_metrics()
    decided = {}
    for key, model in predictor.models.items():
        s = tm.scores(model, X.values[test_idx])
        decided[key] = decide(s, predictor.cutoffs[key])
        got = tm.evaluate(decided[key], y[test_idx], s[:, 0])
        same = all(abs(got[m] - expected[key][m]) < 1e-9 for m in expected[key])
        check(same, f"{key}: precision {got['high_precision']:.1%}, recall {got['high_recall']:.1%}, "
                    f"accuracy {got['accuracy']:.1%} - matches priority_metadata.yaml")

    # Same crashes through the API: all 92 fatal ones plus 300 random others
    rng = np.random.default_rng(0)
    picks = np.r_[np.where(y[test_idx] == "High")[0], rng.choice(len(test_idx), 300, replace=False)]
    mismatches = skipped = 0
    for p in picks:
        r = d.iloc[test_idx[p]]
        try:
            month = MONTHS.index(str(r["Month"]).strip().lower()) + 1
            when = datetime(int(r["Year"]), month, int(r["Day"]), int(r["Hour"]), int(r["Minute"]))
        except ValueError:
            skipped += 1  # impossible dates in the source data (e.g. Feb 30) can't be typed into the form
            continue
        vehicles = {f: int(pd.to_numeric(r[f], errors="coerce") or 0) for f in tm.VEHICLE_FIELDS}
        out = admin_client.post("/api/predict-incident", json={
            "incident_datetime": when.isoformat(), "weather": str(r["Weather"]),
            "collision_type": str(r["Collision Type"]), "accident_factor": str(r["Accident Factor"]),
            "vehicles": vehicles}).json()["predictions"]
        mismatches += any(out[k]["label"] != decided[k][p] for k in decided)
    check(mismatches == 0, f"API matches the training pipeline on {len(picks) - skipped} crashes ({mismatches} mismatches)")
