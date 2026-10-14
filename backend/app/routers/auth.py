"""Sign in, sign out, who am I, change my password."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

WRONG_CREDENTIALS = "Incorrect email or password."


@router.post("/login", response_model=schemas.UserOut)
def login(body: schemas.LoginIn, response: Response, db: Session = Depends(get_db)):
    email = auth.normalize_email(body.email)
    wait = auth.seconds_locked(email)
    if wait:
        raise HTTPException(429, f"Too many failed attempts. Try again in {max(1, round(wait / 60))} minute(s).")

    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if user is None:
        auth.burn_time(body.password)
        auth.record_failure(email)
        raise HTTPException(401, WRONG_CREDENTIALS)
    if not auth.verify_password(body.password, user.password_hash):
        auth.record_failure(email)
        raise HTTPException(401, WRONG_CREDENTIALS)
    # Only revealed after a correct password, so strangers can't probe which accounts exist.
    if user.disabled:
        raise HTTPException(403, "This account has been disabled. Contact your administrator.")

    auth.clear_failures(email)
    token, length = auth.start_session(db, user, body.remember)
    user.last_login_at = auth.utcnow()
    db.commit()
    db.refresh(user)
    auth.set_session_cookie(response, token, length, body.remember)
    return user


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    auth.end_session(db, request.cookies.get(auth.COOKIE_NAME))
    db.commit()
    auth.clear_session_cookie(response)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(auth.current_user)):
    return user


@router.post("/change-password", response_model=schemas.UserOut)
def change_password(body: schemas.ChangePasswordIn, request: Request,
                    user: models.User = Depends(auth.current_user), db: Session = Depends(get_db)):
    if not auth.verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "Your current password is incorrect.")
    problem = auth.password_problem(body.new_password)
    if problem:
        raise HTTPException(422, problem)
    if body.new_password == body.current_password:
        raise HTTPException(422, "Choose a password different from your current one.")
    user.password_hash = auth.hash_password(body.new_password)
    user.must_change_password = False
    # Sign out every other browser, keep this one.
    auth.end_all_sessions(db, user.id, keep_token=request.cookies.get(auth.COOKIE_NAME))
    db.commit()
    db.refresh(user)
    return user
