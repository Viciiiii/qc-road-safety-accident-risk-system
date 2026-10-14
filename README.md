# QC Road Safety — Accident Risk System

A web app that shows Quezon City LGU staff which road corridors to prioritize next month, and gives an instant priority estimate for newly reported crashes. It is the working prototype for the thesis **"A Comparative Analysis of Random Forest, Support Vector Machine, and Naïve Bayes in Predicting Priority Levels of Road Accident Incidents for LGU Resource Allocation in Quezon City."**

> **This is a prototype, not a system for live emergency response.** Read [Limitations](#limitations) before relying on any number it shows.

## What it does

| Page | What it's for |
|---|---|
| **Dashboard** | Which corridors are High, Medium and Low priority for next month, and the corridors with the highest severity scores |
| **Risk Areas** | All 29 monitored corridors ranked, with search, priority filter and sorting |
| **Map** | The corridors on a map, coloured by priority level |
| **Report Incident** | Staff log a crash; Random Forest, SVM and Naive Bayes each predict its priority level |
| **Records** | Incidents staff have logged (stored in PostgreSQL). An admin records the real outcome, which then counts toward the corridor ranking, and exports confirmed incidents as CSV for retraining. Each confirmed incident shows whether the estimate was correct, underestimated or overestimated |
| **Analytics** | Accuracy, precision, recall and feature importance of the three models on the test set, plus their live results on incidents logged in the app |
| **Accounts** *(admin only)* | Create staff accounts (with a one-time temporary password), reset passwords, disable access, see last sign-in |
| **Settings** | Dark mode, English/Tagalog (navigation and headings only), model status, change your password |

A corridor's **priority level** comes from its **severity score** over the 12 most recent months of MMDA data: each crash counts 1 point if it only damaged property, 3 if someone was injured, and 10 if someone died. The top 10 corridors are High priority, the next 10 Medium, and the remaining 9 Low. Crashes that staff log and an admin confirms are added to the score straight away, including ones dated after the MMDA data ends (they're the newest information available); unconfirmed ones are not. The logic is in `backend/app/ranking.py`.

## How "priority" is defined

The MMDA data has no priority column, so priority is taken from the recorded outcome of each crash:

| MMDA `Classification` | Priority |
|---|---|
| Fatal | **High** |
| Non Fatal Injury | **Medium** |
| Damage to Property | **Low** |

This is a proxy: it measures how bad the outcome turned out to be, not a case-by-case urgency assessment. The data is MMDA road crash records for Quezon City, 2022–2025 (128,827 records: 75.2% Low, 24.4% Medium, 0.36% High). The raw data is not included in this repository.

## Model results

Measured once on a held-out test set of real data (25,723 crashes, 92 of them fatal). Each model flags High when its High score reaches a cutoff chosen by cross-validation on the training data; otherwise the larger of Medium and Low wins.

| Model | Accuracy | Precision on High | Recall on High | Flagged High | Fatal caught |
|---|---|---|---|---|---|
| Random Forest | 84.4% | 15.8% | 45.7% | 265 | 42 of 92 |
| SVM (linear) | 77.7% | 4.3% | 83.7% | 1,786 | 77 of 92 |
| Naive Bayes | 72.1% | 2.1% | 91.3% | 3,922 | 84 of 92 |

No model wins on every measure. SVM and Naive Bayes catch more fatal crashes but raise far more false alarms; Random Forest is the most balanced. Only 0.36% of crashes are fatal, so Random Forest's 15.8% precision is about 44 times better than chance. The models use time, weather, collision type, accident factor and vehicles. They do **not** use location.

### Improving precision

The first version of the models (21 raw features, full SMOTE, highest score wins) scored, on the same test set:

| Model | Precision on High | Recall on High | Flagged High |
|---|---|---|---|
| Random Forest | 12.8% → **15.8%** | 40.2% → **45.7%** | 288 → 265 |
| SVM (linear) | 2.2% → **4.3%** | 77.2% → **83.7%** | 3,179 → 1,786 |
| Naive Bayes | 0.7% → **2.1%** | 87.0% → **91.3%** | 11,938 → 3,922 |

