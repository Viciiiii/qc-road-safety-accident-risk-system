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
    confirmed_since_data: int  # counted confirmed incidents dated after data_through (newer than the MMDA data)
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
    priority: Priority                                  # Random Forest's estimate (the one shown as "Estimated Priority")
    svm_priority: Optional[Priority] = None             # SVM's estimate
    nb_priority: Optional[Priority] = None              # Naive Bayes's estimate
    # Ignored: the server records the signed-in account. Kept optional so older clients still work.
    logged_by_name: Optional[str] = None

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
    svm_priority: Optional[Priority] = None
    nb_priority: Optional[Priority] = None
    logged_by_name: Optional[str] = None
    status: str
    confirmed_outcome: Optional[Outcome] = None
    created_at: Optional[datetime] = None


# ---------- accounts ----------

class LoginIn(BaseModel):
    email: str = Field(max_length=150)
    password: str = Field(max_length=200)
    remember: bool = False


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    disabled: bool
    must_change_password: bool
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=150)


class UserUpdate(BaseModel):
    disabled: bool


class TempPasswordOut(BaseModel):
    user: UserOut
    temporary_password: str   # shown to the admin once; only its hash is stored
