"""
Loads the trained models once and turns a raw incident into predictions.

Mirrors the preprocessing in the training notebook (CSRP2.ipynb, predict_all_models):
categorical columns go through the saved LabelEncoders; numeric columns pass through as-is.
All three models were trained on the same 21 features, with no scaler, so one input row
serves Random Forest, SVM, and Naive Bayes alike.
"""
import json
import pickle
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd

MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"

MODEL_FILES = {
    "random_forest": "priority_random_forest.pkl",
    "svm": "priority_svm.pkl",
    "naive_bayes": "priority_naive_bayes.pkl",
}

# Exact column order the models were trained on (priority_metadata.yaml -> feature_columns).
FEATURE_COLUMNS = [
    "District (City)", "Hour", "Minute", "Day", "Month", "Weather",
    "Collision Type", "Accident Factor",
    "Bike", "E-Bike", "E-Trike", "E-Scooter", "Motorcycle", "Tricycle",
    "Car", "PUJ", "Fx / Taxi", "Bus", "Van", "Truck", "Train",
]

VEHICLE_FIELDS = [
    "Bike", "E-Bike", "E-Trike", "E-Scooter", "Motorcycle", "Tricycle",
    "Car", "PUJ", "Fx / Taxi", "Bus", "Van", "Truck", "Train",
]

# In the training data these two count columns were stored as text ('1', '1.0', ' '),
# so they were label-encoded like categories. Every other vehicle column is a plain number.
ENCODED_COUNT_COLUMNS = ("Motorcycle", "Fx / Taxi")

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

DISTRICT = "Central (Quezon)"  # constant in the source data


class InvalidInput(ValueError):
    """The request contained a value the models can't accept."""


class Predictor:
    def __init__(self):
        self.models = {key: joblib.load(MODELS_DIR / fn) for key, fn in MODEL_FILES.items()}
        with open(MODELS_DIR / "priority_encoders.pkl", "rb") as f:
            encoders = pickle.load(f)
        # class string -> integer code, per encoded column
        self._codes = {
            col: {cls: i for i, cls in enumerate(le.classes_)} for col, le in encoders.items()
        }
        # for the two count columns: class string -> the number it represents
        self._count_values = {}
        for col in ENCODED_COUNT_COLUMNS:
            parsed = {}
            for cls in self._codes[col]:
                try:
                    parsed[cls] = float(cls.strip())
                except ValueError:
                    pass  # blank / whitespace-only classes carry no number
            self._count_values[col] = parsed
        with open(MODELS_DIR / "form_options.json", encoding="utf-8") as f:
            self.form_options = json.load(f)

        # Fail loudly at startup if the models and our column list ever drift apart.
        for key, model in self.models.items():
            names = getattr(model, "feature_names_in_", None)
            if names is not None and list(names) != FEATURE_COLUMNS:
                raise RuntimeError(f"{key} was trained on different columns than FEATURE_COLUMNS")

    def _encode_text(self, column, value):
        code = self._codes[column].get(value)
        if code is None:
            raise InvalidInput(f"'{value}' is not a recognised {column} value.")
        return code

    def _encode_count(self, column, n, fallbacks):
        codes = self._codes[column]
        for candidate in (str(n), f"{n}.0"):  # '2' and '2.0' both exist as separate classes
            if candidate in codes:
                return codes[candidate]
        # A count never seen in training (e.g. 9 motorcycles): use the nearest one that was.
        values = self._count_values[column]
        nearest = min(values, key=lambda cls: abs(values[cls] - n))
        fallbacks.append(
            f"{column}: {n} was never seen in training data; used nearest known value {values[nearest]:g}."
        )
        return codes[nearest]

    def predict(self, *, when, weather, collision_type, accident_factor, vehicles):
        fallbacks = []
        row = {
            "District (City)": self._encode_text("District (City)", DISTRICT),
            "Hour": when.hour,
            "Minute": when.minute,
            "Day": when.day,
            "Month": self._encode_text("Month", MONTHS[when.month - 1]),
            "Weather": self._encode_text("Weather", weather),
            "Collision Type": self._encode_text("Collision Type", collision_type),
            "Accident Factor": self._encode_text("Accident Factor", accident_factor),
        }
        for field in VEHICLE_FIELDS:
            n = int(vehicles.get(field, 0))
            row[field] = (
                self._encode_count(field, n, fallbacks) if field in ENCODED_COUNT_COLUMNS else n
            )
        X = pd.DataFrame([row])[FEATURE_COLUMNS].astype(float)

        results = {}
        for key, model in self.models.items():
            label = str(model.predict(X)[0])
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(X)[0]
                probabilities = {str(c): round(float(p) * 100, 1) for c, p in zip(model.classes_, proba)}
                confidence = probabilities[label]
            else:  # LinearSVC only gives a label, not probabilities
                probabilities, confidence = None, None
            results[key] = {"label": label, "confidence": confidence, "probabilities": probabilities}
        return {"predictions": results, "adjustments": fallbacks}


@lru_cache(maxsize=1)
def get_predictor() -> Predictor:
    return Predictor()
