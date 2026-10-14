-- Real sign-in: adds what the users table needs and a table of signed-in sessions.
-- Safe to run more than once. Run in pgAdmin while connected to qc_road_safety
-- (as postgres, like the earlier scripts). Then create the first admin with:
--     python scripts/create_admin.py

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Emails are matched in any letter case, so Juan@qc.gov.ph and juan@qc.gov.ph can't both exist.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));

-- One row per signed-in browser. Only a SHA-256 hash of the cookie's token is stored.
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,          -- UTC
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions (user_id);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO csrp2_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO csrp2_app;
