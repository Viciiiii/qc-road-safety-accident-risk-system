from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .ml.predictor import VEHICLE_FIELDS

Priority = Literal["High", "Medium", "Low"]
Outcome = Literal["Fatal", "Non Fatal Injury", "Damage to Property"]


# ---------- Corridor ranking (GET /api/risk-areas) ----------

class CorridorRankOut(BaseModel):
    corridor: str
    rank: int
    risk_level: Priority
    severity_score: int          # last 12 months: 1 x damage + 3 x injury + 10 x fatal
    crashes: int                 # last 12 months
    damage: int
    injury: int
    fatal: int
    confirmed_incidents: int     # of those crashes, how many came from staff-logged, admin-confirmed incidents
    total_incidents: int         # all of 2022-2025, for context
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class RankingOut(BaseModel):
    window_start: str            # first month counted, YYYY-MM-DD
    data_through: str            # last month counted, YYYY-MM-DD
    weights: Dict[str, int]
    high_slots: int
    medium_slots: int
    confirmed_after_window: int  # confirmed incidents dated after data_through - not counted yet
    corridors: List[CorridorRankOut]


# ---------- Incidents ----------

def _check_vehicles(v: Dict[str, int]) -> Dict[str, int]:
    for name, count in v.items():
        if name not in VEHICLE_FIELDS:
            raise ValueError(f"Unknown vehicle type: {name}")
        if not 0 <= count <= 50:
            raise ValueError(f"{name} count must be between 0 and 50")
    return v


class IncidentCreate(BaseModel):
    corridor: str
    incident_datetime: datetime
    weather: str
    collision_type: str
    accident_factor: str
    vehicles: Dict[str, int] = Field(default_factory=dict)
    priority: Priority                                  # the triage estimate shown when it was logged
    logged_by_name: str = Field(min_length=1, max_length=100)

    @field_validator("vehicles")
    @classmethod
    def check_vehicles(cls, v):
        return _check_vehicles(v)


class IncidentConfirm(BaseModel):
    outcome: Outcome


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    corridor: str
    incident_datetime: datetime
    weather: Optional[str] = None
    collision_type: Optional[str] = None
    accident_factor: Optional[str] = None
    vehicle_counts: Dict[str, int] = Field(default_factory=dict)
    priority: Priority
    logged_by_name: Optional[str] = None
    status: str
    confirmed_outcome: Optional[Outcome] = None
    created_at: Optional[datetime] = None
