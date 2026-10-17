# Backend tests

| File | What it checks |
|---|---|
| `test_ranking_and_incidents.py` | The corridor ranking and trends (scores and arrows recounted with SQL, tiers, window, how confirmed logs move the trend) and the incident flow: validation, pending incidents don't count, confirmed ones do (including ones newer than the MMDA data), correcting an outcome, export |
| `test_auth.py` | Sign-in and sessions: wrong/unknown email look the same, email any case and password exact, httpOnly cookie, 8-hour and 30-day sessions, hashed tokens and passwords, staff vs admin permissions, temporary passwords, change/reset password, disabling, expiry, the 5-attempt lockout, sign out |
| `test_predict.py` | The prediction endpoint: three models, each applying its own High cutoff; the corridor changes the estimate; bad input rejected |
| `test_model_parity.py` | *(optional)* The deployed models score exactly what `priority_metadata.yaml` reports on the 2025 test year (35,504 crashes), and the API gives the same answer as the training pipeline |

## One-time setup: a separate test database

The tests delete incidents and staff accounts, so they **refuse to run on your real database**. They need their own copy, and its name must contain `test`. In pgAdmin (as `postgres`):

1. Create the database (run on its own):
   ```sql
   CREATE DATABASE qc_road_safety_test;
   ```
2. Connected to `qc_road_safety_test`, run:
   ```sql
   GRANT ALL ON SCHEMA public TO csrp2_app;
   ```
3. Still connected to `qc_road_safety_test`, run `db/01_create_tables.sql` to `db/05_auth.sql`, in order.

Then install the test packages (backend folder, venv active):

```powershell
pip install -r requirements-dev.txt
```

## Running

```powershell
cd backend
.\venv\Scripts\Activate.ps1
$env:TEST_DATABASE_URL = "postgresql+psycopg2://csrp2_app:YOUR-PASSWORD@localhost:5432/qc_road_safety_test"
pytest -s
```

`-s` prints a PASS/FAIL line for every check. The tests create their own admin account in the test database (`test-admin@example.com`); your real accounts are never touched.

To include the model check, also install `requirements-train.txt` and point it at the raw Excel files (it takes about a minute):

```powershell
$env:RAW_DATA_DIR = "C:\path\to\folder\with\RAW_Data_QC_20XX.xlsx"
pytest -s
```

Without `RAW_DATA_DIR` that one test is skipped.
