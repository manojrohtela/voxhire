"""
Interview Sessions API endpoints.
POST /api/v1/interviews                              — Create/schedule interview
GET  /api/v1/interviews                              — List org interviews
GET  /api/v1/interviews/{id}                         — Get full interview detail
PUT  /api/v1/interviews/{id}/status                  — Update status (recruiter, JWT auth)
POST /api/v1/interviews/{id}/evaluation              — Save evaluation
POST /api/v1/interviews/{id}/transcript              — Append transcript entries (candidate, link_token auth)
POST /api/v1/interviews/{id}/violations              — Record anti-cheat violation (candidate, link_token auth)
GET  /api/v1/interviews/join/{link_token}            — Candidate joins via link (no auth)
PUT  /api/v1/interviews/session/{link_token}/status  — Candidate updates status (link_token auth)
"""

import uuid
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.db.models import (
    InterviewSession, Candidate, CandidateSkill, Organization,
    SkillEvaluation, TranscriptEntry, AntiCheatViolation,
    InterviewStatus, EvaluationRating, HiringDecision, TranscriptSpeaker, ViolationType
)
from app.modules.auth.dependencies import get_current_user
from app.core.config import settings
from app.core.email import send_interview_invitation

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Pydantic schemas ──────────────────────────────────────────

class CreateInterviewRequest(BaseModel):
    candidate_id: str
    scheduled_at: Optional[str] = None   # ISO datetime string
    duration_minutes: int = 45
    # Interview configuration
    interview_type: Optional[str] = None      # Technical / HR / Leadership / Sales
    language: Optional[str] = "en"
    difficulty: Optional[str] = None          # Easy / Medium / Hard
    question_strategy: Optional[str] = None
    ai_personality: Optional[str] = None      # Friendly / Strict / Neutral
    focus_skills: Optional[list[str]] = None  # HR-defined skills for Vapi to probe

class UpdateStatusRequest(BaseModel):
    status: InterviewStatus

class SkillEvalInput(BaseModel):
    skill: str
    rating: EvaluationRating
    score: Optional[int] = None
    questions_asked: int = 0
    ai_notes: Optional[str] = None

class SaveEvaluationRequest(BaseModel):
    overall_rating: HiringDecision
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
    return {
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
        "interview_type": s.interview_type,
        "language": s.language,
        "difficulty": s.difficulty,
        "question_strategy": s.question_strategy,
        "ai_personality": s.ai_personality,
        "focus_skills": s.focus_skills or [],
        "custom_job_title": s.custom_job_title,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        # Vapi + evaluation fields
        "vapi_call_id": s.vapi_call_id,
        "evaluation_status": s.evaluation_status or "pending",
        "executive_summary": s.executive_summary,
        "topics_covered": s.topics_covered,
        "topics_missing": s.topics_missing,
        "topics_needs_evaluation": s.topics_needs_evaluation,
        "communication_score": s.communication_score,
        "confidence_score": s.confidence_score,
        "clarity_score": s.clarity_score,
        "resume_claim_verification": s.resume_claim_verification,
        "candidate_questions": s.candidate_questions,
        "interview_timeline": s.interview_timeline,
    }


async def _verify_link_token(
    session_id: str,
    link_token: Optional[str],
    db: AsyncSession,
) -> InterviewSession:
    """Validate that link_token belongs to session_id. Used for candidate-facing endpoints."""
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, detail="Interview session not found")
    if link_token and session.link_token != link_token:
        raise HTTPException(403, detail="Invalid interview token")
    return session


