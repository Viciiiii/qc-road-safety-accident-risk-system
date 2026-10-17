"""
Feature engineering shared by training (scripts/train_models.py) and the live API
(app/ml/predictor.py). Both call the functions below, so a crash is turned into model
inputs exactly the same way when training and when a crash is reported in the app.

Every input is known when the crash is reported: time, weather (day/night), collision type,
accident factor, vehicles involved, and the street's crash history from the training years.
Nothing that is only known afterwards (deaths, injuries) is used.

The inputs (same for all three models):
  * time and vehicle counts, plus engineered flags (night, rush hour, motorcycle + bus/truck, ...)
  * Month, Weather, Collision Type and Accident Factor as one column per value
    (values seen fewer than 20 times in training are grouped as "Other")
  * street history: how often crashes on the street (and on the street at that hour) were fatal
    in the training years, smoothed toward the citywide rate for streets with few crashes
"""
import math
import re

import numpy as np
import pandas as pd
from scipy.special import logsumexp

CLASSES = ["High", "Medium", "Low"]

VEHICLE_FIELDS = [
    "Bike", "E-Bike", "E-Trike", "E-Scooter", "Motorcycle", "Tricycle",
    "Car", "PUJ", "Fx / Taxi", "Bus", "Van", "Truck", "Train",
]

# Text columns turned into one column per value. The values kept are saved with the models
# (priority_model_config.json -> categories) and chosen in train_models.py.
CATEGORY_COLUMNS = ["Month", "Weather", "Collision Type", "Accident Factor"]
OTHER = "Other"

BASE_COLUMNS = ["Hour", "Minute", "Day"] + VEHICLE_FIELDS

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
HISTORY_COLUMNS = ["street_high_rate", "street_n", "street_hour_high_rate", "street_hour_n"]

MONTH_NUMBER = {m: i + 1 for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june",
     "july", "august", "september", "october", "november", "december"])}


# ---------- text clean-up ----------

def category_value(column: str, values: pd.Series) -> pd.Series:
    """The value used for the one-column-per-value inputs."""
    v = values.astype(str).str.strip().str.replace(r"\s+", " ", regex=True)
    if column == "Month":
        v = v.str.title()                                   # "september", "JUne" -> "September", "June"
    elif column == "Collision Type":
        v = v.str.split("(").str[0].str.strip()             # "No Collision Stated (Based on ...)" -> "No Collision Stated"
    return v


def street_key(values: pd.Series) -> pd.Series:
    """Street name used for the history lookup: trimmed, direction tags removed, any letter case.
    "EDSA (NB)", "edsa" and "EDSA" are the same street."""
    v = values.astype(str).str.strip().str.replace(r"\s+", " ", regex=True)
    v = v.str.replace(r"(?i)\s*\((NB|SB|EB|WB)\)", "", regex=True).str.strip()
    return v.str.casefold()


def one_hot_columns(categories: dict) -> list:
    return [f"{col}={v}" for col in CATEGORY_COLUMNS for v in list(categories[col]) + [OTHER]]


def feature_columns(categories: dict) -> list:
    """Exact column order the models are trained on."""
    return BASE_COLUMNS + ENGINEERED_COLUMNS + one_hot_columns(categories) + HISTORY_COLUMNS


# ---------- street history ----------

def make_history(frame: pd.DataFrame, smooth: float = 20) -> dict:
    """Lookup tables from training crashes. frame needs columns street (key), hour (int) and is_high (0/1).
    rate = (fatal + smooth * citywide rate) / (crashes + smooth), so a street with few crashes stays
    close to the citywide rate."""
    prior = float(frame["is_high"].mean())

    def table(keys):
        g = frame.groupby(keys)["is_high"].agg(["sum", "count"])
        rate = (g["sum"] + smooth * prior) / (g["count"] + smooth)
        idx = ["|".join(map(str, k)) if isinstance(k, tuple) else str(k) for k in g.index]
        return {i: [float(r), int(c)] for i, r, c in zip(idx, rate.values, g["count"].values)}

    return {"prior": prior, "smooth": smooth, "street": table("street"), "street_hour": table(["street", "hour"])}


def history_features(streets: pd.Series, hours: pd.Series, history: dict) -> pd.DataFrame:
    """The four history inputs for each crash. A street (or street + hour) not seen in training gets
    the citywide rate and a count of 0."""
    prior, out = history["prior"], {}
    hrs = hours.astype(int).astype(str)
    for name, keys in (("street", streets), ("street_hour", streets + "|" + hrs)):
        found = [history[name].get(k, (prior, 0)) for k in keys]
        out[f"{name}_high_rate"] = [r for r, _ in found]
        out[f"{name}_n"] = [math.log1p(c) for _, c in found]
    return pd.DataFrame(out, index=streets.index)[HISTORY_COLUMNS]


# ---------- the full input table ----------

def build_features(raw: pd.DataFrame, categories: dict, history: pd.DataFrame) -> pd.DataFrame:
    """
    raw:        one row per crash with Year, Month (name), Day, Hour, Minute, Weather, Collision Type,
                Accident Factor (text) and the 13 vehicle counts.
    categories: the values kept per category column (from priority_model_config.json).
    history:    the four HISTORY_COLUMNS for the same rows (history_features(), or out-of-fold values
                when training).
    Returns a float DataFrame with feature_columns(categories), in that order.
    """
    X = pd.DataFrame(index=raw.index)
    for c in ("Hour", "Minute", "Day"):
        X[c] = raw[c].astype(float)
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

    for col in CATEGORY_COLUMNS:
        kept = list(categories[col])
        v = category_value(col, raw[col])
        v = v.where(v.isin(kept), OTHER)
        for value in kept + [OTHER]:
            X[f"{col}={value}"] = (v == value).astype(int)

    for c in HISTORY_COLUMNS:
        X[c] = history[c].values

    return X[feature_columns(categories)].astype(float)


# ---------- model scores and the High rule ----------

def model_scores(model, X) -> np.ndarray:
    """n x 3 scores in the order High, Medium, Low.
    Random Forest: probabilities. Linear SVM: decision scores.
    Naive Bayes: log-likelihoods. Its probabilities round to exactly 0% or 100% for many crashes, which
    ties them and makes a cutoff meaningless, so the High column is the log-odds of High instead
    (same ordering as the probability, without the rounding)."""
    from sklearn.naive_bayes import GaussianNB
    last = model[-1] if hasattr(model, "steps") else model
    if isinstance(last, GaussianNB):
        Xt = model[:-1].transform(X) if hasattr(model, "steps") else X
        j = pd.DataFrame(last.predict_joint_log_proba(Xt), columns=[str(c) for c in last.classes_])[CLASSES].values
        out = j.copy()
        out[:, 0] = j[:, 0] - logsumexp(j[:, 1:], axis=1)
        return out
    s = model.predict_proba(X) if hasattr(model, "predict_proba") else model.decision_function(X)
    return pd.DataFrame(s, columns=[str(c) for c in model.classes_])[CLASSES].values


def decide(scores: np.ndarray, cutoff: float) -> np.ndarray:
    """
    scores: n x 3 array in the order High, Medium, Low (see model_scores).
    High when its score reaches the model's cutoff; otherwise the larger of Medium and Low.
    """
    other = np.where(scores[:, 1] >= scores[:, 2], "Medium", "Low")
    return np.where(scores[:, 0] >= cutoff, "High", other)
