"""Account management for admins: list, create staff, reset password, disable/enable."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])


def _get(db: Session, user_id: int) -> models.User:
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(404, "Account not found.")
    return user


@router.get("", response_model=List[schemas.UserOut])
def list_users(admin: models.User = Depends(auth.require_admin), db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.role, models.User.name).all()


@router.post("", response_model=schemas.TempPasswordOut, status_code=201)
def create_staff(body: schemas.UserCreate, admin: models.User = Depends(auth.require_admin),
                 db: Session = Depends(get_db)):
    email = auth.normalize_email(body.email)
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "Enter the staff member's name.")
    if not auth.EMAIL_RE.match(email):
        raise HTTPException(422, "Enter a valid email address.")
    if db.query(models.User).filter(func.lower(models.User.email) == email).first():
        raise HTTPException(409, "An account with that email already exists.")
    temp = auth.generate_temp_password()
    user = models.User(name=name, email=email, role="staff", disabled=False,
                       password_hash=auth.hash_password(temp), must_change_password=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user": user, "temporary_password": temp}


@router.post("/{user_id}/reset-password", response_model=schemas.TempPasswordOut)
def reset_password(user_id: int, admin: models.User = Depends(auth.require_admin), db: Session = Depends(get_db)):
    user = _get(db, user_id)
    if user.id == admin.id:
        raise HTTPException(400, "Change your own password in Settings.")
    temp = auth.generate_temp_password()
    user.password_hash = auth.hash_password(temp)
    user.must_change_password = True
    auth.end_all_sessions(db, user.id)      # the old password, and anyone signed in with it, stops working
    db.commit()
    db.refresh(user)
    return {"user": user, "temporary_password": temp}


@router.patch("/{user_id}", response_model=schemas.UserOut)
def set_disabled(user_id: int, body: schemas.UserUpdate, admin: models.User = Depends(auth.require_admin),
                 db: Session = Depends(get_db)):
    user = _get(db, user_id)
    if user.id == admin.id and body.disabled:
        raise HTTPException(400, "You can't disable your own account.")
    user.disabled = body.disabled
    if body.disabled:
        auth.end_all_sessions(db, user.id)  # signed out everywhere, immediately
    db.commit()
    db.refresh(user)
    return user
