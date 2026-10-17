"""
Loads the trained models once and turns a raw incident into predictions.

Inputs are built by app/ml/features.py - the same code scripts/train_models.py uses - with the
category values and street-history tables saved at training time, so the API sees exactly what
the models were trained on. The corridor chosen in the form is looked up in the street history.

Each model flags High when its High score reaches that model's cutoff
(models/priority_model_config.json, chosen on the 2024 data in train_models.py);
otherwise the larger of Medium and Low wins.
"""
import json
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd

from .features import (
    CLASSES, VEHICLE_FIELDS, build_features, decide, feature_columns, history_features, model_scores, street_key,
)

MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"

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
        self.categories = config["categories"]
        self.columns = feature_columns(self.categories)
        if config["feature_columns"] != self.columns:
            raise RuntimeError("priority_model_config.json lists different inputs than app/ml/features.py builds")
        with open(MODELS_DIR / config["history_file"], encoding="utf-8") as f:
            self.history = json.load(f)
        self.models = {key: joblib.load(MODELS_DIR / m["file"]) for key, m in config["models"].items()}
        self.cutoffs = {key: float(m["high_cutoff"]) for key, m in config["models"].items()}
        self.score_kind = {key: m["score"] for key, m in config["models"].items()}
        with open(MODELS_DIR / "form_options.json", encoding="utf-8") as f:
            self.form_options = json.load(f)
        values = lambda items: {i["value"] if isinstance(i, dict) else i for i in items}
        self._allowed = {"Weather": values(self.form_options["weather"]),
                         "Collision Type": values(self.form_options["collision_types"]),
                         "Accident Factor": values(self.form_options["accident_factors"])}

        # Fail loudly at startup if the models and the input list ever drift apart.
        for key, model in self.models.items():
            n = getattr(model, "n_features_in_", None)
            if n is not None and n != len(self.columns):
                raise RuntimeError(f"{key} expects {n} inputs, features.py builds {len(self.columns)}")

    def predict(self, *, when, weather, collision_type, accident_factor, vehicles, corridor):
        for column, value in (("Weather", weather), ("Collision Type", collision_type),
                              ("Accident Factor", accident_factor)):
            if value not in self._allowed[column]:
                raise InvalidInput(f"'{value}' is not a recognised {column} value.")
        if not str(corridor or "").strip():
            raise InvalidInput("A corridor is required: its crash history is one of the model inputs.")
        counts = {field: int(vehicles.get(field, 0)) for field in VEHICLE_FIELDS}
        raw = pd.DataFrame([{
            "Year": when.year, "Month": MONTHS[when.month - 1], "Day": when.day,
            "Hour": when.hour, "Minute": when.minute, "Weather": weather,
            "Collision Type": collision_type, "Accident Factor": accident_factor, "Street": corridor, **counts,
        }])
        history = history_features(street_key(raw["Street"]), raw["Hour"], self.history)
        X = build_features(raw, self.categories, history).values

        results = {}
        for key, model in self.models.items():
            scores = model_scores(model, X)
            label = str(decide(scores, self.cutoffs[key])[0])
            if self.score_kind[key] == "probability":
                probabilities = {c: round(float(scores[0][i]) * 100, 1) for i, c in enumerate(CLASSES)}
                confidence = probabilities[label]
                cutoff = round(self.cutoffs[key] * 100, 1)
            else:  # SVM decision scores and Naive Bayes log-odds aren't probabilities
                probabilities, confidence, cutoff = None, None, None
            results[key] = {"label": label, "confidence": confidence, "probabilities": probabilities,
                            "high_cutoff": cutoff}
        street = street_key(raw["Street"]).iloc[0]
        return {"predictions": results, "adjustments": [],
                "street_history": {"crashes": self.history["street"].get(street, [None, 0])[1]}}


@lru_cache(maxsize=1)
def get_predictor() -> Predictor:
    return Predictor()
