from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/risk-areas", tags=["risk-areas"])


@router.get("", response_model=List[schemas.RiskAreaOut])
def list_risk_areas(db: Session = Depends(get_db)):
    return (
        db.query(models.RiskArea)
        .order_by(desc(models.RiskArea.total_incidents))
        .all()
    )
