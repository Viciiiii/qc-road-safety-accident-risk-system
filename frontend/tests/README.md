# Frontend tests

| Command | What it does |
|---|---|
| `npm run test:e2e` | Renders the real pages (Dashboard, Risk Areas, Report Incident, Records, Analytics) against the real API: the live ranking, the trend arrows, the full log → confirm → ranking → export loop, estimate vs outcome counts, the icons, the model-update card, and what happens when the backend is down |
| `npm run test:browser` | Clicks through sign-in and account management in a real Chromium browser: wrong password, sign in, Remember me, creating a staff account, the temporary-password reminder, changing the password, disabling, resetting, signing out. Saves screenshots to `tests/screenshots/` |

Both run against the **test database**, never your real one: they log incidents, create staff accounts, and `test:e2e` empties the incidents table before its checks.

## Before running

1. Set up the test database and run the backend tests once (see `backend/tests/README.md`). That creates the test admin these tests sign in with (`test-admin@example.com` / `TestAdmin1`).
2. Start the backend **on the test database** (terminal 1, backend folder, venv active):
   ```powershell
   $env:DATABASE_URL = "postgresql+psycopg2://csrp2_app:YOUR-PASSWORD@localhost:5432/qc_road_safety_test"
   uvicorn app.main:app --port 8000
   ```
3. For `test:browser` only: start the frontend (terminal 2, `npm run dev`), and download the test browser once:
   ```powershell
   npx playwright install chromium
   ```

## Running (terminal 3, frontend folder)

```powershell
npm install
$env:TEST_DATABASE_URL = "postgresql+psycopg2://csrp2_app:YOUR-PASSWORD@localhost:5432/qc_road_safety_test"
npm run test:e2e
npm run test:browser
```

Optional settings: `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` (another admin in the test database), `TEST_API_URL` (default `http://localhost:8000`), `TEST_APP_URL` (default `http://localhost:5173`).

When you're done, close the test backend and start your normal one again (without `DATABASE_URL` set, it uses `.env`).
