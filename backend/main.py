from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.database import engine

app = FastAPI(
    title="VoxHire API",
    description="AI voice interview platform",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    # Covers localhost:*, *.localhost:*, and the configured FRONTEND_URL
    allow_origin_regex=r"http://(.*\.)?localhost:\d+",
    allow_origins=[settings.FRONTEND_URL] if settings.FRONTEND_URL else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
def health_check():
    """Liveness — process is up. Cheap; safe for frequent polling."""
    return {"status": "ok", "service": "voxhire"}


@app.get("/ready")
async def readiness_check():
    """Readiness — verifies the DB is reachable. Use this for uptime monitoring."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "db": "ok"}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail={"status": "not_ready", "db": str(e)[:160]})
