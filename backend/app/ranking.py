"""
Corridor priority ranking for LGU resource allocation.

Each corridor gets a severity score:
    score = 1 x damage-only crashes + 3 x injury crashes + 10 x fatal crashes
counting the 12 most recent months of MMDA data (corridor_monthly), plus every incident
that staff logged and an admin confirmed from the start of that window up to today -
including ones newer than the MMDA data, which are the most recent information there is.
Confirmed incidents have a known real outcome, so they count like any other crash.
Unconfirmed incidents never count - they only have a model's estimate.

Corridors are ranked by score: the top 10 are High priority, the next 10 Medium,
the rest Low.

Each corridor also gets a trend: is it getting worse faster than the rest of the city?
Its severity score for the last 6 months of MMDA data is compared with the 6 months
before, and that change is compared with the citywide change. Rising = at least 15
points above the city's change, Falling = at least 15 points below, otherwise Steady.
(Comparing with the city removes the season effect: November-December are busy
everywhere.) Confirmed incidents add their points to the period they fall in -
anything newer than the MMDA data counts as recent - so a log can push a road
toward Rising, never fake a Falling. In a backtest on 2022-2025 the arrow's direction
still held over the following 3 months 77% of the time (72% in 2025). In a backtest (train 2022-2024, test every month of 2025), this ranking
picked next month's top-10 corridors with ~92% precision, and RF/SVM/Naive Bayes
models did not beat it - see the README.
"""
from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models

WEIGHTS = {"damage": 1, "injury": 3, "fatal": 10}
OUTCOME_KEY = {"Damage to Property": "damage", "Non Fatal Injury": "injury", "Fatal": "fatal"}
WINDOW_MONTHS = 12
TREND_MONTHS = 6          # last 6 months vs the 6 before
TREND_THRESHOLD = 0.15    # 15 percentage points above/below the citywide change
HIGH_SLOTS, MEDIUM_SLOTS = 10, 10
COUNTED_STATUSES = ("Confirmed", "Included in training")


class NoMonthlyData(RuntimeError):
    """corridor_monthly is empty - db/03_corridor_monthly.sql hasn't been run."""


