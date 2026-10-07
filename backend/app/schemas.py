from pydantic import BaseModel, ConfigDict
from typing import Optional


class RiskAreaOut(BaseModel):
    # Lets Pydantic read values straight off the SQLAlchemy model's attributes,
    # instead of needing a dict - required for any response built from an ORM object.
    model_config = ConfigDict(from_attributes=True)

    id: int
    corridor: str
    total_incidents: int
    high_priority_rate: float
    risk_level: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
