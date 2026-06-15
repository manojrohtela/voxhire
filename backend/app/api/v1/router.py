from fastapi import APIRouter
from app.api.v1.endpoints import resume, auth, candidates, interviews, admin, jobs, screening, voice_ws, interview_vapi, billing, audit, demo, analytics

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(billing.router, prefix="/billing", tags=["Billing"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])
api_router.include_router(demo.router, prefix="/demo", tags=["Demo"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(candidates.router, prefix="/candidates", tags=["Candidates"])
api_router.include_router(interviews.router, prefix="/interviews", tags=["Interviews"])
api_router.include_router(interview_vapi.router, prefix="/interviews", tags=["Interviews - Vapi"])
api_router.include_router(resume.router, prefix="/resume", tags=["Resume Intelligence"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Job Descriptions"])
api_router.include_router(screening.router, prefix="/screening", tags=["Screening"])
api_router.include_router(voice_ws.router, tags=["Voice Runtime"])
