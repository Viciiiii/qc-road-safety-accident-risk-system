"""
Sign-in, sessions and permission checks.

How it works:
  - Passwords are stored as bcrypt hashes, never as plain text.
  - Signing in creates a random session token. The browser keeps it in an httpOnly
    cookie (page scripts can't read it); the database keeps only its SHA-256 hash, so a
    leaked database can't be used to sign in.
  - A session lasts 8 hours, or 30 days with "Remember me". Signing out, disabling the
    account, or resetting/changing the password ends it straight away.
  - Every API route except sign-in depends on current_user (or require_admin).
"""
import hashlib
import os
import re
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from . import models
from .database import get_db

load_dotenv()

COOKIE_NAME = "qc_session"
SHORT_SESSION = timedelta(hours=8)
LONG_SESSION = timedelta(days=30)          # "Remember me"
# Set COOKIE_SECURE=true when the site is served over HTTPS, so the cookie is never sent over plain HTTP.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").strip().lower() == "true"

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# Temporary passwords: no look-alikes (0/O, 1/l/I) so they're easy to read out and type.
TEMP_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)   # stored as naive UTC


# ---------- passwords ----------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False


# Checked when no account matches, so a wrong email takes as long as a wrong password
# (otherwise response times would reveal which emails have accounts).
_DUMMY_HASH = hash_password("not-a-real-password")


def burn_time(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


def password_problem(password: str) -> str | None:
    """Rule for passwords people choose themselves. Returns a message, or None if it's fine."""
    if len(password) < 8:
        return "Use at least 8 characters."
    if len(password.encode("utf-8")) > 72:
        return "Use at most 72 characters."            # bcrypt's limit
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        return "Use at least one letter and one number."
    return None


def generate_temp_password(length: int = 10) -> str:
    return "".join(secrets.choice(TEMP_CHARS) for _ in range(length))


def normalize_email(email: str) -> str:
    return email.strip().lower()     # emails are matched in any letter case


# ---------- sessions ----------

def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def start_session(db: Session, user: models.User, remember: bool) -> tuple[str, timedelta]:
    token = secrets.token_urlsafe(32)
    length = LONG_SESSION if remember else SHORT_SESSION
    db.add(models.UserSession(user_id=user.id, token_hash=_token_hash(token), expires_at=utcnow() + length))
    db.query(models.UserSession).filter(models.UserSession.expires_at < utcnow()).delete()  # tidy up
    return token, length


def end_session(db: Session, token: str | None) -> None:
    if token:
        db.query(models.UserSession).filter_by(token_hash=_token_hash(token)).delete()


def end_all_sessions(db: Session, user_id: int, keep_token: str | None = None) -> None:
    q = db.query(models.UserSession).filter(models.UserSession.user_id == user_id)
    if keep_token:
        q = q.filter(models.UserSession.token_hash != _token_hash(keep_token))
    q.delete(synchronize_session=False)


def set_session_cookie(response, token: str, length: timedelta, remember: bool) -> None:
    response.set_cookie(
        COOKIE_NAME, token,
        max_age=int(length.total_seconds()) if remember else None,   # without Remember me: gone when the browser closes
        httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/",
    )


def clear_session_cookie(response) -> None:
    response.delete_cookie(COOKIE_NAME, httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/")


# ---------- dependencies used by the routers ----------

def current_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        row = db.query(models.UserSession).filter_by(token_hash=_token_hash(token)).first()
        if row and row.expires_at > utcnow():
            user = db.get(models.User, row.user_id)
            if user and not user.disabled:
                return user
    raise HTTPException(401, "Please sign in.")


def require_admin(user: models.User = Depends(current_user)) -> models.User:
    if user.role != "admin":
        raise HTTPException(403, "Only an admin can do this.")
    return user


# ---------- failed sign-in limit (per email, kept in memory) ----------

_failures: dict[str, list[float]] = {}
_lock = threading.Lock()


def seconds_locked(email: str) -> int:
    with _lock:
        recent = [t for t in _failures.get(email, []) if time.monotonic() - t < LOCKOUT_SECONDS]
        _failures[email] = recent
        if len(recent) >= MAX_FAILED_ATTEMPTS:
            return int(LOCKOUT_SECONDS - (time.monotonic() - recent[0])) + 1
        return 0


def record_failure(email: str) -> None:
    with _lock:
        _failures.setdefault(email, []).append(time.monotonic())


def clear_failures(email: str) -> None:
    with _lock:
        _failures.pop(email, None)
