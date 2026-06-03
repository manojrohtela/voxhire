"""
Interview Sessions API endpoints.
POST /api/v1/interviews                        — Create/schedule interview
GET  /api/v1/interviews                        — List org interviews
GET  /api/v1/interviews/{id}                   — Get full interview detail
PUT  /api/v1/interviews/{id}/status            — Update status
POST /api/v1/interviews/{id}/evaluation        — Save evaluation
POST /api/v1/interviews/{id}/transcript        — Append transcript entries
POST /api/v1/interviews/{id}/violations        — Record anti-cheat violation
GET  /api/v1/interviews/join/{link_token}      — Candidate joins via link (no auth)
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.db.models import (
    InterviewSession, Candidate, SkillEvaluation,
    TranscriptEntry, AntiCheatViolation,
    InterviewStatus, EvaluationRating, TranscriptSpeaker, ViolationType
)
from app.modules.auth.dependencies import get_current_user

router = APIRouter()


# ─── Pydantic schemas ──────────────────────────────────────────

class CreateInterviewRequest(BaseModel):
    candidate_id: str
    scheduled_at: Optional[str] = None   # ISO datetime string
    duration_minutes: int = 45

class UpdateStatusRequest(BaseModel):
    status: InterviewStatus

class SkillEvalInput(BaseModel):
    skill: str
    rating: EvaluationRating
    score: Optional[int] = None
    questions_asked: int = 0
    ai_notes: Optional[str] = None

class SaveEvaluationRequest(BaseModel):
    overall_rating: EvaluationRating
    ai_summary: Optional[str] = None
    strengths: Optional[list[str]] = None
    weak_areas: Optional[list[str]] = None
    skill_evaluations: list[SkillEvalInput] = []

class TranscriptEntryInput(BaseModel):
    speaker: TranscriptSpeaker
    text: str
    timestamp_seconds: Optional[float] = None

class AppendTranscriptRequest(BaseModel):
    entries: list[TranscriptEntryInput]

class ViolationInput(BaseModel):
    violation_type: ViolationType
    timestamp_seconds: Optional[float] = None


# ─── Helpers ───────────────────────────────────────────────────

def session_to_dict(s: InterviewSession, include_candidate: bool = False) -> dict:
    data = {
        "id": s.id,
        "candidate_id": s.candidate_id,
        "org_id": s.org_id,
        "status": s.status,
        "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
        "duration_minutes": s.duration_minutes,
        "interview_link": s.interview_link,
        "link_token": s.link_token,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        "actual_duration_minutes": s.actual_duration_minutes,
        "overall_rating": s.overall_rating,
        "ai_summary": s.ai_summary,
        "strengths": s.strengths,
        "weak_areas": s.weak_areas,
        "recording_url": s.recording_url,
        "invite_email_sent": s.invite_email_sent,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }
    return data


# ─── Endpoints ─────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_interview(
    body: CreateInterviewRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Schedule an interview for a candidate."""
    # Verify candidate belongs to org
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == body.candidate_id,
            Candidate.org_id == current_user["org_id"]
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, detail="Candidate not found")

    link_token = str(uuid.uuid4()).replace("-", "")
    base_url = "https://voxhire.vercel.app"

    scheduled_at = None
    if body.scheduled_at:
        try:
            scheduled_at = datetime.fromisoformat(body.scheduled_at)
        except ValueError:
            raise HTTPException(400, detail="Invalid scheduled_at format. Use ISO 8601.")

    session = InterviewSession(
        id=str(uuid.uuid4()),
        candidate_id=body.candidate_id,
        org_id=current_user["org_id"],
        created_by=current_user["id"],
        scheduled_at=scheduled_at,
        duration_minutes=body.duration_minutes,
        link_token=link_token,
        interview_link=f"{base_url}/interview/{link_token}",
        status=InterviewStatus.SCHEDULED,
    )
    db.add(session)
    await db.flush()
    return session_to_dict(session)


@router.get("")
async def list_interviews(
    status: Optional[InterviewStatus] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all interview sessions in the org."""
    query = select(InterviewSession).where(
        InterviewSession.org_id == current_user["org_id"]
    )
    if status:
        query = query.where(InterviewSession.status == status)

    query = query.order_by(InterviewSession.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    sessions = result.scalars().all()
    return [session_to_dict(s) for s in sessions]


@router.get("/join/{link_token}")
async def join_interview(
    link_token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Candidate joins via interview link — no auth required.
    Returns session info + candidate name for the interview page.
    """
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.link_token == link_token)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, detail="Invalid interview link")
    if session.status == InterviewStatus.TERMINATED:
        raise HTTPException(410, detail="This interview has been terminated")
    if session.status == InterviewStatus.COMPLETED:
        raise HTTPException(410, detail="This interview has already been completed")

    # Get candidate name
    candidate_result = await db.execute(
        select(Candidate).where(Candidate.id == session.candidate_id)
    )
    candidate = candidate_result.scalar_one_or_none()

    return {
        "session_id": session.id,
        "candidate_name": candidate.name if candidate else "Candidate",
        "duration_minutes": session.duration_minutes,
        "status": session.status,
        "scheduled_at": session.scheduled_at.isoformat() if session.scheduled_at else None,
    }


