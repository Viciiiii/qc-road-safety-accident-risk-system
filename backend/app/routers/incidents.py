"""
Staff-logged incidents, stored in PostgreSQL so every computer sees the same Records.

Flow: Pending review -> Confirmed (admin records the real outcome) -> Included in training
(exported for retraining). Confirmed incidents also count toward the corridor ranking.

Anyone signed in can list and log incidents; only an admin can confirm outcomes or export.
"""
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import current_user, require_admin
from ..database import get_db

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def _get(db: Session, incident_id: int) -> models.Incident:
    inc = db.get(models.Incident, incident_id)
    if inc is None:
        raise HTTPException(404, "Incident not found.")
    return inc


@router.get("", response_model=List[schemas.IncidentOut])
def list_incidents(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return (db.query(models.Incident)
            .order_by(models.Incident.incident_datetime.desc(), models.Incident.id.desc())
            .all())


@router.post("", response_model=schemas.IncidentOut, status_code=201)
def create_incident(body: schemas.IncidentCreate, user: models.User = Depends(current_user),
                    db: Session = Depends(get_db)):
    if db.query(models.RiskArea).filter_by(corridor=body.corridor).first() is None:
        raise HTTPException(422, f"'{body.corridor}' is not a monitored corridor.")
    when = body.incident_datetime.replace(tzinfo=None)
    if when > datetime.now() + timedelta(days=1):
        raise HTTPException(422, "The incident date can't be in the future.")
    inc = models.Incident(
        corridor=body.corridor,
        incident_datetime=when,
        weather=body.weather,
        collision_type=body.collision_type,
        accident_factor=body.accident_factor,
        vehicle_counts=body.vehicles,
        priority=body.priority,
        svm_priority=body.svm_priority,
        nb_priority=body.nb_priority,
        logged_by_user_id=user.id,
        logged_by_name=user.name,          # from the signed-in account, not from the request
        status="Pending review",
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return inc


@router.post("/{incident_id}/confirm", response_model=schemas.IncidentOut)
def confirm_incident(incident_id: int, body: schemas.IncidentConfirm,
                     admin: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    inc = _get(db, incident_id)
    if inc.status == "Included in training":
        raise HTTPException(409, "This incident was already exported for retraining and can't be changed.")
    inc.confirmed_outcome = body.outcome   # re-confirming a Confirmed incident corrects a mistake
    inc.status = "Confirmed"
    db.commit()
    db.refresh(inc)
    return inc


@router.post("/export", response_model=List[schemas.IncidentOut])
def export_confirmed(admin: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    """Returns every Confirmed incident and marks them Included in training (the frontend builds the CSV)."""
    ready = (db.query(models.Incident)
             .filter(models.Incident.status == "Confirmed")
             .order_by(models.Incident.incident_datetime)
             .with_for_update()
             .all())
    out = [schemas.IncidentOut.model_validate(i) for i in ready]
    for inc in ready:
        inc.status = "Included in training"
    db.commit()
    return out
