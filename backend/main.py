from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.ratelimit import limiter
from app.db.database import engine
from agenthive_guard import AgentHiveGuard

# Error monitoring — only active when SENTRY_DSN is set.
if settings.SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        environment=settings.APP_ENV,
        send_default_pii=False,
    )

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

# Groq metering. VoxHire has its own accounts, so the guard trusts the VoxHire
# token (VOXHIRE_JWT_SECRET) and meters per ORGANIZATION — recruiters are not
# asked to sign up a second time.
#
# Only the heavy, user-initiated LLM routes are metered. Deliberately EXCLUDED:
# /interviews/vapi-webhook — it carries no user token, so gating it would meter
# it as an anonymous device and silently break every interview evaluation.
app.add_middleware(
    AgentHiveGuard,
    agent="voxhire",
    protect=["/resume/parse", "/candidates/bulk-parse", "/match-jobs"],
)

# Rate limiting (generous global default; tighter per-endpoint via @limiter.limit)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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
