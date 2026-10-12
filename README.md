# QC Road Safety — Accident Risk System

A web app that shows Quezon City LGU staff which roads carry the most accident risk, and gives an instant priority estimate for newly reported crashes. It is the working prototype for the thesis **"A Comparative Analysis of Random Forest, Support Vector Machine, and Naïve Bayes in Predicting Priority Levels of Road Accident Incidents for LGU Resource Allocation in Quezon City."**

> **This is a prototype, not a system for live emergency response.** Read [Limitations](#limitations) before relying on any number it shows.

## What it does

| Page | What it's for |
|---|---|
| **Dashboard** | Corridors by risk level, busiest corridors, and the highest-rate corridors at a glance |
| **Risk Areas** | All 29 monitored corridors with search, risk-level filter, and sorting |
| **Map** | The corridors on a map, coloured by risk level |
| **Report Incident** | Staff log a crash; Random Forest, SVM and Naive Bayes each predict its priority level |
| **Records** | Incidents staff have logged. An admin records the real outcome, then exports confirmed incidents as CSV for retraining |
| **Analytics** | Accuracy, precision, recall and feature importance of the three models |
| **Accounts** *(admin only)* | Create staff accounts, reset passwords, disable access |
| **Settings** | Dark mode, English/Tagalog (navigation and headings only), model status |

A corridor's **risk level** is a ranking (top, middle or bottom third) of its historical High-priority rate across the 29 corridors. It describes 2022–2025, not the future.

## How "priority" is defined

The MMDA data has no priority column, so priority is taken from the recorded outcome of each crash:

| MMDA `Classification` | Priority |
|---|---|
| Fatal | **High** |
| Non Fatal Injury | **Medium** |
| Damage to Property | **Low** |

This is a proxy: it measures how bad the outcome turned out to be, not a case-by-case urgency assessment. The data is MMDA road crash records for Quezon City, 2022–2025 (128,827 records: 75.2% Low, 24.4% Medium, 0.36% High). The raw data is not included in this repository.

## Model results

Measured on a held-out test set of real data. The models were trained on SMOTE-resampled data because High is so rare.

| Model | Accuracy | Precision on High | Recall on High |
|---|---|---|---|
| Random Forest | 81.6% | 12.8% | 40.2% |
| SVM (linear) | 69.9% | 2.2% | 77.2% |
| Naive Bayes | 47.0% | 0.7% | 87.0% |

No model wins outright. SVM and Naive Bayes catch more fatal crashes but raise far more false alarms; Random Forest is the most balanced. The models use time, weather, collision type, accident factor and vehicle counts. They do **not** use location.

## Architecture

```
Browser (React)  ──HTTP/JSON──▶  FastAPI  ──▶  PostgreSQL   (corridor risk data)
                                    └───────▶  scikit-learn models (RF, SVM, Naive Bayes)
```

**Stack:** React 19, Vite, Tailwind CSS 4, React Router, Leaflet · FastAPI, SQLAlchemy, PostgreSQL · scikit-learn 1.6.1

Accounts, login, logged incidents, and theme/language preferences are currently stored **in the browser** (`localStorage`), not in PostgreSQL. The `users` and `incidents` tables already exist for the planned move.

```
backend/
  app/
    main.py              FastAPI app, CORS, model loading at startup
    database.py          PostgreSQL connection
    models.py            Table definitions (users, incidents, risk_areas)
    schemas.py           API response shapes
    routers/
      risk_areas.py      GET  /api/risk-areas
      predict.py         GET  /api/form-options    POST /api/predict-incident
    ml/predictor.py      Loads the models and runs predictions
  models/                Trained models, encoders, and form dropdown options
  db/                    SQL scripts: create tables, seed corridors
  scripts/build_form_options.py
  requirements.txt
  .env.example
frontend/
  src/
    pages/               Dashboard, RiskAreas, MapView, ReportIncident, Records,
                         Analytics, Accounts, Settings, Login
    components/          layout (sidebar, shell) and ui (card, badge)
    api/                 API client and data hooks
    auth/ incidents/ theme/ i18n/    App-wide state
    data/mockData.js     Demo data still used by Analytics and the seed incidents
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
```

In pgAdmin, run the first two statements separately (`CREATE DATABASE` can't share a batch with other statements), then run the other three **connected to `qc_road_safety`**. Both scripts are safe to run again.

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

Wait for **"Prediction models loaded."** in the log (it takes a few seconds). Try `http://localhost:8000/api/risk-areas`, or the interactive docs at `http://localhost:8000/docs`.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### 4. Sign in

| Role | Email | Password |
|---|---|---|
| Admin | `admin@qc.gov.ph` | `Admin@123` |
| Staff | `staff@qc.gov.ph` | `Staff@123` |

These are **demo credentials** for the prototype login, which is not secure (see [Limitations](#limitations)). Never reuse these passwords anywhere real. Email and password are case-sensitive.

## Configuration

| Setting | Where | Default | What it does |
|---|---|---|---|
| `DATABASE_URL` | `backend/.env` | *(required)* | PostgreSQL connection. Keep the `postgresql+psycopg2://` prefix |
| `CORS_ORIGINS` | `backend/.env` | `http://localhost:5173,http://127.0.0.1:5173` | Browser addresses allowed to call the API (comma-separated, no trailing slash) |
| `VITE_API_URL` | `frontend/.env.local` | `http://localhost:8000` | Where the frontend finds the API |

To open the app from another device or host it online: set `VITE_API_URL` to the backend's public address, add the frontend's address to `CORS_ORIGINS`, and restart both (for a production build, run `npm run build` again — Vite bakes `VITE_` values in at build time).

## Retraining with new incidents

1. Staff log a crash on **Report Incident**. It appears in **Records** as *Pending review*, with the models' estimate.
2. When the real outcome is known, an admin picks Fatal / Non Fatal Injury / Damage to Property in **Records** and confirms it (*Confirmed*).
3. The admin clicks **Export for retraining**. The CSV uses the same column names as the MMDA data, and the rows become *Included in training*.
4. Append those rows to the historical dataset and retrain the three models. Copy the new `.pkl` files into `backend/models/`, run `python scripts/build_form_options.py <folder with the raw Excel files>`, and restart the API. Keep scikit-learn at the version you trained with and update `requirements.txt` to match.

The models' own estimate is never used as a training label; only confirmed outcomes are, so the models don't learn from their own guesses.

## Limitations

- **The login is not secure.** Accounts, passwords and the admin check live in the browser, and the demo passwords are public in this repository. Anyone can fake a session from the browser's developer tools. The API has no authentication either.
- **Accounts and logged incidents don't sync.** They are stored per browser, so something logged on one computer doesn't appear on another.
- **The models ignore location.** Choosing a different street doesn't change a prediction; the street is only saved with the record.
- **"High" is a weak alert.** Precision on High is low (table above), so most High flags are false alarms. Because of SMOTE, the percentages shown are model scores, not real-world probabilities.
- **Risk levels are historical rankings,** not forecasts.
- **Map positions are approximate,** placed by hand along each road. Crashes with an unknown street are left out of the corridor figures.
- **The priority label is a proxy** for outcome severity (see above). The data can't separate minor from serious injuries.
- **Scope:** per the thesis, this is a prototype and is not intended for deployment in live emergency response.

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'psycopg'` | `DATABASE_URL` must start with `postgresql+psycopg2://`, not `postgresql://` |
| `Could not import module "main"` | Run `uvicorn app.main:app …` from the `backend` folder |
| `Not Found` at `/risk-areas` | The path is `/api/risk-areas` |
| Page says "Couldn't load data from the server" | Backend isn't running, `VITE_API_URL` is wrong, or the page's address isn't in `CORS_ORIGINS` |
| Warnings or errors loading the models | Install the pinned version: `pip install -r requirements.txt` (scikit-learn 1.6.1) |
| `permission denied for schema public` | Run `GRANT ALL ON SCHEMA public TO csrp2_app;` while connected to `qc_road_safety` |
| PowerShell says scripts are disabled | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once |
| `venv` or `.env` disappeared after unzipping files | Unzipping over a folder can replace it. Recreate the venv, `copy .env.example .env`, and re-enter your password |
