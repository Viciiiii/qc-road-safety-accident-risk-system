"""
Shared setup for the backend tests.

The tests create and delete incidents and staff accounts, so they refuse to run against
your real database. Point them at a separate copy whose name contains "test":

    $env:TEST_DATABASE_URL = "postgresql+psycopg2://csrp2_app:PASSWORD@localhost:5432/qc_road_safety_test"
    pytest -s

Set-up steps for that database are in tests/README.md.
"""
import os
import sys

import pytest
from sqlalchemy.engine import make_url

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def pytest_configure(config):
    """Runs before any test file is imported, so DATABASE_URL is set before the app reads it."""
    url = os.getenv("TEST_DATABASE_URL", "").strip()
    if not url:
        raise pytest.UsageError("Set TEST_DATABASE_URL to a separate test database first (see backend/tests/README.md).")
    try:
        name = make_url(url).database or ""
    except Exception as exc:
        raise pytest.UsageError(f"TEST_DATABASE_URL isn't a valid database URL: {exc}")
    if "test" not in name.lower():
        raise pytest.UsageError(f"Refusing to run: database '{name}' doesn't have 'test' in its name. "
                                "These tests delete incidents and accounts.")
    # app/database.py reads DATABASE_URL when first imported; load_dotenv never overrides it.
    os.environ["DATABASE_URL"] = url
    sys.path.insert(0, BACKEND_DIR)


ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "test-admin@example.com").lower()
ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "TestAdmin1")
ADMIN_NAME = "Test Admin"


class Checks:
    """Prints PASS/FAIL for each check (run pytest with -s to see them) and fails the test at the end."""

    def __init__(self):
        self.failed = []

    def __call__(self, condition, message):
        print(("PASS " if condition else "FAIL ") + message)
        if not condition:
            self.failed.append(message)
        return condition

    def done(self):
        assert not self.failed, f"{len(self.failed)} check(s) failed: {self.failed}"


@pytest.fixture
def check():
    c = Checks()
    yield c
    c.done()


@pytest.fixture
def db():
    from app.database import SessionLocal
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(autouse=True)
def clean_database(db):
    """Every test starts with no incidents, no sessions, no staff, and one known admin."""
    from sqlalchemy import func, text
    from app import auth, models
    db.execute(text("DELETE FROM user_sessions"))
    db.execute(text("DELETE FROM incidents"))
    db.execute(text("DELETE FROM users WHERE role = 'staff'"))
    admin = db.query(models.User).filter(func.lower(models.User.email) == ADMIN_EMAIL).first()
    if admin is None:
        db.add(models.User(name=ADMIN_NAME, email=ADMIN_EMAIL, role="admin", disabled=False,
                           password_hash=auth.hash_password(ADMIN_PASSWORD), must_change_password=False))
    else:
        admin.name, admin.role, admin.disabled, admin.must_change_password = ADMIN_NAME, "admin", False, False
        admin.password_hash = auth.hash_password(ADMIN_PASSWORD)
    db.commit()
    auth._failures.clear()          # wrong-password lockouts from earlier tests
    yield
    auth._failures.clear()


def new_client():
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


@pytest.fixture
def admin_client():
    c = new_client()
    r = c.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return c
