"""
Job Descriptions API endpoints.
POST /api/v1/jobs          — Upload + parse a job description
GET  /api/v1/jobs          — List org job descriptions
GET  /api/v1/jobs/{id}     — Get job description detail
PATCH /api/v1/jobs/{id}    — Update title or raw_text
DELETE /api/v1/jobs/{id}   — Delete a job description
"""

import uuid
import json
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.db.models import JobDescription
from app.modules.auth.dependencies import get_current_user
from app.core.config import settings

router = APIRouter()


# ─── Pydantic schemas ──────────────────────────────────────────

class CreateJDRequest(BaseModel):
    title: str
    raw_text: str   # Pasted or extracted JD text

class UpdateJDRequest(BaseModel):
    title: Optional[str] = None
    raw_text: Optional[str] = None


# ─── Groq JD parser ────────────────────────────────────────────

def parse_jd_with_groq(title: str, raw_text: str) -> dict:
    """Parse JD text and extract structured fields using Groq llama."""
    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)

    prompt = f"""You are a precise JSON extractor. Parse this job description and return ONLY valid JSON.

Job Title: {title}

Job Description:
{raw_text[:4000]}

Return this exact JSON structure (no markdown, no explanation):
{{
  "skills": ["list of required technical skills"],
  "experience_requirements": "e.g. 3+ years of experience in...",
  "responsibilities": ["key responsibility 1", "key responsibility 2"],
  "keywords": ["important keyword 1", "important keyword 2"],
  "seniority_level": "Junior/Mid/Senior/Lead/Principal",
  "employment_type": "Full-time/Part-time/Contract/etc",
  "industry": "e.g. Fintech, SaaS, Healthcare"
}}"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=1000,
    )

    text = response.choices[0].message.content or "{}"
    # Strip markdown code blocks if present
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"skills": [], "experience_requirements": "", "responsibilities": [], "keywords": []}


# ─── Helpers ───────────────────────────────────────────────────

def jd_to_dict(jd: JobDescription) -> dict:
    return {
        "id": jd.id,
        "title": jd.title,
        "raw_text": jd.raw_text,
        "parsed_jd": jd.parsed_jd,
        "is_active": jd.is_active,
        "created_at": jd.created_at.isoformat() if jd.created_at else None,
        "updated_at": jd.updated_at.isoformat() if jd.updated_at else None,
    }


# ─── Endpoints ─────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_jd(
    body: CreateJDRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload and AI-parse a job description."""
    if not body.raw_text or len(body.raw_text.strip()) < 30:
        raise HTTPException(400, detail="Job description text is too short")

    try:
        parsed = parse_jd_with_groq(body.title, body.raw_text)
    except Exception:
        parsed = {}

    jd = JobDescription(
        id=str(uuid.uuid4()),
        org_id=current_user["org_id"],
        created_by=current_user["id"],
        title=body.title,
        raw_text=body.raw_text,
        parsed_jd=parsed,
    )
    db.add(jd)
    await db.flush()
    return jd_to_dict(jd)


@router.get("")
async def list_jds(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all job descriptions in the org."""
    result = await db.execute(
        select(JobDescription)
        .where(
            JobDescription.org_id == current_user["org_id"],
            JobDescription.is_active == True,
        )
        .order_by(JobDescription.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return [jd_to_dict(jd) for jd in result.scalars().all()]


@router.get("/{jd_id}")
async def get_jd(
    jd_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single job description."""
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.org_id == current_user["org_id"],
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        raise HTTPException(404, detail="Job description not found")
    return jd_to_dict(jd)


@router.patch("/{jd_id}")
async def update_jd(
    jd_id: str,
    body: UpdateJDRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update title or raw_text; re-parses if raw_text changes."""
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.org_id == current_user["org_id"],
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        raise HTTPException(404, detail="Job description not found")

    if body.title:
        jd.title = body.title
    if body.raw_text:
        jd.raw_text = body.raw_text
        try:
            jd.parsed_jd = parse_jd_with_groq(jd.title, body.raw_text)
        except Exception:
            pass

    await db.flush()
    return jd_to_dict(jd)


@router.delete("/{jd_id}", status_code=204)
async def delete_jd(
    jd_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a job description."""
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.org_id == current_user["org_id"],
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        raise HTTPException(404, detail="Job description not found")
    jd.is_active = False
    await db.flush()
