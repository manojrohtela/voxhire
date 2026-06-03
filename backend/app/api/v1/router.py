from fastapi import APIRouter
from app.api.v1.endpoints import resume, auth, candidates, interviews

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(candidates.router, prefix="/candidates", tags=["Candidates"])
api_router.include_router(interviews.router, prefix="/interviews", tags=["Interviews"])
api_router.include_router(resume.router, prefix="/resume", tags=["Resume Intelligence"])