@router.get("/{session_id}")
async def get_interview(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full interview detail with evaluations, transcript, violations."""
    result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == session_id,
            InterviewSession.org_id == current_user["org_id"]
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, detail="Interview not found")

    data = session_to_dict(session)

    # Skill evaluations
    evals_result = await db.execute(
        select(SkillEvaluation).where(SkillEvaluation.session_id == session_id)
    )
    data["skill_evaluations"] = [
        {"skill": e.skill, "rating": e.rating, "score": e.score,
         "questions_asked": e.questions_asked, "ai_notes": e.ai_notes}
        for e in evals_result.scalars().all()
    ]

    # Transcript
    transcript_result = await db.execute(
        select(TranscriptEntry)
        .where(TranscriptEntry.session_id == session_id)
        .order_by(TranscriptEntry.sequence)
    )
    data["transcript"] = [
        {"sequence": t.sequence, "speaker": t.speaker, "text": t.text,
         "timestamp_seconds": t.timestamp_seconds}
        for t in transcript_result.scalars().all()
    ]

    # Violations
    violations_result = await db.execute(
        select(AntiCheatViolation).where(AntiCheatViolation.session_id == session_id)
    )
    data["violations"] = [
        {"type": v.violation_type, "count": v.count, "timestamp_seconds": v.timestamp_seconds}
        for v in violations_result.scalars().all()
    ]

    return data


@router.put("/{session_id}/status")
async def update_status(
    session_id: str,
    body: UpdateStatusRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update interview status (start, complete, terminate)."""
    result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == session_id,
            InterviewSession.org_id == current_user["org_id"]
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, detail="Interview not found")

    session.status = body.status
    now = datetime.now(timezone.utc)

    if body.status == InterviewStatus.IN_PROGRESS and not session.started_at:
        session.started_at = now
    elif body.status in (InterviewStatus.COMPLETED, InterviewStatus.TERMINATED):
        session.ended_at = now
        if session.started_at:
            delta = (now - session.started_at).seconds // 60
            session.actual_duration_minutes = delta

    await db.flush()
    return session_to_dict(session)


@router.post("/{session_id}/evaluation")
async def save_evaluation(
    session_id: str,
    body: SaveEvaluationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save AI evaluation results for a completed interview."""
    result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == session_id,
            InterviewSession.org_id == current_user["org_id"]
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, detail="Interview not found")

    # Update session
    session.overall_rating = body.overall_rating
    session.ai_summary = body.ai_summary
    session.strengths = body.strengths
    session.weak_areas = body.weak_areas

    # Update candidate overall rating too
    candidate_result = await db.execute(
        select(Candidate).where(Candidate.id == session.candidate_id)
    )
    candidate = candidate_result.scalar_one_or_none()
    if candidate:
        candidate.overall_rating = body.overall_rating

    # Save skill evaluations
    for eval_input in body.skill_evaluations:
        eval_obj = SkillEvaluation(
            id=str(uuid.uuid4()),
            session_id=session_id,
            skill=eval_input.skill,
            rating=eval_input.rating,
            score=eval_input.score,
            questions_asked=eval_input.questions_asked,
            ai_notes=eval_input.ai_notes,
        )
        db.add(eval_obj)

    await db.flush()
    return {"message": "Evaluation saved", "overall_rating": body.overall_rating}


@router.post("/{session_id}/transcript")
async def append_transcript(
    session_id: str,
    body: AppendTranscriptRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Append transcript entries — called from interview page (no auth, uses session context).
    Sequence auto-incremented.
    """
    # Get current max sequence
    result = await db.execute(
        select(TranscriptEntry)
        .where(TranscriptEntry.session_id == session_id)
        .order_by(TranscriptEntry.sequence.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    next_seq = (last.sequence + 1) if last else 1

    for entry in body.entries:
        t = TranscriptEntry(
            id=str(uuid.uuid4()),
            session_id=session_id,
            sequence=next_seq,
            speaker=entry.speaker,
            text=entry.text,
            timestamp_seconds=entry.timestamp_seconds,
        )
        db.add(t)
        next_seq += 1

    await db.flush()
    return {"message": f"{len(body.entries)} entries saved"}


@router.post("/{session_id}/violations")
async def record_violation(
    session_id: str,
    body: ViolationInput,
    db: AsyncSession = Depends(get_db),
):
    """
    Record anti-cheat violation — called from interview page (no auth).
    Increments count if same type already exists.
    """
    result = await db.execute(
        select(AntiCheatViolation).where(
            AntiCheatViolation.session_id == session_id,
            AntiCheatViolation.violation_type == body.violation_type
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.count += 1
        existing.timestamp_seconds = body.timestamp_seconds
    else:
        violation = AntiCheatViolation(
            id=str(uuid.uuid4()),
            session_id=session_id,
            violation_type=body.violation_type,
            count=1,
            timestamp_seconds=body.timestamp_seconds,
        )
        db.add(violation)

    await db.flush()
    return {"message": "Violation recorded"}
