from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..ml.predictor import VEHICLE_FIELDS, InvalidInput, get_predictor

router = APIRouter(prefix="/api", tags=["predictions"])


class PredictRequest(BaseModel):
    incident_datetime: datetime
    weather: str
    collision_type: str
    accident_factor: str
    vehicles: Dict[str, int] = Field(default_factory=dict)
    # Accepted so the frontend can send the whole report, but NOT a model input:
    # the trained models don't use location (see priority_metadata.yaml -> feature_columns).
    corridor: Optional[str] = None

    @field_validator("vehicles")
    @classmethod
    def check_vehicles(cls, v):
        for name, count in v.items():
            if name not in VEHICLE_FIELDS:
                raise ValueError(f"Unknown vehicle type: {name}")
            if not 0 <= count <= 50:
                raise ValueError(f"{name} count must be between 0 and 50")
        return v


def _predictor():
    try:
        return get_predictor()
    except Exception as exc:  # missing/incompatible model files
        raise HTTPException(503, f"Prediction models are unavailable: {exc}")


@router.get("/form-options")
def form_options():
    opts = _predictor().form_options
    return {**opts, "vehicle_fields": VEHICLE_FIELDS}


@router.post("/predict-incident")
def predict_incident(body: PredictRequest):
    try:
        return _predictor().predict(
            when=body.incident_datetime,
            weather=body.weather,
            collision_type=body.collision_type,
            accident_factor=body.accident_factor,
            vehicles=body.vehicles,
        )
    except InvalidInput as exc:
        raise HTTPException(422, str(exc))