What was tried, in order:

1. **A cutoff on its own** (no retraining), chosen by 5-fold cross-validation on the training set. It gave no real gain: for Random Forest the recall-preserving cutoff (0.395) scored 11.2% / 41.3% on the test set, about the same as before.
2. **Feature engineering, imbalance handling and tuning**, each option scored by 3-fold cross-validation on the training set (average precision for High). Kept:
   - New features, all known when a crash is reported: night, late night, rush hour, weekday, weekend, total vehicles, two-wheelers, motorcycle involved, bus or truck involved, motorcycle *and* bus/truck, single vehicle, and yes/no flags cleaned from the 905 messy Collision Type values and 56 Accident Factor values (hit pedestrian, head-on, self accident, drunk driving, …). District was dropped: it has one value.
   - All vehicle columns as plain numbers. The notebook label-encoded Motorcycle and Fx / Taxi as text, so "1" and "1.0" got different codes, and "1" only appears in the 2023 file, so the code quietly carried the year.
   - Random Forest: gentler SMOTE (High raised to 10% of the Low count). SVM: standardised features and balanced class weights instead of SMOTE, C = 0.01. Naive Bayes: unchanged SMOTE.
   - A High cutoff per model, chosen by cross-validation so each model catches at least as many fatal crashes as its first version did.

A bootstrap on the test set puts Random Forest's precision gain at +3.0 points (95% interval +0.1 to +6.0). With only 92 fatal crashes the exact size is uncertain; the SVM and Naive Bayes gains are clear. Precision is still low in absolute terms because the records lack speed, helmet or seatbelt use, victim age and response time.

To retrain: `pip install -r requirements-train.txt`, then `python scripts/train_models.py <folder with the raw Excel files>`. It rebuilds all three models, the cutoffs (`priority_model_config.json`) and `priority_metadata.yaml`, and reproduces the numbers above exactly.

### Corridor ranking: tested on 2025

To check whether past crashes predict next month's priority corridors, each month of 2025 was predicted from the 12 months before it (trained on 2022–2024, tested on 2025: 29 corridors × 12 months).

| Method | Accuracy | Precision on High | Recall on High |
|---|---|---|---|
| **12-month severity ranking (used in the app)** | **82.2%** | **91.7%** | **91.7%** |
| Same priority as last month | 77.0% | 91.7% | 91.7% |
| Naive Bayes | 77.9% | 92.2% | 89.2% |
| SVM (linear, scaled) | 76.4% | 81.4% | 98.3% |
| Random Forest | 75.0% | 88.5% | 95.8% |

Corridor risk in Quezon City is very stable: a corridor kept the same priority level from one month to the next about 77% of the time. None of the three models beat the simple 12-month ranking, and their differences from "same as last month" were within the margin of error (about ±5 points), so the app uses the ranking. "Precision on High" here means: of the corridors ranked High, how many really were among the 10 worst the next month.

### Live results in the app

When a crash is logged, all three models' estimates are saved. Once an admin confirms the real outcome, **Records** marks the Random Forest estimate as correct, underestimated (less serious than it turned out, the costlier mistake) or overestimated, and **Analytics** shows the same comparison for all three models. With only a handful of confirmed incidents these figures say little; the test-set results above remain the evaluation.

## Architecture

```
Browser (React)  ──HTTP/JSON──▶  FastAPI  ──▶  PostgreSQL   (corridors, monthly crash counts, incidents)
                                    └───────▶  scikit-learn models (RF, SVM, Naive Bayes)
```

**Stack:** React 19, Vite, Tailwind CSS 4, React Router, Leaflet · FastAPI, SQLAlchemy, PostgreSQL · scikit-learn 1.6.1

Logged incidents and accounts are stored in PostgreSQL, so every computer sees the same data. Only theme and language preferences are kept in the browser.

