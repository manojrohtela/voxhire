from fastapi import APIRouter
from app.api.v1.endpoints import resume, auth

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(resume.router, prefix="/resume", tags=["Resume Intelligence"])
