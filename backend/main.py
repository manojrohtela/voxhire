from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.config import settings

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
    return {"status": "ok", "service": "ai-voice-platform"}
