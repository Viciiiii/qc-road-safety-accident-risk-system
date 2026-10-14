"""
Creates an admin account (or resets an existing admin's password).

Run from the backend folder with the venv active:
    python scripts/create_admin.py

It asks for a name, email and password. The password is typed hidden and stored only as
a bcrypt hash. Admins can't be created from the app itself; they add staff accounts there.
"""
import argparse
import getpass
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from sqlalchemy import func  # noqa: E402

from app import auth, models  # noqa: E402
from app.database import SessionLocal  # noqa: E402


def main():
    p = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    p.add_argument("--name"); p.add_argument("--email")
    p.add_argument("--password", help="for scripts only; omit to be asked (hidden)")
    a = p.parse_args()

    email = auth.normalize_email(a.email or input("Admin email: "))
    if not auth.EMAIL_RE.match(email):
        sys.exit("That doesn't look like an email address.")
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
        if user and user.role != "admin":
            sys.exit(f"{email} is a staff account. Use a different email for the admin.")
        name = a.name or (user.name if user else input("Full name: ").strip())
        if not name:
            sys.exit("A name is required.")
        password = a.password
        if password is None:
            password = getpass.getpass("Password (hidden): ")
            if getpass.getpass("Type it again: ") != password:
                sys.exit("The passwords don't match.")
        problem = auth.password_problem(password)
        if problem:
            sys.exit(problem)

        if user:
            user.password_hash = auth.hash_password(password)
            user.must_change_password = False
            user.disabled = False
            auth.end_all_sessions(db, user.id)
            action = "Password reset for"
        else:
            user = models.User(name=name, email=email, role="admin", disabled=False,
                               password_hash=auth.hash_password(password), must_change_password=False)
            db.add(user)
            action = "Created admin"
        db.commit()
        print(f"{action} {name} <{email}>. Sign in with this email and password.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
