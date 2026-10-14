"""The prediction endpoint: three models, each applying its own High cutoff."""
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
        for k in ("random_forest", "naive_bayes"):
            v = p[k]
            cut = round(cfg["models"][k]["high_cutoff"] * 100, 1)
            check(v["high_cutoff"] == cut and (v["label"] == "High") == (v["probabilities"]["High"] >= cut - 0.05),
                  f"   {k}: High exactly when High% >= its cutoff {cut}% (got {v['label']}, High {v['probabilities']['High']}%)")
        check(p["svm"]["probabilities"] is None, f"   svm: no probabilities (got {p['svm']['label']})")

    check(c.post("/api/predict-incident", json=body(vehicles={"Motorcycle": 9})).status_code == 200, "9 motorcycles accepted")
    check(c.post("/api/predict-incident", json=body(collision_type="Flying Saucer")).status_code == 422, "unknown collision type -> 422")
    check(c.post("/api/predict-incident", json=body(vehicles={"Spaceship": 1})).status_code == 422, "unknown vehicle -> 422")
    check(c.post("/api/predict-incident", json=body(incident_datetime="2024-02-29T08:00")).status_code == 200, "leap day works")
