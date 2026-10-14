"""
Loads the trained models once and turns a raw incident into predictions.

Features are built by app/ml/features.py - the same code scripts/train_models.py uses -
so the API sees exactly what the models were trained on. Categorical columns go through
the saved LabelEncoders first.

Each model flags High when its High score reaches that model's cutoff
(models/priority_model_config.json, chosen by cross-validation in train_models.py);
otherwise the larger of Medium and Low wins.
"""
import json
import pickle
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from .features import ENCODED_COLUMNS, FEATURE_COLUMNS, VEHICLE_FIELDS, build_features, decide

MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"
CLASSES = ["High", "Medium", "Low"]

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


class InvalidInput(ValueError):
    """The request contained a value the models can't accept."""


class Predictor:
    def __init__(self):
        with open(MODELS_DIR / "priority_model_config.json", encoding="utf-8") as f:
            config = json.load(f)
        if config["feature_columns"] != FEATURE_COLUMNS:
            raise RuntimeError("priority_model_config.json lists different features than app/ml/features.py")
        self.models = {key: joblib.load(MODELS_DIR / m["file"]) for key, m in config["models"].items()}
        self.cutoffs = {key: float(m["high_cutoff"]) for key, m in config["models"].items()}
        with open(MODELS_DIR / "priority_encoders.pkl", "rb") as f:
            encoders = pickle.load(f)
        # class string -> integer code, per encoded column
        self._codes = {
            col: {cls: i for i, cls in enumerate(le.classes_)} for col, le in encoders.items()
        }
        with open(MODELS_DIR / "form_options.json", encoding="utf-8") as f:
            self.form_options = json.load(f)

        # Fail loudly at startup if the models and the feature list ever drift apart.
        for key, model in self.models.items():
            n = getattr(model, "n_features_in_", None)
            if n is not None and n != len(FEATURE_COLUMNS):
                raise RuntimeError(f"{key} expects {n} features, features.py builds {len(FEATURE_COLUMNS)}")

    def _encode_text(self, column, value):
        code = self._codes[column].get(value)
        if code is None:
            raise InvalidInput(f"'{value}' is not a recognised {column} value.")
        return code

    def predict(self, *, when, weather, collision_type, accident_factor, vehicles):
        for column, value in (("Weather", weather), ("Collision Type", collision_type),
                              ("Accident Factor", accident_factor)):
            self._encode_text(column, value)  # rejects unknown values with a clear message
        counts = {field: int(vehicles.get(field, 0)) for field in VEHICLE_FIELDS}
        raw = pd.DataFrame([{
            "Year": when.year, "Month": MONTHS[when.month - 1], "Day": when.day,
            "Hour": when.hour, "Minute": when.minute, "Weather": weather,
            "Collision Type": collision_type, "Accident Factor": accident_factor, **counts,
        }])
        encoded = pd.DataFrame([{col: self._encode_text(col, raw.at[0, col]) for col in ENCODED_COLUMNS}])
        X = build_features(raw, encoded).values

        results = {}
        for key, model in self.models.items():
            if hasattr(model, "predict_proba"):
                raw_scores = model.predict_proba(X)[0]
            else:  # LinearSVC gives decision scores, not probabilities
                raw_scores = model.decision_function(X)[0]
            by_class = dict(zip((str(c) for c in model.classes_), raw_scores))
            ordered = np.array([[by_class[c] for c in CLASSES]])
            label = str(decide(ordered, self.cutoffs[key])[0])
            if hasattr(model, "predict_proba"):
                probabilities = {c: round(float(by_class[c]) * 100, 1) for c in CLASSES}
                confidence = probabilities[label]
                cutoff = round(self.cutoffs[key] * 100, 1)
            else:
                probabilities, confidence, cutoff = None, None, None
            results[key] = {"label": label, "confidence": confidence, "probabilities": probabilities,
                            "high_cutoff": cutoff}
        return {"predictions": results, "adjustments": []}


@lru_cache(maxsize=1)
def get_predictor() -> Predictor:
    return Predictor()
