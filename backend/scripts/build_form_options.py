"""
Builds models/form_options.json: the dropdown values the Report Incident form offers.

Why this exists: the trained encoders contain 904 Collision Type and 56 Accident Factor
values (many are one-off typos / trailing-space duplicates), so the form can't offer them
all. This groups near-duplicates, keeps the common ones, and records the EXACT encoder
string to send for each so predictions always match a class the model has seen.

Re-run after retraining:
    python scripts/build_form_options.py "C:/path/to/folder/with/RAW_Data_QC_20XX.xlsx"
"""
import collections, glob, json, os, pickle, re, sys
import openpyxl

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
RAW_DIR = sys.argv[1] if len(sys.argv) > 1 else "."
MIN_COLLISION, MIN_FACTOR = 100, 10

encoders = pickle.load(open(os.path.join(MODELS_DIR, "priority_encoders.pkl"), "rb"))
valid = {col: set(encoders[col].classes_) for col in ("Collision Type", "Accident Factor", "Weather")}

counts = {"Collision Type": collections.Counter(), "Accident Factor": collections.Counter()}
for path in sorted(glob.glob(os.path.join(RAW_DIR, "RAW_Data_QC_*.xlsx"))):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True)["QC road crash data"]
    idx = None
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            idx = {h: j for j, h in enumerate(row) if h}
            continue
        for col in counts:
            v = row[idx[col]]
            counts[col][str(v) if v is not None else "Unknown"] += 1   # same as the notebook's fillna + astype(str)

def tidy(s):  # "Hit Object " -> "Hit Object"
    return re.sub(r"\s+", " ", s.strip())

def build(col, min_count, group_parentheses):
    groups = collections.defaultdict(list)          # group key -> [(exact_string, count)]
    for exact, n in counts[col].items():
        if exact not in valid[col]:
            continue                                  # never offer a value the encoder doesn't know
        key = tidy(exact)
        if group_parentheses:
            key = key.split(" (")[0].strip()          # "Human Error (Fell Asleep)" -> "Human Error"
        groups[key].append((exact, n))
    options = []
    for key, members in groups.items():
        total = sum(n for _, n in members)
        if total < min_count and key != "Unknown":
            continue
        exact_matches = [m for m in members if tidy(m[0]) == key]   # prefer the plain, un-detailed value
        exact = max(exact_matches or members, key=lambda m: m[1])[0]
        label = key if exact_matches else tidy(exact)
        options.append({"value": exact, "label": label, "count": total})
    return sorted(options, key=lambda o: -o["count"])

out = {
    "weather": sorted(valid["Weather"]),
    "collision_types": build("Collision Type", MIN_COLLISION, group_parentheses=True),
    "accident_factors": build("Accident Factor", MIN_FACTOR, group_parentheses=True),
}
with open(os.path.join(MODELS_DIR, "form_options.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
print("collision types:", len(out["collision_types"]), "| accident factors:", len(out["accident_factors"]))
