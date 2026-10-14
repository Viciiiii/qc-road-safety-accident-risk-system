from sqlalchemy import (
    Column, Integer, String, Boolean, Date, DateTime, Numeric, ForeignKey, JSON, func
)
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(10), nullable=False)  # 'admin' | 'staff'
    disabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())
    # Added by db/05_auth.sql
    must_change_password = Column(Boolean, nullable=False, default=False)  # still on an admin-issued temporary password
    last_login_at = Column(DateTime)

    incidents = relationship("Incident", back_populates="logged_by")


class UserSession(Base):
    """One signed-in browser. Only a hash of the cookie's token is stored (db/05_auth.sql)."""
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)  # UTC
    created_at = Column(DateTime, server_default=func.now())


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True)
    corridor = Column(String(150), nullable=False)
    incident_datetime = Column(DateTime, nullable=False)
    weather = Column(String(50))
    collision_type = Column(String(100))
    accident_factor = Column(String(100))
    vehicle_counts = Column(JSON, nullable=False, default=dict)
    priority = Column(String(10), nullable=False)  # Random Forest estimate: 'High' | 'Medium' | 'Low'
    # The other two models' estimates (db/04_model_estimates.sql). Empty for incidents
    # logged before that script was added.
    svm_priority = Column(String(10))
    nb_priority = Column(String(10))
    logged_by_user_id = Column(Integer, ForeignKey("users.id"))
    # Display name of whoever logged it, kept as text so it survives later name changes
    # (added by db/03_corridor_monthly.sql). logged_by_user_id links to the account.
    logged_by_name = Column(String(100))
    status = Column(String(30), nullable=False, default="Pending review")
    confirmed_outcome = Column(String(30))  # Fatal | Non Fatal Injury | Damage to Property
    created_at = Column(DateTime, server_default=func.now())

    logged_by = relationship("User", back_populates="incidents")


class RiskArea(Base):
    __tablename__ = "risk_areas"

    id = Column(Integer, primary_key=True)
    corridor = Column(String(150), unique=True, nullable=False)
    total_incidents = Column(Integer, nullable=False)
    high_priority_rate = Column(Numeric(5, 2), nullable=False)
    risk_level = Column(String(10), nullable=False)  # 'High' | 'Medium' | 'Low'
    latitude = Column(Numeric(9, 6))
    longitude = Column(Numeric(9, 6))


class CorridorMonthly(Base):
    """Crashes per corridor per month, from the MMDA data (db/03_corridor_monthly.sql)."""
    __tablename__ = "corridor_monthly"

    corridor = Column(String(150), ForeignKey("risk_areas.corridor"), primary_key=True)
    month = Column(Date, primary_key=True)  # first day of the month
    damage = Column(Integer, nullable=False, default=0)
    injury = Column(Integer, nullable=False, default=0)
    fatal = Column(Integer, nullable=False, default=0)