# ─── Endpoints ─────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_interview(
    body: CreateInterviewRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Schedule an interview for a candidate."""
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == body.candidate_id,
            Candidate.org_id == current_user["org_id"]
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(404, detail="Candidate not found")

    link_token = str(uuid.uuid4()).replace("-", "")
    base_url = settings.FRONTEND_URL.rstrip("/")

    scheduled_at = None
    if body.scheduled_at:
        try:
            scheduled_at = datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(400, detail="Invalid scheduled_at format. Use ISO 8601.")
        # Reject scheduling in the past (allow a 2-minute grace for clock skew).
        now = datetime.now(timezone.utc)
        sched_cmp = scheduled_at if scheduled_at.tzinfo else scheduled_at.replace(tzinfo=timezone.utc)
        if sched_cmp < now - timedelta(minutes=2):
            raise HTTPException(400, detail="Interview time must be in the future.")

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
        interview_type=body.interview_type,
        language=body.language or "en",
        difficulty=body.difficulty,
        question_strategy=body.question_strategy,
        ai_personality=body.ai_personality,
        focus_skills=body.focus_skills or [],
    )
    db.add(session)
    await db.flush()

    from app.modules.audit.log import record as audit
    await audit(db, action="interview.schedule", actor=current_user, target_type="interview",
                target_id=session.id, meta={"candidate_id": body.candidate_id, "scheduled_at": body.scheduled_at})

    # Email the interview invite to the candidate (best-effort; non-fatal).
    if candidate.email:
        org = (
            await db.execute(select(Organization).where(Organization.id == current_user["org_id"]))
        ).scalar_one_or_none()
        when = None
        if scheduled_at:
            when = scheduled_at.strftime("%A, %d %B %Y at %I:%M %p UTC")
        try:
            sent = send_interview_invitation(
                to_email=candidate.email,
                candidate_name=candidate.name,
                org_name=org.name if org else "VoxHire",
                job_title=candidate.applied_role or body.interview_type,
                interview_url=session.interview_link,
                interview_availability=when,
            )
            session.invite_email_sent = bool(sent)
        except Exception as e:  # noqa: BLE001 — email failures must not block scheduling
            logger.warning("Interview invite email failed: %s", e)

    return session_to_dict(session)


class UpdateInterviewConfigRequest(BaseModel):
    custom_job_title: Optional[str] = None
    interview_type: Optional[str] = None
    difficulty: Optional[str] = None
    ai_personality: Optional[str] = None
    duration_minutes: Optional[int] = None
    focus_skills: Optional[list[str]] = None


@router.patch("/{interview_id}/config")
async def update_interview_config(
    interview_id: str,
    body: UpdateInterviewConfigRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update Vapi interview configuration fields before the interview starts."""
    result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == interview_id,
            InterviewSession.org_id == current_user["org_id"],
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Interview session not found")

    if body.custom_job_title is not None:
        session.custom_job_title = body.custom_job_title.strip() or None
    if body.interview_type is not None:
        session.interview_type = body.interview_type
    if body.difficulty is not None:
        session.difficulty = body.difficulty
    if body.ai_personality is not None:
        session.ai_personality = body.ai_personality
    if body.duration_minutes is not None:
        session.duration_minutes = body.duration_minutes
    if body.focus_skills is not None:
        session.focus_skills = body.focus_skills

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
    Returns session info, candidate name, skills, org name, and applied role.
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

    # Get candidate info
    candidate_result = await db.execute(
        select(Candidate).where(Candidate.id == session.candidate_id)
    )
    candidate = candidate_result.scalar_one_or_none()

    # Get org name
    org_result = await db.execute(
        select(Organization).where(Organization.id == session.org_id)
    )
    org = org_result.scalar_one_or_none()

    # Get candidate's selected skills (HR-chosen skills to assess)
    skills_result = await db.execute(
        select(CandidateSkill).where(CandidateSkill.candidate_id == session.candidate_id)
    )
    skills = skills_result.scalars().all()
    skills_to_assess = [s.skill for s in skills]

    # Candidate's own skills from parsed_profile
    candidate_skills: list[str] = []
    if candidate and candidate.parsed_profile:
        raw_skills = candidate.parsed_profile.get("skills", {})
        for category in ("technical", "languages", "frameworks", "tools"):
            candidate_skills.extend(raw_skills.get(category, []))

    return {
        "session_id": session.id,
        "link_token": link_token,
        "candidate_name": candidate.name if candidate else "Candidate",
        "applied_role": candidate.applied_role if candidate else "",
        "org_name": org.name if org else "",
        "duration_minutes": session.duration_minutes,
        "status": session.status,
        "scheduled_at": session.scheduled_at.isoformat() if session.scheduled_at else None,
        "interview_type": session.interview_type or "Technical",
        "difficulty": session.difficulty or "Medium",
        "language": session.language or "en",
        "ai_personality": session.ai_personality or "Neutral",
        "candidate_skills": candidate_skills,
        "skills_to_assess": skills_to_assess,
    }


@router.put("/session/{link_token}/status")
async def update_status_by_link_token(
    link_token: str,
    body: UpdateStatusRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Candidate-side status update — authenticated only by link_token.
    Allows transitions: SCHEDULED → IN_PROGRESS, IN_PROGRESS → COMPLETED/TERMINATED.
    """
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.link_token == link_token)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, detail="Invalid interview link")

    allowed = {InterviewStatus.IN_PROGRESS, InterviewStatus.COMPLETED, InterviewStatus.TERMINATED}
    if body.status not in allowed:
        raise HTTPException(400, detail="Invalid status transition from candidate side")

    now = datetime.now(timezone.utc)
    session.status = body.status

    if body.status == InterviewStatus.IN_PROGRESS and not session.started_at:
        session.started_at = now
    elif body.status in (InterviewStatus.COMPLETED, InterviewStatus.TERMINATED):
        session.ended_at = now
        if session.started_at:
            delta = int((now - session.started_at).total_seconds() // 60)
            session.actual_duration_minutes = delta

    await db.flush()
    return {"status": session.status, "session_id": session.id}


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
    """Update interview status (recruiter side, requires JWT)."""
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
            delta = int((now - session.started_at).total_seconds() // 60)
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

    session.overall_rating = body.overall_rating
    session.ai_summary = body.ai_summary
    session.strengths = body.strengths
    session.weak_areas = body.weak_areas

    # Sync hiring decision to candidate record
    candidate_result = await db.execute(
        select(Candidate).where(Candidate.id == session.candidate_id)
    )
    candidate = candidate_result.scalar_one_or_none()
    if candidate:
        candidate.overall_rating = body.overall_rating

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
    x_interview_token: Optional[str] = Header(default=None, alias="X-Interview-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Append transcript entries — called from interview page using link_token for auth.
    Requires X-Interview-Token header matching the session's link_token.
    """
    session = await _verify_link_token(session_id, x_interview_token, db)

    # Refuse writes after interview is done
    if session.status in (InterviewStatus.TERMINATED,):
        return {"message": "0 entries saved — session terminated"}

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
    x_interview_token: Optional[str] = Header(default=None, alias="X-Interview-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Record anti-cheat violation — called from interview page using link_token for auth.
    Requires X-Interview-Token header matching the session's link_token.
    """
    await _verify_link_token(session_id, x_interview_token, db)

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
