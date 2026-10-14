"""Sign-in, sessions, roles and account management."""
from sqlalchemy import text

from app import auth
from conftest import ADMIN_EMAIL, ADMIN_PASSWORD, new_client as client


def test_auth_end_to_end(db, check):
    anon = client()
    for m, path in [("get", "/api/risk-areas"), ("get", "/api/incidents"), ("get", "/api/form-options"), ("get", "/api/users"), ("get", "/api/auth/me")]:
        check(getattr(anon, m)(path).status_code == 401, f"signed out: {path} -> 401")
    check(anon.post("/api/predict-incident", json={}).status_code == 401, "signed out: predict -> 401 (before validation)")
    check(anon.post("/api/incidents/export").status_code == 401, "signed out: export -> 401")

    r1 = anon.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    r2 = anon.post("/api/auth/login", json={"email": "nobody@qc.gov.ph", "password": "wrong"})
    check(r1.status_code == r2.status_code == 401 and r1.json() == r2.json(), "wrong password and unknown email give the same answer")
    check(anon.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD.lower()}).status_code == 401, "password is case-sensitive")

    admin = client()
    r = admin.post("/api/auth/login", json={"email": "  " + ADMIN_EMAIL.upper() + " ", "password": ADMIN_PASSWORD})
    check(r.status_code == 200 and r.json()["role"] == "admin", "email works in any case")
    sc = r.headers["set-cookie"]
    check("HttpOnly" in sc and "SameSite=lax" in sc and "Max-Age" not in sc, f"cookie is HttpOnly, SameSite=Lax, ends with the browser without Remember me")
    token = admin.cookies.get("qc_session")
    check(db.execute(text("SELECT count(*) FROM user_sessions WHERE token_hash = :t"), {"t": token}).scalar() == 0
       and db.execute(text("SELECT count(*) FROM user_sessions")).scalar() == 1, "database stores only a hash of the token")
    rem = client(); r = rem.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "remember": True})
    check("Max-Age=2592000" in r.headers["set-cookie"], "Remember me keeps the cookie 30 days")
    exp = db.execute(text("SELECT expires_at - now() AT TIME ZONE 'utc' FROM user_sessions ORDER BY id DESC LIMIT 1")).scalar()
    check(29.9 < exp.total_seconds() / 86400 < 30.1, f"Remember-me session expires in 30 days")
    exp = db.execute(text("SELECT expires_at - now() AT TIME ZONE 'utc' FROM user_sessions ORDER BY id ASC LIMIT 1")).scalar()
    check(7.9 < exp.total_seconds() / 3600 < 8.1, "normal session expires in 8 hours")
    check(admin.get("/api/auth/me").json()["email"] == ADMIN_EMAIL, "GET /me returns the admin")
    check(admin.get("/api/risk-areas").status_code == 200, "signed in: risk areas load")

    # create staff
    r = admin.post("/api/users", json={"name": " Juan Dela Cruz ", "email": "Juan@QC.gov.ph"})
    check(r.status_code == 201, "admin creates a staff account")
    temp = r.json()["temporary_password"]; juan = r.json()["user"]
    check(juan["email"] == "juan@qc.gov.ph" and juan["role"] == "staff" and juan["must_change_password"] and len(temp) == 10, f"stored lowercase, staff, marked temporary (temp {temp})")
    check(admin.post("/api/users", json={"name": "X", "email": "JUAN@qc.gov.ph"}).status_code == 409, "duplicate email in another case -> 409")
    check(admin.post("/api/users", json={"name": "X", "email": "not-an-email"}).status_code == 422, "invalid email -> 422")
    check(db.execute(text("SELECT password_hash FROM users WHERE email='juan@qc.gov.ph'")).scalar().startswith("$2b$"), "password stored as a bcrypt hash")

    staff = client(); r = staff.post("/api/auth/login", json={"email": "juan@qc.gov.ph", "password": temp})
    check(r.status_code == 200 and r.json()["must_change_password"], "staff signs in with the temporary password; flagged to change it")
    check(staff.get("/api/users").status_code == 403, "staff can't list accounts (403)")
    check(staff.post("/api/users", json={"name": "Y", "email": "y@qc.gov.ph"}).status_code == 403, "staff can't create accounts")
    inc = staff.post("/api/incidents", json={"corridor": "EDSA", "incident_datetime": "2025-11-20T21:30", "weather": "Fair (Night)",
          "collision_type": "Head On", "accident_factor": "Human Error", "vehicles": {"Car": 1}, "priority": "High", "logged_by_name": "Someone Else"})
    check(inc.status_code == 201 and inc.json()["logged_by_name"] == "Juan Dela Cruz", "incident is credited to the signed-in account, not the name sent")
    iid = inc.json()["id"]
    check(db.execute(text("SELECT logged_by_user_id FROM incidents WHERE id=:i"), {"i": iid}).scalar() == juan["id"], "incident linked to the user id")
    check(staff.post(f"/api/incidents/{iid}/confirm", json={"outcome": "Fatal"}).status_code == 403, "staff can't confirm outcomes")
    check(staff.post("/api/incidents/export").status_code == 403, "staff can't export")
    check(admin.post(f"/api/incidents/{iid}/confirm", json={"outcome": "Fatal"}).status_code == 200, "admin can confirm")

    # change password
    other = client(); other.post("/api/auth/login", json={"email": "juan@qc.gov.ph", "password": temp})
    check(staff.post("/api/auth/change-password", json={"current_password": "nope", "new_password": "Abcdefg1"}).status_code == 400, "wrong current password -> 400")
    check(staff.post("/api/auth/change-password", json={"current_password": temp, "new_password": "short1"}).status_code == 422, "too short -> 422")
    check(staff.post("/api/auth/change-password", json={"current_password": temp, "new_password": "abcdefgh"}).status_code == 422, "no number -> 422")
    r = staff.post("/api/auth/change-password", json={"current_password": temp, "new_password": "JuanSecure9"})
    check(r.status_code == 200 and not r.json()["must_change_password"], "staff sets own password; reminder cleared")
    check(staff.get("/api/auth/me").status_code == 200, "this browser stays signed in")
    check(other.get("/api/auth/me").status_code == 401, "other browsers are signed out")
    check(client().post("/api/auth/login", json={"email": "juan@qc.gov.ph", "password": temp}).status_code == 401, "temporary password no longer works")

    # admin reset
    r = admin.post(f"/api/users/{juan['id']}/reset-password"); temp2 = r.json()["temporary_password"]
    check(r.status_code == 200 and r.json()["user"]["must_change_password"] and temp2 != temp, "admin reset gives a new temporary password")
    check(staff.get("/api/auth/me").status_code == 401, "reset signs the staff member out")
    check(client().post("/api/auth/login", json={"email": "juan@qc.gov.ph", "password": "JuanSecure9"}).status_code == 401, "their old password stops working")
    staff = client(); check(staff.post("/api/auth/login", json={"email": "juan@qc.gov.ph", "password": temp2}).status_code == 200, "new temporary password works")
    me = admin.get("/api/auth/me").json()
    check(admin.post(f"/api/users/{me['id']}/reset-password").status_code == 400, "admin can't reset own password from Accounts")

    # disable
    check(admin.patch(f"/api/users/{me['id']}", json={"disabled": True}).status_code == 400, "admin can't disable self")
    check(admin.patch(f"/api/users/{juan['id']}", json={"disabled": True}).json()["disabled"], "admin disables staff")
    check(staff.get("/api/incidents").status_code == 401, "disabled account is signed out at once")
    r = client().post("/api/auth/login", json={"email": "juan@qc.gov.ph", "password": temp2})
    check(r.status_code == 403 and "disabled" in r.json()["detail"], "correct password on a disabled account -> 'disabled' message")
    check(client().post("/api/auth/login", json={"email": "juan@qc.gov.ph", "password": "bad"}).status_code == 401, "wrong password on a disabled account -> just 'incorrect'")
    admin.patch(f"/api/users/{juan['id']}", json={"disabled": False})
    check(client().post("/api/auth/login", json={"email": "juan@qc.gov.ph", "password": temp2}).status_code == 200, "re-enabled account can sign in")
    users = admin.get("/api/users").json(); check(any(u["email"] == "juan@qc.gov.ph" for u in users) and all("password_hash" not in u for u in users), "user list shows the staff account and never includes hashes")

    # expiry
    c = client(); c.post("/api/auth/login", json={"email": "juan@qc.gov.ph", "password": temp2})
    db.execute(text("UPDATE user_sessions SET expires_at = (now() AT TIME ZONE 'utc') - interval '1 minute' WHERE token_hash = encode(sha256(convert_to(:t,'UTF8')),'hex')"), {"t": c.cookies.get("qc_session")}); db.commit()
    check(c.get("/api/auth/me").status_code == 401, "expired session -> 401")

    # lockout
    lc = client()
    codes = [lc.post("/api/auth/login", json={"email": "juan@qc.gov.ph", "password": "bad"}).status_code for _ in range(5)]
    r = lc.post("/api/auth/login", json={"email": "JUAN@qc.gov.ph", "password": temp2})
    check(codes == [401]*5 and r.status_code == 429, f"5 wrong attempts lock the email for 15 min, even with the right password ({r.json()['detail']})")
    auth._failures.clear()

    # logout
    check(admin.post("/api/auth/logout").status_code == 204 and admin.get("/api/auth/me").status_code == 401, "sign out ends the session")
    check(db.execute(text("SELECT count(*) FROM user_sessions WHERE token_hash = encode(sha256(convert_to(:t,'UTF8')),'hex')"), {"t": token}).scalar() == 0, "session row deleted on sign out")