```
backend/
  app/
    main.py              FastAPI app, CORS, model loading at startup, sign-in required on all routes
    auth.py              Password hashing, sessions, permission checks
    database.py          PostgreSQL connection
    models.py            Table definitions (users, user_sessions, incidents, risk_areas, corridor_monthly)
    schemas.py           API request/response shapes
    ranking.py           The 12-month severity ranking
    routers/
      auth.py            POST /api/auth/login  /logout  /change-password   GET /api/auth/me
      users.py           Admin only: GET/POST /api/users  POST /api/users/{id}/reset-password  PATCH /api/users/{id}
      risk_areas.py      GET  /api/risk-areas            (the corridor ranking)
      incidents.py       GET/POST /api/incidents   POST /api/incidents/{id}/confirm   POST /api/incidents/export
      predict.py         GET  /api/form-options    POST /api/predict-incident
    ml/features.py       Feature engineering, shared by training and the API
    ml/predictor.py      Loads the models and cutoffs, runs predictions
  models/                Trained models, cutoffs (priority_model_config.json), encoders, form options
  db/                    SQL scripts: create tables, seed corridors, monthly crash counts, model estimates
  scripts/               train_models.py, create_admin.py, build_form_options.py, build_corridor_monthly.py
  tests/                 Backend tests (pytest)
  requirements.txt       (requirements-train.txt adds retraining, requirements-dev.txt adds testing)
  .env.example
frontend/
  src/
    pages/               Dashboard, RiskAreas, MapView, ReportIncident, Records,
                         Analytics, Accounts, Settings, Login
    components/          layout (sidebar, shell) and ui (card, badge, ranking note)
    api/                 API client and data hooks
    auth/ incidents/ theme/ i18n/    App-wide state
    data/modelResults.js The models' real test-set results shown on Analytics and Report Incident
  tests/                 End-to-end (vitest) and browser (Playwright) tests
  .env.example
```

## Getting started

**You need:** Node.js 20.19+ (or 22.12+) · Python 3.11+ · PostgreSQL (developed on 18) with `psql` or pgAdmin.

### 1. Database

Run these once. In pgAdmin, use the Query Tool; with `psql`, run them as the `postgres` user. Pick your own password and use the same one in step 2.

```bash
psql -U postgres -c "CREATE DATABASE qc_road_safety;"
psql -U postgres -c "CREATE USER csrp2_app WITH PASSWORD 'choose-a-password';"
psql -U postgres -d qc_road_safety -c "GRANT ALL ON SCHEMA public TO csrp2_app;"
psql -U postgres -d qc_road_safety -f backend/db/01_create_tables.sql
psql -U postgres -d qc_road_safety -f backend/db/02_seed_risk_areas.sql
psql -U postgres -d qc_road_safety -f backend/db/03_corridor_monthly.sql
psql -U postgres -d qc_road_safety -f backend/db/04_model_estimates.sql
psql -U postgres -d qc_road_safety -f backend/db/05_auth.sql
```

In pgAdmin, run the first two statements separately (`CREATE DATABASE` can't share a batch with other statements), then run the rest **connected to `qc_road_safety`**. The scripts are safe to run again.

**Already set up an earlier version?** Run only the scripts you haven't run yet, in order: `03_corridor_monthly.sql` (monthly crash table), `04_model_estimates.sql` (saves all three models' estimates), `05_auth.sql` (sign-in). They leave your existing data alone.

### 2. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env               # macOS/Linux: cp .env.example .env
```

Open `.env` and replace `your-password-here` with your database password, then start the server:

```powershell
uvicorn app.main:app --reload --port 8000
```

Wait for **"Prediction models loaded."** in the log (it takes a few seconds). The interactive docs are at `http://localhost:8000/docs`. Every route except sign-in answers 401 until you're signed in.

Create the first admin account (once). It asks for a name, email and password; the password is typed hidden:

```powershell
python scripts/create_admin.py
```

