-- Creates the three tables. Safe to run more than once.
-- Run while connected to the project database (qc_road_safety) as a superuser such as
-- postgres, AFTER the csrp2_app user exists - the GRANTs at the bottom need it.
-- Full setup steps are in the README.

-- Users: mirrors the frontend's account management (Accounts page)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,   -- hashed by FastAPI (passlib/bcrypt), never plain text
    role VARCHAR(10) NOT NULL CHECK (role IN ('admin', 'staff')),
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Incidents: mirrors Report Incident -> Records
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    corridor VARCHAR(150) NOT NULL,
    incident_datetime TIMESTAMP NOT NULL,
    weather VARCHAR(50),
    collision_type VARCHAR(100),
    accident_factor VARCHAR(100),
    vehicle_counts JSONB NOT NULL DEFAULT '{}',   -- e.g. {"Car": 2, "Motorcycle": 1, ...}
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
    logged_by_user_id INTEGER REFERENCES users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'Pending review'
        CHECK (status IN ('Pending review', 'Confirmed', 'Included in training')),
    confirmed_outcome VARCHAR(30)
        CHECK (confirmed_outcome IN ('Fatal', 'Non Fatal Injury', 'Damage to Property')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Risk Areas: precomputed corridor-level stats from the 2022-2025 MMDA dataset
CREATE TABLE IF NOT EXISTS risk_areas (
    id SERIAL PRIMARY KEY,
    corridor VARCHAR(150) UNIQUE NOT NULL,
    total_incidents INTEGER NOT NULL,
    high_priority_rate NUMERIC(5,2) NOT NULL,
    risk_level VARCHAR(10) NOT NULL CHECK (risk_level IN ('High', 'Medium', 'Low')),
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6)
);

-- Grant the app user full access to every table above, now and for anything added later
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO csrp2_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO csrp2_app;
