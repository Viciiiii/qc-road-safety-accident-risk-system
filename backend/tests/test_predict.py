"""The prediction endpoint: three models, each applying its own High cutoff; the corridor is a model input."""
import json
import os

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")


def body(**kw):
    b = {"incident_datetime": "2025-11-20T23:30", "weather": "Fair (Night)", "collision_type": "Hit Pedestrian",
         "accident_factor": "Human Error", "vehicles": {"Motorcycle": 1, "Truck": 1}, "corridor": "EDSA"}
    b.update(kw)
    return b


def test_predictions(admin_client, check):
    c = admin_client
    check(c.get("/api/form-options").status_code == 200, "GET /api/form-options")
    with open(os.path.join(MODELS_DIR, "priority_model_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)

    cases = {
        "night, hit pedestrian, motorcycle + truck": body(),
        "daytime rear end, 2 cars": body(incident_datetime="2025-03-12T10:15", weather="Fair (Day)", collision_type="Rear End",
                                         accident_factor="No Accident Factor (Based on the Police Blotter Book)",
                                         vehicles={"Car": 2}),
        "late-night motorcycle self accident": body(incident_datetime="2025-06-07T02:10", collision_type="Self Accident",
                                                    vehicles={"Motorcycle": 1}),
    }
    for name, b in cases.items():
        r = c.post("/api/predict-incident", json=b)
        check(r.status_code == 200, f"predict: {name}")
        p = r.json()["predictions"]
        check(set(p) == {"random_forest", "svm", "naive_bayes"}
              and all(v["label"] in ("High", "Medium", "Low") for v in p.values()), "   three models, valid labels")
        v = p["random_forest"]
        cut = round(cfg["models"]["random_forest"]["high_cutoff"] * 100, 1)
        check(v["high_cutoff"] == cut and (v["label"] == "High") == (v["probabilities"]["High"] >= cut - 0.05),
              f"   random_forest: High exactly when High% >= its cutoff {cut}% (got {v['label']}, High {v['probabilities']['High']}%)")
        check(p["svm"]["probabilities"] is None and p["naive_bayes"]["probabilities"] is None,
              f"   svm and naive_bayes: no probabilities shown (got {p['svm']['label']}, {p['naive_bayes']['label']})")

    # The corridor's crash history is an input: the same crash scores differently on different roads
    highs = {}
    for road in ("Commonwealth Ave.", "EDSA", "Timog Ave.", "Payatas Road"):
        r = c.post("/api/predict-incident", json=body(corridor=road)).json()
        highs[road] = r["predictions"]["random_forest"]["probabilities"]["High"]
    check(len(set(highs.values())) > 1, f"same crash, different corridors -> different High% {highs}")
    check(c.post("/api/predict-incident", json=body(corridor="Commonwealth Ave.")).json()["street_history"]["crashes"] > 1000,
          "Commonwealth Ave. has its 2022-2023 crash history")
    unknown = c.post("/api/predict-incident", json=body(corridor="A Street Nobody Has Heard Of"))
    check(unknown.status_code == 200 and unknown.json()["street_history"]["crashes"] == 0,
          "a street with no history falls back to the citywide rate")
    no_corridor = body(); no_corridor.pop("corridor")
    check(c.post("/api/predict-incident", json=no_corridor).status_code == 422, "missing corridor -> 422")
    check(c.post("/api/predict-incident", json=body(corridor="")).status_code == 422, "empty corridor -> 422")

    check(c.post("/api/predict-incident", json=body(vehicles={"Motorcycle": 9})).status_code == 200, "9 motorcycles accepted")
    check(c.post("/api/predict-incident", json=body(collision_type="Flying Saucer")).status_code == 422, "unknown collision type -> 422")
    check(c.post("/api/predict-incident", json=body(vehicles={"Spaceship": 1})).status_code == 422, "unknown vehicle -> 422")
    check(c.post("/api/predict-incident", json=body(incident_datetime="2024-02-29T08:00")).status_code == 200, "leap day works")
