# QC Road Safety — Accident Risk System

A web app that shows Quezon City LGU staff which road corridors to prioritize next month, and gives an instant priority estimate for newly reported crashes. It is the working prototype for the thesis **"A Comparative Analysis of Random Forest, Support Vector Machine, and Naïve Bayes in Predicting Priority Levels of Road Accident Incidents for LGU Resource Allocation in Quezon City."**

> **This is a prototype, not a system for live emergency response.** Read [Limitations](#limitations) before relying on any number it shows.

## What it does

| Page | What it's for |
|---|---|
| **Dashboard** | Which corridors are High, Medium and Low priority for next month, the corridors with the highest severity scores, and the corridors rising faster than the rest of the city |
| **Risk Areas** | All 29 monitored corridors ranked, with each one's trend (▲ Rising, → Steady, ▼ Falling), search, priority and trend filters, and sorting |
| **Map** | The corridors on a map, coloured by priority level, with each one's trend in its popup |
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

The thesis compares Random Forest, SVM and Naive Bayes, so all three get exactly the same treatment:

- **Split by year.** Trained on 2022–2023 (58,445 crashes), settings and cutoffs chosen on 2024, tested **once** on all 35,504 crashes from 2025 (106 fatal). This is how the app is used: models built on past years, applied to crashes that come later.
- **Same inputs** for all three (85 in total), all known when a crash is reported: hour, minute, day, vehicle counts, engineered flags (night, rush hour, two-wheelers, motorcycle and bus/truck, hit pedestrian, ...), Month / Weather / Collision Type / Accident Factor as one column per value, and **street history**: how often crashes on the street, and on that street at that hour, were fatal in 2022–2023 (smoothed toward the citywide rate for streets with few crashes; for training crashes it is computed out-of-fold, so a crash never sees its own outcome).
- **Same tuning effort.** Six settings per model; the one with the best High PR-AUC on 2024 is kept.
- **Same cutoff rule.** Each model flags High when its High score reaches the cutoff that maximises F2 on 2024 (recall weighted above precision); otherwise the larger of Medium and Low wins.

Results on 2025:

| Model | Accuracy | Precision on High | Recall on High | PR-AUC (High) | Flagged High | Fatal caught | Fatal called Low |
|---|---|---|---|---|---|---|---|
| **Random Forest** | **85.5%** | **26.5%** | 46.2% | **0.283** | 185 | 49 of 106 | 28 |
| SVM (linear) | 81.9% | 13.3% | **50.9%** | 0.124 | 406 | 54 of 106 | **12** |
| Naive Bayes | 80.5% | 5.8% | 17.0% | 0.039 | 310 | 18 of 106 | 27 |

- **Random Forest is the best overall.** About 1 in 4 of its High flags was a fatal crash, against 0.3% by chance (about 88 times better), and 80% were serious (fatal or injury).
- **SVM is the cautious one.** It is less precise but misses the fewest fatal crashes outright (12 called Low).
- **Naive Bayes is the weakest and least stable.** It scored well on 2024 but dropped on 2025; it assumes every input is independent, which crash data isn't.
- **Location helps, mostly for Random Forest.** Without the street history, Random Forest's precision falls from 26.5% to 17.0% and its PR-AUC from 0.283 to 0.207; SVM gains a little (0.116 → 0.124) and Naive Bayes doesn't benefit (0.044 → 0.039).
- On the 25,960 crashes on the 29 monitored corridors (what the app predicts), Random Forest scores 25.2% precision and 42.3% recall.

Random Forest's top inputs: two-wheelers involved, motorcycle involved, motorcycle count, car count and hit-pedestrian crashes. Every number is in `backend/models/priority_metadata.yaml`, including the tuning results for all 18 settings.

### Compared with the previous version

The previous models (48 inputs without location, settings tuned on a random 80/20 split, cutoffs set to keep recall high), retrained on 2022–2023 and tested on the same 2025 crashes:

| Model | Precision on High | Recall on High | Flagged High | PR-AUC (High) |
|---|---|---|---|---|
| Random Forest | 12.4% → **26.5%** | 58.5% → 46.2% | 498 → 185 | 0.221 → **0.283** |
| SVM (linear) | 2.9% → **13.3%** | 87.7% → 50.9% | 3,158 → 406 | 0.151 → 0.124 |
| Naive Bayes | 1.0% → **5.8%** | 84.0% → 17.0% | 8,805 → 310 | 0.041 → 0.039 |

Precision went up for all three because the new models raise far fewer false alarms; recall went down because the old cutoffs kept recall high whatever the cost. PR-AUC, which doesn't depend on a cutoff, shows Random Forest clearly improved, SVM slightly worse, Naive Bayes unchanged. (The previous version's own report, on a random 80/20 split, gave Random Forest 15.8% / 45.7%; a random split mixes the years and flatters the results, which is why the comparison now tests on a later year.)

