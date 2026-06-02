from fastapi import APIRouter
from app.api.v1.endpoints import resume

api_router = APIRouter()

api_router.include_router(resume.router, prefix="/resume", tags=["Resume Intelligence"])
