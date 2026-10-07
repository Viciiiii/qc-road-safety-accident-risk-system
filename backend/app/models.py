from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey, JSON, func
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

    incidents = relationship("Incident", back_populates="logged_by")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True)
    corridor = Column(String(150), nullable=False)
    incident_datetime = Column(DateTime, nullable=False)
    weather = Column(String(50))
    collision_type = Column(String(100))
    accident_factor = Column(String(100))
    vehicle_counts = Column(JSON, nullable=False, default=dict)
    priority = Column(String(10), nullable=False)  # 'High' | 'Medium' | 'Low'
    logged_by_user_id = Column(Integer, ForeignKey("users.id"))
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
