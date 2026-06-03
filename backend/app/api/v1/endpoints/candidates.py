"""
Candidates API endpoints.
GET    /api/v1/candidates          — List org candidates
POST   /api/v1/candidates          — Create candidate
GET    /api/v1/candidates/{id}     — Get candidate detail
PUT    /api/v1/candidates/{id}     — Update candidate
DELETE /api/v1/candidates/{id}     — Delete candidate
POST   /api/v1/candidates/{id}/skills — Save HR selected skills
"""

import uuid
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.db.models import (
    Candidate, CandidateSkill, InterviewSession,
    EvaluationRating, SkillCategory, SkillDifficulty
)
from app.modules.auth.dependencies import get_current_user

router = APIRouter()


# ─── Pydantic schemas ──────────────────────────────────────────

class CandidateCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    applied_role: Optional[str] = None
    summary: Optional[str] = None
    total_experience_years: Optional[float] = None
    parsed_profile: Optional[dict] = None
    resume_text: Optional[str] = None

class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    applied_role: Optional[str] = None
    overall_rating: Optional[EvaluationRating] = None
    summary: Optional[str] = None
    total_experience_years: Optional[float] = None

class SkillInput(BaseModel):
    skill: str
    category: SkillCategory = SkillCategory.PRIMARY
    difficulty: SkillDifficulty = SkillDifficulty.MEDIUM
    weight_percent: int = 0
    interview_areas: Optional[list[str]] = None

class SaveSkillsRequest(BaseModel):
    skills: list[SkillInput]


# ─── Helpers ───────────────────────────────────────────────────

def candidate_to_dict(c: Candidate) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "email": c.email,
        "phone": c.phone,
        "location": c.location,
        "linkedin": c.linkedin,
        "github": c.github,
        "applied_role": c.applied_role,
        "summary": c.summary,
        "total_experience_years": c.total_experience_years,
        "overall_rating": c.overall_rating,
        "parsed_profile": c.parsed_profile,
        "resume_url": c.resume_url,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


# ─── Endpoints ─────────────────────────────────────────────────

@router.get("")
async def list_candidates(
    search: Optional[str] = None,
    rating: Optional[EvaluationRating] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all candidates in the org with optional search + filter."""
    query = select(Candidate).where(Candidate.org_id == current_user["org_id"])

    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(
            (func.lower(Candidate.name).like(search_term)) |
            (func.lower(Candidate.email).like(search_term)) |
            (func.lower(Candidate.applied_role).like(search_term))
        )

    if rating:
        query = query.where(Candidate.overall_rating == rating)

    query = query.order_by(Candidate.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    candidates = result.scalars().all()

    # Count total
    count_query = select(func.count(Candidate.id)).where(Candidate.org_id == current_user["org_id"])
    total = (await db.execute(count_query)).scalar()

    return {
        "candidates": [candidate_to_dict(c) for c in candidates],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", status_code=201)
async def create_candidate(
    body: CandidateCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new candidate."""
    candidate = Candidate(
        id=str(uuid.uuid4()),
        org_id=current_user["org_id"],
        created_by=current_user["id"],
        **body.model_dump(),
    )
    db.add(candidate)
    await db.flush()
    return candidate_to_dict(candidate)


@router.get("/{candidate_id}")
async def get_candidate(
    candidate_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get candidate with skills and interview sessions."""
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user["org_id"]
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(404, detail="Candidate not found")

    # Skills
    skills_result = await db.execute(
        select(CandidateSkill).where(CandidateSkill.candidate_id == candidate_id)
    )
    skills = skills_result.scalars().all()

    # Interview sessions (summary)
    sessions_result = await db.execute(
        select(InterviewSession).where(InterviewSession.candidate_id == candidate_id)
        .order_by(InterviewSession.created_at.desc())
    )
    sessions = sessions_result.scalars().all()

    data = candidate_to_dict(candidate)
    data["skills"] = [
        {
            "id": s.id,
            "skill": s.skill,
            "category": s.category,
            "difficulty": s.difficulty,
            "weight_percent": s.weight_percent,
            "interview_areas": s.interview_areas,
        }
        for s in skills
    ]
    data["interview_sessions"] = [
        {
            "id": s.id,
            "status": s.status,
            "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
            "overall_rating": s.overall_rating,
            "interview_link": s.interview_link,
        }
        for s in sessions
    ]
    return data


@router.put("/{candidate_id}")
async def update_candidate(
    candidate_id: str,
    body: CandidateUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update candidate fields."""
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user["org_id"]
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(404, detail="Candidate not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(candidate, field, value)

    await db.flush()
    return candidate_to_dict(candidate)


@router.delete("/{candidate_id}", status_code=204)
async def delete_candidate(
    candidate_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a candidate."""
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user["org_id"]
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(404, detail="Candidate not found")

    await db.delete(candidate)


@router.post("/{candidate_id}/skills")
async def save_candidate_skills(
    candidate_id: str,
    body: SaveSkillsRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save HR-selected skills for interview. Replaces existing skills."""
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user["org_id"]
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, detail="Candidate not found")

    # Delete existing skills
    existing = await db.execute(
        select(CandidateSkill).where(CandidateSkill.candidate_id == candidate_id)
    )
    for skill in existing.scalars().all():
        await db.delete(skill)

    # Insert new skills
    new_skills = []
    for s in body.skills:
        skill = CandidateSkill(
            id=str(uuid.uuid4()),
            candidate_id=candidate_id,
            skill=s.skill,
            category=s.category,
            difficulty=s.difficulty,
            weight_percent=s.weight_percent,
            interview_areas=s.interview_areas,
        )
        db.add(skill)
        new_skills.append(skill)

    await db.flush()
    return {"message": f"{len(new_skills)} skills saved", "skills": [s.skill for s in new_skills]}
