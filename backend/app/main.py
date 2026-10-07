from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import risk_areas

app = FastAPI(title="QC Road Safety API")

# Allows the Vite dev server (localhost:5173) to call this API from the browser.
# Browsers block cross-origin requests by default unless the server explicitly
# allows them - without this, every fetch() from React would fail silently.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(risk_areas.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "QC Road Safety API"}
