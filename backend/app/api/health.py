# app/api/health.py
from fastapi import APIRouter
from sqlalchemy import text
from app.core.database import SessionLocal
import redis

router = APIRouter()

@router.get("/health")
def health():
    return {"ok": True}

@router.get("/healthz")  # liveness
def healthz():
    return {"ok": True}

@router.get("/readyz")   # readiness: DB + Redis reachable
def readyz():
    # DB check
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    # Redis check
    r = redis.Redis(host="redis", port=6379, decode_responses=True)
    r.ping()
    return {"ready": True}
