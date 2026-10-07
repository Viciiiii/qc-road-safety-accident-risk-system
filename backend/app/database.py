import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in your "
        "real PostgreSQL password."
    )

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# FastAPI dependency: opens one DB session per request, always closes it
# afterwards (even if the request raises an error).
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