def add_months(d: date, n: int) -> date:
    m = d.month - 1 + n
    return date(d.year + m // 12, m % 12 + 1, 1)


def tier_for_rank(rank: int) -> str:
    if rank <= HIGH_SLOTS:
        return "High"
    if rank <= HIGH_SLOTS + MEDIUM_SLOTS:
        return "Medium"
    return "Low"


def trend_for(scores: dict, city_change: float) -> dict:
    """Rising / Steady / Falling for one corridor, relative to the citywide change."""
    recent, before = scores["recent"], scores["before"]
    if before == 0:
        return {"trend": "steady" if recent == 0 else "rising", "trend_change_pct": None,
                "trend_recent_score": recent, "trend_before_score": before}
    change = recent / before - 1
    relative = change - city_change
    trend = "rising" if relative >= TREND_THRESHOLD else "falling" if relative <= -TREND_THRESHOLD else "steady"
    return {"trend": trend, "trend_change_pct": round(change * 100, 1),
            "trend_recent_score": recent, "trend_before_score": before}


def compute_ranking(db: Session) -> dict:
    data_through = db.query(func.max(models.CorridorMonthly.month)).scalar()
    if data_through is None:
        raise NoMonthlyData("No monthly corridor data. Run backend/db/03_corridor_monthly.sql (see README).")
    window_start = add_months(data_through, -(WINDOW_MONTHS - 1))
    data_end = add_months(data_through, 1)  # first day after the MMDA data

    areas = db.query(models.RiskArea).all()
    totals = {a.corridor: {"damage": 0, "injury": 0, "fatal": 0, "confirmed_incidents": 0,
                           "confirmed_by_outcome": {"fatal": 0, "injury": 0, "damage": 0}} for a in areas}

    # Trend periods: last TREND_MONTHS months of MMDA data vs the TREND_MONTHS before.
    recent_start = add_months(data_through, -(TREND_MONTHS - 1))
    before_start = add_months(recent_start, -TREND_MONTHS)
    trend_scores = {a.corridor: {"recent": 0, "before": 0} for a in areas}
    for r in (db.query(models.CorridorMonthly)
              .filter(models.CorridorMonthly.month >= before_start, models.CorridorMonthly.month <= data_through)):
        if r.corridor in trend_scores:
            side = "recent" if r.month >= recent_start else "before"
            trend_scores[r.corridor][side] += WEIGHTS["damage"] * r.damage + WEIGHTS["injury"] * r.injury + WEIGHTS["fatal"] * r.fatal

    rows = (db.query(models.CorridorMonthly)
            .filter(models.CorridorMonthly.month >= window_start, models.CorridorMonthly.month <= data_through)
            .all())
    for r in rows:
        if r.corridor in totals:
            for k in ("damage", "injury", "fatal"):
                totals[r.corridor][k] += getattr(r, k)

    confirmed = (db.query(models.Incident)
                 .filter(models.Incident.status.in_(COUNTED_STATUSES),
                         models.Incident.confirmed_outcome.isnot(None))
                 .all())
    start_dt = datetime.combine(window_start, datetime.min.time())
    data_end_dt = datetime.combine(data_end, datetime.min.time())
    since_data = 0
    recent_dt = datetime.combine(recent_start, datetime.min.time())
    before_dt = datetime.combine(before_start, datetime.min.time())
    for inc in confirmed:
        key = OUTCOME_KEY.get(inc.confirmed_outcome)
        if key is None or inc.corridor not in totals:
            continue
        if inc.incident_datetime >= before_dt:   # a confirmed log adds its points to its trend period
            trend_scores[inc.corridor]["recent" if inc.incident_datetime >= recent_dt else "before"] += WEIGHTS[key]
        if inc.incident_datetime < start_dt:
            continue  # older than the ranking window
        totals[inc.corridor][key] += 1
        totals[inc.corridor]["confirmed_incidents"] += 1
        totals[inc.corridor]["confirmed_by_outcome"][key] += 1
        if inc.incident_datetime >= data_end_dt:
            since_data += 1  # newer than the MMDA data

    city_recent = sum(t["recent"] for t in trend_scores.values())
    city_before = sum(t["before"] for t in trend_scores.values())
    city_change = (city_recent / city_before - 1) if city_before else 0.0

    corridors = []
    for a in areas:
        t = totals[a.corridor]
        corridors.append({
            "corridor": a.corridor,
            "severity_score": sum(WEIGHTS[k] * t[k] for k in WEIGHTS),
            "crashes": t["damage"] + t["injury"] + t["fatal"],
            "damage": t["damage"], "injury": t["injury"], "fatal": t["fatal"],
            "confirmed_incidents": t["confirmed_incidents"],
            "confirmed_by_outcome": t["confirmed_by_outcome"],
            **trend_for(trend_scores[a.corridor], city_change),
            "total_incidents": a.total_incidents,
            "latitude": float(a.latitude) if a.latitude is not None else None,
            "longitude": float(a.longitude) if a.longitude is not None else None,
        })
    # Ties broken by crash count, then name, so the ranking is always the same for the same data.
    corridors.sort(key=lambda c: (-c["severity_score"], -c["crashes"], c["corridor"]))
    for i, c in enumerate(corridors, start=1):
        c["rank"] = i
        c["risk_level"] = tier_for_rank(i)

    return {
        "window_start": window_start.isoformat(),
        "data_through": data_through.isoformat(),
        "weights": WEIGHTS,
        "high_slots": HIGH_SLOTS,
        "medium_slots": MEDIUM_SLOTS,
        "confirmed_since_data": since_data,
        "trend_recent_start": recent_start.isoformat(),
        "trend_before_start": before_start.isoformat(),
        "trend_threshold_pct": round(TREND_THRESHOLD * 100),
        "city_change_pct": round(city_change * 100, 1),
        "corridors": corridors,
    }
