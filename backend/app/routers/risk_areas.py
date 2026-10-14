from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..ranking import NoMonthlyData, compute_ranking

router = APIRouter(prefix="/api/risk-areas", tags=["risk-areas"])


@router.get("", response_model=schemas.RankingOut)
def corridor_ranking(db: Session = Depends(get_db)):
    """Corridors ranked by 12-month severity score (see app/ranking.py)."""
    try:
        return compute_ranking(db)
    except NoMonthlyData as exc:
        raise HTTPException(503, str(exc))
