"""
Feature engineering shared by training (scripts/train_models.py) and the live API
(app/ml/predictor.py). Both call build_features(), so a crash is turned into model
inputs exactly the same way in the notebook-replacement script and in the app.

Every feature here is known when the crash is reported (time, weather, collision type,
accident factor, vehicles involved). Nothing that is only known afterwards (deaths,
injuries) is used.
"""
import numpy as np
import pandas as pd

VEHICLE_FIELDS = [
    "Bike", "E-Bike", "E-Trike", "E-Scooter", "Motorcycle", "Tricycle",
    "Car", "PUJ", "Fx / Taxi", "Bus", "Van", "Truck", "Train",
]

# Columns that go through the saved LabelEncoders (priority_encoders.pkl).
# All 13 vehicle columns are used as plain numbers. (The original notebook label-encoded
# Motorcycle and Fx / Taxi as text, which gave "1" and "1.0" different codes - and "1"
# only ever appears in the 2023 file, so the code quietly leaked the year.)
ENCODED_COLUMNS = ["Month", "Weather", "Collision Type", "Accident Factor"]

BASE_COLUMNS = ["Hour", "Minute", "Day", "Month", "Weather", "Collision Type", "Accident Factor"] + VEHICLE_FIELDS

COLLISION_FLAGS = {
    "ct_pedestrian": "pedestrian", "ct_head_on": "head on", "ct_self": "self accident",
    "ct_hit_run": "hit and run", "ct_object": "hit object", "ct_multiple": "multiple",
    "ct_angle": "angle", "ct_rear": "rear end", "ct_side": "side swipe",
    "ct_parked": "parked", "ct_unknown": "no collision stated",
}
FACTOR_FLAGS = {
    "af_human": "human error", "af_liquor": "liquor", "af_lost_control": "lost control",
    "af_defect": "defect", "af_road": "road condition", "af_none": "no accident factor",
}
ENGINEERED_COLUMNS = (
    ["night", "late_night", "rush_hour", "weekday", "weekend",
     "total_vehicles", "two_wheelers", "motorcycle_involved", "heavy_involved",
     "single_vehicle", "moto_vs_heavy"]
    + list(COLLISION_FLAGS) + list(FACTOR_FLAGS)
)

# Exact column order the models are trained on.
FEATURE_COLUMNS = BASE_COLUMNS + ENGINEERED_COLUMNS

MONTH_NUMBER = {m: i + 1 for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june",
     "july", "august", "september", "october", "november", "december"])}


def build_features(raw: pd.DataFrame, encoded: pd.DataFrame) -> pd.DataFrame:
    """
    raw:     one row per crash with Year, Month (name), Day, Hour, Minute,
             Collision Type, Accident Factor (text) and the 13 vehicle counts as numbers.
    encoded: the ENCODED_COLUMNS already converted to LabelEncoder codes.
    Returns a float DataFrame with FEATURE_COLUMNS, in that order.
    """
    X = pd.DataFrame(index=raw.index)
    for c in ("Hour", "Minute", "Day"):
        X[c] = raw[c].astype(float)
    for c in ("Month", "Weather", "Collision Type", "Accident Factor"):
        X[c] = encoded[c]
    counts = pd.DataFrame({c: pd.to_numeric(raw[c], errors="coerce").fillna(0) for c in VEHICLE_FIELDS})
    for c in VEHICLE_FIELDS:
        X[c] = counts[c]

    h = raw["Hour"].astype(float)
    X["night"] = ((h >= 18) | (h < 6)).astype(int)
    X["late_night"] = ((h >= 22) | (h < 5)).astype(int)
    X["rush_hour"] = h.isin([7, 8, 9, 17, 18, 19]).astype(int)

    month = raw["Month"].astype(str).str.strip().str.lower().map(MONTH_NUMBER).fillna(1).astype(int)
    day = raw["Day"].astype(int)
    exact = pd.to_datetime(raw["Year"].astype(int).astype(str) + "-" + month.astype(str) + "-" + day.astype(str),
                           errors="coerce")
    safe = pd.to_datetime(dict(year=raw["Year"].astype(int), month=month, day=day.clip(1, 28)), errors="coerce")
    dow = exact.dt.dayofweek.fillna(safe.dt.dayofweek)   # invalid dates (e.g. Feb 30) fall back to day 28
    X["weekday"] = dow
    X["weekend"] = (dow >= 5).astype(int)

    X["total_vehicles"] = counts.sum(axis=1)
    X["two_wheelers"] = counts[["Bike", "E-Bike", "E-Scooter", "Motorcycle"]].sum(axis=1)
    X["motorcycle_involved"] = (counts["Motorcycle"] > 0).astype(int)
    X["heavy_involved"] = ((counts["Bus"] + counts["Truck"]) > 0).astype(int)
    X["single_vehicle"] = (counts.sum(axis=1) <= 1).astype(int)
    X["moto_vs_heavy"] = X["motorcycle_involved"] * X["heavy_involved"]

    ct = raw["Collision Type"].astype(str).str.lower()
    for name, text in COLLISION_FLAGS.items():
        X[name] = ct.str.contains(text, regex=False).astype(int)
    af = raw["Accident Factor"].astype(str).str.lower()
    for name, text in FACTOR_FLAGS.items():
        X[name] = af.str.contains(text, regex=False).astype(int)

    return X[FEATURE_COLUMNS].astype(float)


def decide(scores: np.ndarray, cutoff: float) -> np.ndarray:
    """
    scores: n x 3 array in the order High, Medium, Low (probabilities, or SVM decision scores).
    High when its score reaches the model's cutoff; otherwise the larger of Medium and Low.
    """
    other = np.where(scores[:, 1] >= scores[:, 2], "Medium", "Low")
    return np.where(scores[:, 0] >= cutoff, "High", other)
