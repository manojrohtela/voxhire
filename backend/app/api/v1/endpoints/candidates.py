"""
Candidates API endpoints.
POST   /api/v1/candidates/parse-resume   — Upload resume → AI extract fields (no DB write)
POST   /api/v1/candidates/bulk-parse     — Upload multiple resumes → extract fields for all
GET    /api/v1/candidates                — List org candidates
POST   /api/v1/candidates                — Create candidate
GET    /api/v1/candidates/{id}           — Get candidate detail
PUT    /api/v1/candidates/{id}           — Update candidate
DELETE /api/v1/candidates/{id}           — Delete candidate
POST   /api/v1/candidates/{id}/skills    — Save HR selected skills
POST   /api/v1/candidates/{id}/match-jobs        — Run AI job matching, store CandidateJob rows
GET    /api/v1/candidates/{id}/jobs              — List candidate's job assignments
POST   /api/v1/candidates/{id}/jobs/{job_id}     — Assign candidate to job (or update status)
DELETE /api/v1/candidates/{id}/jobs/{job_id}     — Remove job assignment
"""

import io
import json
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.db.models import (
    Candidate, CandidateSkill, CandidateJob, CandidateJobStatus,
    InterviewSession, JobDescription,
    EvaluationRating, HiringDecision, SkillCategory, SkillDifficulty,
    ScreeningCall, ScreeningInvitation, ScreeningEvent,
    ScreeningEventType, ScreeningStatus, Organization,
)
from app.modules.auth.dependencies import get_current_user
from app.core.config import settings
from app.core.email import send_screening_invitation

router = APIRouter()


# ─── Pydantic schemas ──────────────────────────────────────────

class CandidateCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None
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
    overall_rating: Optional[HiringDecision] = None
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
        "screening_status": c.screening_status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


# ─── Endpoints ─────────────────────────────────────────────────

@router.get("")
async def list_candidates(
    search: Optional[str] = None,
    rating: Optional[HiringDecision] = None,
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

    # Count total (unfiltered)
    count_query = select(func.count(Candidate.id)).where(Candidate.org_id == current_user["org_id"])
    total = (await db.execute(count_query)).scalar()

    # Fetch job assignment counts — only recruiter-actioned statuses (not AI suggestions)
    candidate_ids = [c.id for c in candidates]
    job_counts: dict[str, int] = {}
    if candidate_ids:
        job_count_rows = (await db.execute(
            select(CandidateJob.candidate_id, func.count(CandidateJob.id).label("cnt"))
            .where(
                CandidateJob.candidate_id.in_(candidate_ids),
                CandidateJob.status != CandidateJobStatus.SUGGESTED,
            )
            .group_by(CandidateJob.candidate_id)
        )).all()
        job_counts = {row.candidate_id: row.cnt for row in job_count_rows}

    def _with_job_count(c: Candidate) -> dict:
        d = candidate_to_dict(c)
        d["job_count"] = job_counts.get(c.id, 0)
        return d

    return {
        "candidates": [_with_job_count(c) for c in candidates],
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
    """Create a new candidate. Returns 409 with existing candidate info if email/phone already exists in the org."""
    from sqlalchemy import or_

    # Duplicate check — email or phone already exists in this org
    filters = []
    if body.email:
        filters.append(func.lower(Candidate.email) == body.email.lower().strip())
    if body.phone:
        filters.append(Candidate.phone == body.phone.strip())

    if filters:
        dup_result = await db.execute(
            select(Candidate).where(
                Candidate.org_id == current_user["org_id"],
                or_(*filters),
            )
        )
        existing = dup_result.scalar_one_or_none()
        if existing:
            matched_field = "email" if (body.email and existing.email and existing.email.lower() == body.email.lower().strip()) else "phone"
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "DUPLICATE_CANDIDATE",
                    "message": f"A candidate with this {matched_field} already exists.",
                    "matched_field": matched_field,
                    "existing_candidate": {
                        "id": existing.id,
                        "name": existing.name,
                        "email": existing.email,
                        "phone": existing.phone,
                        "applied_role": existing.applied_role,
                        "created_at": existing.created_at.isoformat() if existing.created_at else None,
                    },
                },
            )

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