Run it again with the same email to reset a forgotten admin password.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### 4. Sign in

Sign in with the admin account you just created, then add staff on **Accounts**.

- **Emails** work in any letter case; **passwords** must match exactly.
- **New staff:** the admin enters a name and email; the system generates a temporary password, shown once. The staff member signs in with it and sees a reminder on every page until they choose their own in **Settings**. A forgotten password works the same way: the admin clicks **Reset password**.
- **Staying signed in:** 8 hours, or until the browser closes. Tick **Remember me** for 30 days. Signing out, a password change or reset, or disabling the account ends sessions straight away (a password change keeps only the current browser signed in).
- **Wrong passwords:** after 5 wrong attempts, that email is locked for 15 minutes.
- **What staff can't do:** open Accounts, confirm outcomes or export for retraining. The API enforces this, not just the menus.

Passwords are stored as bcrypt hashes. The session is an httpOnly cookie that page scripts can't read, and the database keeps only a hash of it.

## Configuration

| Setting | Where | Default | What it does |
|---|---|---|---|
| `DATABASE_URL` | `backend/.env` | *(required)* | PostgreSQL connection. Keep the `postgresql+psycopg2://` prefix |
| `CORS_ORIGINS` | `backend/.env` | `http://localhost:5173,http://127.0.0.1:5173` | Browser addresses allowed to call the API (comma-separated, no trailing slash) |
| `COOKIE_SECURE` | `backend/.env` | `false` | Set to `true` when the site is served over HTTPS |
| `VITE_API_URL` | `frontend/.env.local` | port 8000 on the page's host name | Where the frontend finds the API |

To open the app from another device on your network, use the computer's IP address for both (for example `http://192.168.1.20:5173`), add that address to `CORS_ORIGINS`, and restart the backend. The sign-in cookie only works when the frontend and API share a host name, so `localhost:5173` pairs with `localhost:8000`. To host it online, serve both over HTTPS under one site, set `COOKIE_SECURE=true`, set `VITE_API_URL` and `CORS_ORIGINS`, and rebuild (`npm run build`; Vite bakes `VITE_` values in at build time).

## Updating the data and retraining

### Logged incidents

1. Staff log a crash on **Report Incident**. It appears in **Records** as *Pending review*, with the models' estimate. It doesn't affect anything else yet.
2. When the real outcome is known, an admin picks Fatal / Non Fatal Injury / Damage to Property in **Records** and confirms it (*Confirmed*). From then on it counts toward its corridor's severity score right away (unless it's dated before the ranking's 12-month window).
3. The admin clicks **Export for retraining**. The CSV uses the same column names as the MMDA data, and the rows become *Included in training*.
4. Append those rows to the historical dataset and run `python scripts/train_models.py <folder with the raw Excel files>` (see *Improving precision*). It writes the models, cutoffs and metadata into `backend/models/`. Then run `python scripts/build_form_options.py <same folder>`, update the numbers in `frontend/src/data/modelResults.js` from `priority_metadata.yaml`, and restart the API. Keep scikit-learn at the version you trained with and update `requirements.txt` to match.

The models' own estimate is never used as a training label; only confirmed outcomes are, so the models don't learn from their own guesses.

### New MMDA data

The ranking always uses the 12 most recent months in `corridor_monthly`, which currently ends in December 2025. When newer MMDA files arrive, save them as `RAW_Data_QC_<year>.xlsx` and run:

```powershell
python scripts/build_corridor_monthly.py "C:\path\to\folder\with\the\xlsx\files"
```

Then run the regenerated `db/03_corridor_monthly.sql` in pgAdmin. New months are added, and the ranking moves forward automatically. Confirmed incidents keep counting as long as they fall inside the new 12-month window.

## Tests

The tests run against a **separate test database**, so your real data is never touched. Setup and commands are in [`backend/tests/README.md`](backend/tests/README.md) and [`frontend/tests/README.md`](frontend/tests/README.md).

