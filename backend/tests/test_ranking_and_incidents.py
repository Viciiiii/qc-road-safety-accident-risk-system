"""Corridor ranking and the incident lifecycle: log -> confirm -> counts in the ranking -> export."""
from collections import Counter

from sqlalchemy import text

from conftest import ADMIN_NAME


def scores(client):
    return {x["corridor"]: x for x in client.get("/api/risk-areas").json()["corridors"]}


def test_ranking(admin_client, db, check):
    r = admin_client.get("/api/risk-areas")
    check(r.status_code == 200, f"GET /api/risk-areas -> {r.status_code}")
    d = r.json()
    cs = d["corridors"]
    check(d["window_start"] == "2025-01-01" and d["data_through"] == "2025-12-01",
          f"window {d['window_start']} .. {d['data_through']}")
    tiers = Counter(x["risk_level"] for x in cs)
    check(len(cs) == 29 and tiers == {"High": 10, "Medium": 10, "Low": 9}, f"29 corridors, tiers {dict(tiers)}")
    check([x["rank"] for x in cs] == list(range(1, 30)), "ranks are 1..29 in order")
    check(all(x["severity_score"] == x["damage"] + 3 * x["injury"] + 10 * x["fatal"] for x in cs),
          "score = 1*damage + 3*injury + 10*fatal for every corridor")

    # Recount straight from corridor_monthly with SQL, independently of ranking.py
    rows = db.execute(text("""
        SELECT corridor, SUM(damage + 3 * injury + 10 * fatal) AS score
        FROM corridor_monthly WHERE month BETWEEN :a AND :b GROUP BY corridor"""),
        {"a": d["window_start"], "b": d["data_through"]}).all()
    expected = {c: int(s) for c, s in rows}
    check(all(expected.get(x["corridor"], 0) == x["severity_score"] for x in cs),
          "every score matches an SQL recount of the 12-month window")
    top10 = sorted(expected, key=lambda c: -expected[c])[:10]
    check({x["corridor"] for x in cs if x["risk_level"] == "High"} == set(top10), "High tier = the 10 highest scores")
    print("   top 5:", [(x["corridor"], x["severity_score"]) for x in cs[:5]])

    pre = admin_client.options("/api/incidents/1/confirm", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"})
    check(pre.status_code == 200, "browser CORS preflight -> 200")


def test_incident_lifecycle(admin_client, check):
    c = admin_client
    low = c.get("/api/risk-areas").json()["corridors"][-1]
    before = low["severity_score"]
    base = {"corridor": low["corridor"], "incident_datetime": "2025-11-20T21:30", "weather": "Fair (Night)",
            "collision_type": "Head On", "accident_factor": "Human Error", "vehicles": {"Car": 1, "Motorcycle": 1},
            "priority": "High"}

    for label, change in [("unknown corridor", {"corridor": "Nowhere St."}),
                          ("future date", {"incident_datetime": "2099-01-01T00:00"}),
                          ("bad priority", {"priority": "Urgent"}), ("bad vehicle", {"vehicles": {"Spaceship": 1}}),
                          ("negative count", {"vehicles": {"Car": -1}})]:
        r = c.post("/api/incidents", json={**base, **change})
        check(r.status_code == 422, f"rejects {label} -> {r.status_code}")

    a = c.post("/api/incidents", json={**base, "logged_by_name": "Someone Else"})
    check(a.status_code == 201 and a.json()["status"] == "Pending review", "create -> 201 Pending review")
    a = a.json()
    check(a["logged_by_name"] == ADMIN_NAME, "credited to the signed-in account, not the name sent")
    b = c.post("/api/incidents", json={**base, "incident_datetime": "2026-09-01T08:00"}).json()  # after the MMDA data
    check(len(c.get("/api/incidents").json()) == 2, "GET /api/incidents lists both")
    check(scores(c)[low["corridor"]]["severity_score"] == before, "a pending incident does NOT change the score")

    check(c.post(f"/api/incidents/{a['id']}/confirm", json={"outcome": "Fatal"}).json()["status"] == "Confirmed",
          "confirm -> Confirmed")
    s1 = scores(c)[low["corridor"]]
    check(s1["severity_score"] == before + 10 and s1["confirmed_incidents"] == 1, f"confirmed Fatal adds 10 ({before} -> {s1['severity_score']})")
    c.post(f"/api/incidents/{a['id']}/confirm", json={"outcome": "Non Fatal Injury"})
    check(scores(c)[low["corridor"]]["severity_score"] == before + 3, "re-confirming as Injury corrects it to +3")

    c.post(f"/api/incidents/{b['id']}/confirm", json={"outcome": "Fatal"})
    rk = c.get("/api/risk-areas").json()
    s3 = {x["corridor"]: x for x in rk["corridors"]}[low["corridor"]]
    check(rk["confirmed_since_data"] == 1 and s3["severity_score"] == before + 13 and s3["confirmed_incidents"] == 2,
          "a confirmed incident newer than the MMDA data counts right away")
    old = c.post("/api/incidents", json={**base, "incident_datetime": "2024-06-01T10:00"}).json()
    c.post(f"/api/incidents/{old['id']}/confirm", json={"outcome": "Fatal"})
    check(scores(c)[low["corridor"]]["severity_score"] == before + 13, "a confirmed incident older than the window doesn't count")

    check(c.post("/api/incidents/999999/confirm", json={"outcome": "Fatal"}).status_code == 404, "unknown incident -> 404")
    check(c.post(f"/api/incidents/{a['id']}/confirm", json={"outcome": "Maybe"}).status_code == 422, "invalid outcome -> 422")

    ex = c.post("/api/incidents/export").json()
    check(len(ex) == 3 and {x["confirmed_outcome"] for x in ex} == {"Non Fatal Injury", "Fatal"},
          "export returns the 3 confirmed incidents")
    check(all(x["status"] == "Included in training" for x in c.get("/api/incidents").json()), "then all are Included in training")
    check(c.post("/api/incidents/export").json() == [], "second export returns nothing")
    check(c.post(f"/api/incidents/{a['id']}/confirm", json={"outcome": "Fatal"}).status_code == 409,
          "an exported incident can't be changed -> 409")
    check(scores(c)[low["corridor"]]["severity_score"] == before + 13, "exported incidents still count toward the ranking")