# ─── Resume parsing helpers ────────────────────────────────────

def _extract_text_from_file(filename: str, content: bytes) -> str:
    ext = (filename or "").lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        import fitz
        doc = fitz.open(stream=content, filetype="pdf")
        return "\n".join(page.get_text() for page in doc)
    if ext in ("docx",):
        from docx import Document
        doc = Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    # Fallback: try decode as plain text
    return content.decode("utf-8", errors="ignore")


def _parse_resume_with_groq(text: str) -> dict:
    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)
    prompt = f"""Extract candidate information from this resume. Return ONLY valid JSON, no markdown.

Resume:
{text[:6000]}

Return exactly this JSON (use empty string if not found, empty array for skills if none):
{{
  "first_name": "",
  "last_name": "",
  "email": "",
  "phone": "",
  "skills": [],
  "linkedin": "",
  "github": "",
  "portfolio": ""
}}"""
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=800,
    )
    raw = (resp.choices[0].message.content or "{}").strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


# ─── Resume parse endpoint (no DB write — returns extracted fields) ──

@router.post("/parse-resume")
async def parse_resume(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a resume PDF/DOCX, extract candidate fields using AI. Does NOT save to DB."""
    allowed = {"pdf", "docx", "doc"}
    ext = (file.filename or "").lower().rsplit(".", 1)[-1]
    if ext not in allowed:
        raise HTTPException(400, detail=f"Unsupported file type '.{ext}'. Allowed: PDF, DOCX")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10 MB
        raise HTTPException(400, detail="File too large (max 10 MB)")

    text = _extract_text_from_file(file.filename, content)
    if not text.strip():
        raise HTTPException(400, detail="Could not extract text from file")

    parsed = _parse_resume_with_groq(text)
    parsed["resume_text"] = text[:20000]  # pass back for storage
    return parsed


@router.post("/bulk-parse")
async def bulk_parse_resumes(
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload multiple resumes, return extracted fields for each. Does NOT save to DB."""
    if len(files) > 50:
        raise HTTPException(400, detail="Maximum 50 resumes per bulk upload")

    results = []
    for f in files:
        ext = (f.filename or "").lower().rsplit(".", 1)[-1]
        if ext not in {"pdf", "docx"}:
            results.append({"filename": f.filename, "status": "error", "error": f"Unsupported type .{ext}"})
            continue
        try:
            content = await f.read()
            text = _extract_text_from_file(f.filename, content)
            parsed = _parse_resume_with_groq(text)
            parsed["resume_text"] = text[:20000]
            parsed["filename"] = f.filename
            parsed["status"] = "parsed"
            results.append(parsed)
        except Exception as e:
            results.append({"filename": f.filename, "status": "error", "error": str(e)})

    return {"results": results, "total": len(results)}


# ─── AI Job Matching ───────────────────────────────────────────

def _compute_match(candidate_skills: list[str], job_skills: list[str]) -> tuple[float, dict]:
    """Skill-overlap match score. No API calls."""
    if not job_skills:
        return 0.0, {"matched": [], "missing": []}
    cset = {s.lower() for s in candidate_skills}
    matched = [s for s in job_skills if s.lower() in cset]
    missing = [s for s in job_skills if s.lower() not in cset]
    score = round(len(matched) / len(job_skills) * 100, 1)
    return score, {"matched": matched, "missing": missing}


@router.post("/{candidate_id}/match-jobs")
async def match_jobs(
    candidate_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run AI job matching for a candidate against all active jobs in the org.
    Creates/updates CandidateJob rows. Returns suggestions sorted by score."""
    c_result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id, Candidate.org_id == current_user["org_id"])
    )
    candidate = c_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(404, detail="Candidate not found")

    # Candidate skills from parsed_profile or CandidateSkill rows
    cand_skills: list[str] = []
    if candidate.parsed_profile and isinstance(candidate.parsed_profile.get("skills"), list):
        cand_skills = candidate.parsed_profile["skills"]
    if not cand_skills:
        skill_rows = (await db.execute(
            select(CandidateSkill).where(CandidateSkill.candidate_id == candidate_id)
        )).scalars().all()
        cand_skills = [s.skill for s in skill_rows]

    # Active jobs with parsed_jd
    jobs = (await db.execute(
        select(JobDescription).where(
            JobDescription.org_id == current_user["org_id"],
            JobDescription.is_active == True,
        )
    )).scalars().all()

    suggestions = []
    for job in jobs:
        job_skills: list[str] = []
        if job.parsed_jd and isinstance(job.parsed_jd.get("skills"), list):
            job_skills = job.parsed_jd["skills"]

        score, reason = _compute_match(cand_skills, job_skills)

        # Upsert CandidateJob
        existing = (await db.execute(
            select(CandidateJob).where(
                CandidateJob.candidate_id == candidate_id,
                CandidateJob.job_id == job.id,
            )
        )).scalar_one_or_none()

        if existing:
            existing.match_score = score
            existing.match_reason = reason
        else:
            db.add(CandidateJob(
                id=str(uuid.uuid4()),
                candidate_id=candidate_id,
                job_id=job.id,
                match_score=score,
                match_reason=reason,
                status=CandidateJobStatus.SUGGESTED,
            ))

        suggestions.append({
            "job_id": job.id,
            "job_title": job.title,
            "match_score": score,
            "match_reason": reason,
            "status": existing.status if existing else "suggested",
        })

    await db.flush()
    suggestions.sort(key=lambda x: x["match_score"], reverse=True)
    return {"candidate_id": candidate_id, "suggestions": suggestions}


# ─── Job Assignment endpoints ──────────────────────────────────

class AssignJobBody(BaseModel):
    status: CandidateJobStatus = CandidateJobStatus.SHORTLISTED


@router.get("/{candidate_id}/jobs")
async def list_candidate_jobs(
    candidate_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all job assignments for a candidate with match info."""
    if not (await db.execute(
        select(Candidate.id).where(Candidate.id == candidate_id, Candidate.org_id == current_user["org_id"])
    )).scalar_one_or_none():
        raise HTTPException(404, detail="Candidate not found")

    rows = (await db.execute(
        select(CandidateJob).where(CandidateJob.candidate_id == candidate_id)
    )).scalars().all()

    result = []
    for row in rows:
        job = await db.get(JobDescription, row.job_id)
        result.append({
            "id": row.id,
            "job_id": row.job_id,
            "job_title": job.title if job else "Unknown",
            "match_score": row.match_score,
            "match_reason": row.match_reason,
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        })
    result.sort(key=lambda x: (x["match_score"] or 0), reverse=True)
    return result


@router.post("/{candidate_id}/jobs/{job_id}")
async def assign_job(
    candidate_id: str,
    job_id: str,
    body: AssignJobBody,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign candidate to a job or update the status of an existing assignment."""
    if not (await db.execute(
        select(Candidate.id).where(Candidate.id == candidate_id, Candidate.org_id == current_user["org_id"])
    )).scalar_one_or_none():
        raise HTTPException(404, detail="Candidate not found")

    if not (await db.execute(
        select(JobDescription.id).where(JobDescription.id == job_id, JobDescription.org_id == current_user["org_id"])
    )).scalar_one_or_none():
        raise HTTPException(404, detail="Job not found")

    existing = (await db.execute(
        select(CandidateJob).where(CandidateJob.candidate_id == candidate_id, CandidateJob.job_id == job_id)
    )).scalar_one_or_none()

    # Track whether this is the first human assignment:
    # - brand new row (no prior match-jobs run), OR
    # - was SUGGESTED (AI match) and recruiter is now promoting it
    was_suggested = existing is not None and existing.status == CandidateJobStatus.SUGGESTED
    is_new_assignment = existing is None
    should_send_invite = (is_new_assignment or was_suggested) and body.status != CandidateJobStatus.SUGGESTED

    if existing:
        existing.status = body.status
        existing.assigned_by = current_user["id"]
    else:
        existing = CandidateJob(
            id=str(uuid.uuid4()),
            candidate_id=candidate_id,
            job_id=job_id,
            status=body.status,
            assigned_by=current_user["id"],
        )
        db.add(existing)

    await db.flush()

    # Auto-send screening invitation on first human assignment
    if should_send_invite:
        candidate_row = (await db.execute(
            select(Candidate).where(Candidate.id == candidate_id)
        )).scalar_one_or_none()

        if candidate_row and candidate_row.email:
            org_row = (await db.execute(
                select(Organization).where(Organization.id == current_user["org_id"])
            )).scalar_one_or_none()
            org_name = org_row.name if org_row else "VoxHire"

            job_row = await db.get(JobDescription, job_id)
            job_title = job_row.title if job_row else None

            # Increment attempt counter
            candidate_row.screening_attempt_count = (candidate_row.screening_attempt_count or 0) + 1
            candidate_row.last_screening_attempt_at = datetime.now(timezone.utc)
            candidate_row.screening_status = ScreeningStatus.LINK_SENT.value

            sc = ScreeningCall(
                candidate_id=candidate_id,
                org_id=current_user["org_id"],
                initiated_by=current_user["id"],
                job_id=job_id,
                attempt_number=candidate_row.screening_attempt_count,
                initiated_at=datetime.now(timezone.utc),
            )
            db.add(sc)
            await db.flush()

            token = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc) + timedelta(hours=72)
            screening_url = f"{settings.FRONTEND_URL.rstrip('/')}/screening/{token}"

            inv = ScreeningInvitation(
                token=token,
                candidate_id=candidate_id,
                org_id=current_user["org_id"],
                sent_by=current_user["id"],
                job_id=job_id,
                screening_call_id=sc.id,
                candidate_email=candidate_row.email,
                expires_at=expires_at,
            )
            db.add(inv)

            email_sent = send_screening_invitation(
                to_email=candidate_row.email,
                candidate_name=candidate_row.name,
                org_name=org_name,
                job_title=job_title,
                screening_url=screening_url,
                expires_in_hours=72,
            )
            inv.email_sent = email_sent

            ev = ScreeningEvent(
                candidate_id=candidate_id,
                screening_call_id=sc.id,
                event_type=ScreeningEventType.INVITATION_SENT.value,
                event_data={
                    "invitationToken": token,
                    "jobTitle": job_title,
                    "emailSent": email_sent,
                    "sentBy": current_user.get("name", ""),
                    "autoSent": True,
                },
            )
            db.add(ev)
            await db.flush()

            return {
                "candidate_id": candidate_id,
                "job_id": job_id,
                "status": existing.status,
                "invitation_sent": True,
                "email_sent": email_sent,
                "candidate_email": candidate_row.email,
                "invitation_url": screening_url,
            }

    return {"candidate_id": candidate_id, "job_id": job_id, "status": existing.status, "invitation_sent": False}


@router.delete("/{candidate_id}/jobs/{job_id}", status_code=204)
async def remove_job_assignment(
    candidate_id: str,
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a candidate's job assignment."""
    row = (await db.execute(
        select(CandidateJob).where(CandidateJob.candidate_id == candidate_id, CandidateJob.job_id == job_id)
    )).scalar_one_or_none()
    if row:
        await db.delete(row)