| Suite | Command | Covers |
|---|---|---|
| Backend | `pytest -s` (in `backend`) | Ranking recounted with SQL, the incident flow, sign-in and permissions, predictions and cutoffs; optionally that the models reproduce the reported test-set results exactly and that the API matches the training pipeline |
| Frontend | `npm run test:e2e` (in `frontend`) | The real pages against the real API, end to end |
| Browser | `npm run test:browser` (in `frontend`) | Sign-in and account management clicked through in Chromium |

## Limitations

- **Sign-in is prototype-grade.** Passwords are hashed and sessions are server-side, but there is no email-based password reset (an admin resets it), no two-factor sign-in, and the wrong-password lockout is kept in memory, so it resets when the API restarts. Run it over HTTPS (`COOKIE_SECURE=true`) before putting it on the internet.
- **The models ignore location.** Choosing a different street doesn't change a prediction; the street is only saved with the record.
- **"High" is a weak alert.** Precision on High is low (table above), so most High flags are false alarms. The percentages shown are model scores, not real-world probabilities; that's why each model has its own High cutoff (Random Forest flags High from 18.4%).
- **Old records keep old estimates.** Incidents logged before the model update show the estimate the first models gave at the time.
- **The ranking looks back, not ahead.** It assumes the worst corridors of the last 12 months stay the worst next month. That held about 9 in 10 times in 2025, but it can't anticipate a sudden change on a corridor. It was tested on one year only.
- **The 1 / 3 / 10 crash weights are a judgment call,** not derived from data. Different weights could reorder corridors near the tier boundaries.
- **The data currently ends in December 2025,** so the ranking is a forecast for January 2026 until newer MMDA data is loaded.
- **A confirmed incident could be counted twice** if the same crash later appears in a newer MMDA file.
- **Map positions are approximate,** placed by hand along each road. Only the 29 busiest corridors are ranked (about 74% of crashes); crashes with an unknown street are left out.
- **The priority label is a proxy** for outcome severity (see above). The data can't separate minor from serious injuries.
- **Scope:** per the thesis, this is a prototype and is not intended for deployment in live emergency response.

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'psycopg'` | `DATABASE_URL` must start with `postgresql+psycopg2://`, not `postgresql://` |
| `Could not import module "main"` | Run `uvicorn app.main:app …` from the `backend` folder |
| `Not Found` at `/risk-areas` | The path is `/api/risk-areas` |
| `No monthly corridor data. Run backend/db/03_corridor_monthly.sql` | Run that script in pgAdmin, connected to `qc_road_safety` |
| `relation "corridor_monthly" does not exist` | Run `backend/db/03_corridor_monthly.sql` in pgAdmin, connected to `qc_road_safety` |
| `column incidents.svm_priority does not exist` | Run `backend/db/04_model_estimates.sql` in pgAdmin, connected to `qc_road_safety` |
| Page says "Couldn't load data from the server" | Backend isn't running, `VITE_API_URL` is wrong, or the page's address isn't in `CORS_ORIGINS` |
| Warnings or errors loading the models | Install the pinned version: `pip install -r requirements.txt` (scikit-learn 1.6.1) |
| `permission denied for schema public` | Run `GRANT ALL ON SCHEMA public TO csrp2_app;` while connected to `qc_road_safety` |
| PowerShell says scripts are disabled | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once |
| Signed out right after signing in, or every page says "Please sign in" | Open the app and API on the same host name: `localhost:5173` with `localhost:8000`, not `127.0.0.1` with `localhost`. If you set `VITE_API_URL`, it must use the same host name too |
| `relation "user_sessions" does not exist` or `column users.must_change_password does not exist` | Run `backend/db/05_auth.sql` in pgAdmin, connected to `qc_road_safety` |
| Forgot the admin password | From `backend`, run `python scripts/create_admin.py` with the same email to set a new one |
| `venv` or `.env` disappeared after unzipping files | Unzipping over a folder can replace it. Recreate the venv, `copy .env.example .env`, and re-enter your password |
