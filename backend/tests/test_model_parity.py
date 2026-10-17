"""
Checks the deployed models against the raw MMDA data (skipped unless RAW_DATA_DIR is set):
  1. On the 2025 test year they score exactly what priority_metadata.yaml reports.
  2. The live API gives the same answer as the training pipeline for the same crash
     (2025 crashes on the 29 corridors, entered the way the form sends them).

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
    models_block = text.split("\nmodels:\n", 1)[1]           # the deployed models' 2025 results come first
    out = {}
    for key in ("random_forest", "svm", "naive_bayes"):
        block = models_block.split(f"  {key}:", 1)[1]
        out[key] = {m: float(re.search(rf"\n    {m}: ([0-9.]+)", block).group(1))
                    for m in ("accuracy", "high_precision", "high_recall", "high_average_precision")}
    return out


def test_models_match_metadata_and_api(admin_client, check):
    from app.ml.features import decide, model_scores
    from app.ml.predictor import get_predictor

    tm = load_training_script()
    d = tm.read_raw(RAW_DIR)
    X, _, _ = tm.build_all(d)
    y = d["Priority"].values
    test = (d["Year"] == tm.TEST_YEAR).values
    check(test.sum() == 35504 and (y[test] == "High").sum() == 106, "same test year: 35,504 crashes in 2025, 106 fatal")

    predictor = get_predictor()
    check(list(X.columns) == predictor.columns, f"training and the API build the same {len(predictor.columns)} inputs")
    expected = metadata_metrics()
    for key, model in predictor.models.items():
        s = model_scores(model, X.values[test])
        got = tm.evaluate(decide(s, predictor.cutoffs[key]), y[test], s[:, 0])
        same = all(abs(got[m] - expected[key][m]) < 1e-5 for m in expected[key])
        check(same, f"{key}: precision {got['high_precision']:.1%}, recall {got['high_recall']:.1%}, "
                    f"accuracy {got['accuracy']:.1%}, PR-AUC {got['high_average_precision']:.3f} - matches priority_metadata.yaml")

    # Same crashes through the API: every fatal 2025 crash on a corridor plus 300 random others
    on_corridor = np.where(test & tm.on_corridor(d))[0]
    rng = np.random.default_rng(0)
    picks = np.r_[on_corridor[y[on_corridor] == "High"], rng.choice(on_corridor, 300, replace=False)]
    allowed = {"weather": set(predictor.form_options["weather"]),
               "collision": {o["value"] for o in predictor.form_options["collision_types"]},
               "factor": {o["value"] for o in predictor.form_options["accident_factors"]}}
    mismatches = skipped = 0
    for i in picks:
        r = d.iloc[i]
        try:
            month = MONTHS.index(str(r["Month"]).strip().lower()) + 1
            when = datetime(int(r["Year"]), month, int(r["Day"]), int(r["Hour"]), int(r["Minute"]))
        except ValueError:
            skipped += 1  # impossible dates in the source data (e.g. Feb 30) can't be typed into the form
            continue
        if (str(r["Weather"]) not in allowed["weather"] or str(r["Collision Type"]) not in allowed["collision"]
                or str(r["Accident Factor"]) not in allowed["factor"]):
            skipped += 1  # rare spellings the form doesn't offer
            continue
        corridor = re.sub(r"\s*\((NB|SB|EB|WB)\)$", "", re.sub(r"\s+", " ", str(r["Street"]).strip()))
        vehicles = {f: int(pd.to_numeric(r[f], errors="coerce") or 0) for f in tm.VEHICLE_FIELDS}
        out = admin_client.post("/api/predict-incident", json={
            "incident_datetime": when.isoformat(), "weather": str(r["Weather"]),
            "collision_type": str(r["Collision Type"]), "accident_factor": str(r["Accident Factor"]),
            "vehicles": vehicles, "corridor": corridor}).json()["predictions"]
        for key, model in predictor.models.items():
            mismatches += out[key]["label"] != decide(model_scores(model, X.values[i:i + 1]), predictor.cutoffs[key])[0]
    check(mismatches == 0 and len(picks) - skipped > 300,
          f"API matches the training pipeline on {len(picks) - skipped} corridor crashes from 2025 ({mismatches} mismatches)")
