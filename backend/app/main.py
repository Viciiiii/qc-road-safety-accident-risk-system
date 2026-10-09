import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .ml.predictor import get_predictor
from .routers import predict, risk_areas

logger = logging.getLogger("uvicorn.error")


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

# Allows the Vite dev server (localhost:5173) to call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(risk_areas.router)
app.include_router(predict.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "QC Road Safety API"}
