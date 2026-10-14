import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import current_user
from .ml.predictor import get_predictor
from .routers import auth, incidents, predict, risk_areas, users

load_dotenv()  # so CORS_ORIGINS in .env is visible below, whatever the import order
logger = logging.getLogger("uvicorn.error")

DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def allowed_origins():
    """Browser origins allowed to call this API, from CORS_ORIGINS (comma-separated)."""
    raw = os.getenv("CORS_ORIGINS") or DEFAULT_ORIGINS  # blank counts as unset
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the models at startup so a missing/incompatible file shows up immediately,
    # instead of on the first prediction request. The rest of the API still starts.
    try:
        get_predictor()
        logger.info("Prediction models loaded.")
    except Exception as exc:
        logger.error("Could not load prediction models: %s", exc)
    yield


app = FastAPI(title="QC Road Safety API", lifespan=lifespan)

# Lets the frontend (by default the Vite dev server) call this API from the browser.
# To serve the frontend from somewhere else, add its address to CORS_ORIGINS in .env.
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Everything except signing in requires a signed-in account (admin-only routes check more).
signed_in = [Depends(current_user)]
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(risk_areas.router, dependencies=signed_in)
app.include_router(predict.router, dependencies=signed_in)
app.include_router(incidents.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "QC Road Safety API"}