Precision is still low in absolute terms because the records lack speed, helmet or seatbelt use, victim age and response time.

To retrain: `pip install -r requirements-train.txt`, then `python scripts/train_models.py <folder with the raw Excel files>`. It rebuilds all three models, the cutoffs and inputs (`priority_model_config.json`), the street history (`priority_street_history.json`) and `priority_metadata.yaml`, and reproduces the numbers above exactly.

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

### Corridor trends: rising faster than the city

Each corridor also gets a trend arrow. Its severity score for the last 6 months of MMDA data is compared with the 6 months before (now Jul–Dec 2025 vs Jan–Jun 2025), and that change is compared with the **citywide** change:

- **▲ Rising:** at least 15 points above the city's change (city +7% → the corridor is up 22% or more)
- **▼ Falling:** at least 15 points below it
- **→ Steady:** in between

Comparing with the city matters: November and December are busy everywhere, so comparing a corridor only with itself put 21 of 29 corridors on "rising" at the end of 2025. Confirmed incidents add their points to the period they fall in (anything newer than the MMDA data counts as recent), so a confirmed fatal crash can tip a quiet road to Rising, while a few minor ones barely move a busy road. Logs only ever add points, so they can't make a road look better.

Tested on 2022–2025 (every month, 29 corridors), measuring whether the corridor was still above or below the city's trend over the following 3 months:

| Arrow | Still true 3 months later | For comparison |
|---|---|---|
| ▲ Rising | 79% | Steady corridors: 50% (a coin flip) |
| ▼ Falling | 74% | |
| Both | 77% (2025 alone: 72%) | Arrows change month to month 25% of the time |

A Rising corridor usually *stays* elevated, but doesn't usually keep *climbing*: roads that spike tend to settle back somewhat. So "Rising" means "grew faster than the city lately", not "will get worse every month". Several of the corridors rising at the end of 2025 (IBP Road, Payatas Road, Timog Ave., Visayas Ave.) are only Medium priority, which is the point: the trend can flag roads the ranking alone wouldn't.

### Live results in the app

When a crash is logged, all three models' estimates are saved. Once an admin confirms the real outcome, **Records** marks the Random Forest estimate as correct, underestimated (less serious than it turned out, the costlier mistake) or overestimated, and **Analytics** shows the same comparison for all three models. With only a handful of confirmed incidents these figures say little; the 2025 test results above remain the evaluation.

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
    ml/predictor.py      Loads the models, cutoffs and street history, runs predictions
  models/                Trained models, inputs and cutoffs (priority_model_config.json), street history, form options
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
4. Append those rows to the historical dataset and run `python scripts/train_models.py <folder with the raw Excel files>` (see *Model results*). It writes the models, cutoffs, street history and metadata into `backend/models/`. If the new data adds a year, move the split in the script forward (for example train 2023–2024, choose on 2025, test on 2026). Then run `python scripts/build_form_options.py <same folder>`, update the numbers in `frontend/src/data/modelResults.js` from `priority_metadata.yaml`, and restart the API. Keep scikit-learn at the version you trained with and update `requirements.txt` to match.

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
| Backend | `pytest -s` (in `backend`) | Ranking and trends recounted with SQL, the incident flow, sign-in and permissions, predictions and cutoffs; optionally that the models reproduce the reported test-set results exactly and that the API matches the training pipeline |
| Frontend | `npm run test:e2e` (in `frontend`) | The real pages against the real API, end to end |
| Browser | `npm run test:browser` (in `frontend`) | Sign-in and account management clicked through in Chromium |

## Limitations

- **Sign-in is prototype-grade.** Passwords are hashed and sessions are server-side, but there is no email-based password reset (an admin resets it), no two-factor sign-in, and the wrong-password lockout is kept in memory, so it resets when the API restarts. Run it over HTTPS (`COOKIE_SECURE=true`) before putting it on the internet.
- **Location enters only as street history.** The models know how often crashes on a street were fatal in 2022–2023, not the road's design, speed limit or traffic volume. The history is fixed at training time and only updates when the models are retrained.
- **"High" is a weak alert.** Precision on High is low (table above), so most High flags are false alarms. The percentages shown are model scores, not real-world probabilities; that's why each model has its own High cutoff (Random Forest flags High from 20.0%). Naive Bayes is judged by its likelihood score rather than a percentage, because its probabilities round to 0% or 100%.
- **Old records keep old estimates.** Incidents logged before the model update show the estimate the first models gave at the time.
- **The ranking looks back, not ahead.** It assumes the worst corridors of the last 12 months stay the worst next month. That held about 9 in 10 times in 2025, but it can't anticipate a sudden change on a corridor. It was tested on one year only.
- **Trend arrows have a hard line.** A corridor just under the 15-point line can flip to Rising with one more confirmed incident, and a Rising arrow on a quiet road can rest on a handful of crashes. The tooltip and Map popup show the actual numbers behind each arrow.
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
