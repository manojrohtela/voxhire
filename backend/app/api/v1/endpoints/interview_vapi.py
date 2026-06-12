"""
Vapi Interview Integration Endpoints.

GET  /api/v1/interviews/{session_id}/vapi-config   — candidate page requests Vapi config
POST /api/v1/interviews/vapi-webhook               — Vapi posts end-of-call-report here

Keeps the Vapi webhook handler completely separate from the screening webhook
(screening.py) so the two flows don't interfere.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import get_db
from app.db.models import (
    Candidate,
    CandidateSkill,
    InterviewSession,
    InterviewStatus,
    JobDescription,
    Organization,
    SkillEvaluation,
    TranscriptEntry,
    TranscriptSpeaker,
)
from app.modules.evaluation.engine import run_evaluation

logger = logging.getLogger(__name__)
router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── GET vapi-config (candidate calls this when interview page loads) ─────────

@router.get("/{session_id}/vapi-config")
async def get_vapi_config(
    session_id: str,
    x_interview_token: Optional[str] = Header(default=None, alias="X-Interview-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns Vapi Web SDK config for this interview session.
    Auth: X-Interview-Token header (same as transcript/violations endpoints).
    """
    result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Interview session not found")
    if x_interview_token and session.link_token != x_interview_token:
        raise HTTPException(403, "Invalid interview token")
    if session.status in (InterviewStatus.COMPLETED, InterviewStatus.TERMINATED):
        raise HTTPException(410, "Interview already completed")

    # Load candidate context
    candidate = (
        await db.execute(select(Candidate).where(Candidate.id == session.candidate_id))
    ).scalar_one_or_none()

    org = (
        await db.execute(select(Organization).where(Organization.id == session.org_id))
    ).scalar_one_or_none()

    skills_result = await db.execute(
        select(CandidateSkill).where(CandidateSkill.candidate_id == session.candidate_id)
    )
    skills = [s.skill for s in skills_result.scalars().all()]

    # Build the candidate summary for Vapi context
    candidate_summary = {}
    if candidate:
        candidate_summary = {
            "name": candidate.name,
            "appliedRole": candidate.applied_role or session.interview_type or "Software Engineer",
            "totalExperience": candidate.total_experience_years,
            "summary": candidate.summary or "",
        }
        if candidate.parsed_profile:
            raw_skills = candidate.parsed_profile.get("skills", {})
            all_skills: list[str] = []
            for cat in ("technical", "languages", "frameworks", "tools"):
                all_skills.extend(raw_skills.get(cat, []))
            candidate_summary["skills"] = all_skills[:20]

    # HR-defined focus skills take priority; fall back to candidate resume skills
    focus_skills = session.focus_skills if session.focus_skills else skills

    # Build Vapi assistant overrides — dynamic context injected into the assistant
    variable_values = {
        "jobTitle": session.interview_type or (candidate.applied_role if candidate else "Software Engineer"),
        "candidateName": candidate.name if candidate else "Candidate",
        "orgName": org.name if org else "",
        "experienceLevel": _map_difficulty_to_level(session.difficulty or "Medium"),
        "difficulty": session.difficulty or "Medium",
        "requiredSkills": focus_skills,
        "focusAreas": focus_skills,
        "durationMinutes": session.duration_minutes or 45,
        "interviewType": session.interview_type or "Technical",
        "candidateSummary": candidate_summary,
    }

    metadata = {
        "sessionId": session_id,
        "linkToken": session.link_token or "",
        "candidateId": session.candidate_id,
        "orgId": session.org_id,
    }

    return {
        "vapi_public_key": settings.VAPI_PUBLIC_KEY,
        "vapi_assistant_id": settings.VAPI_INTERVIEW_ASSISTANT_ID,
        "variable_values": variable_values,
        "metadata": metadata,
    }


def _map_difficulty_to_level(difficulty: str) -> str:
    return {"Easy": "Junior", "Medium": "Mid-Level", "Hard": "Senior"}.get(difficulty, "Mid-Level")


# ── POST vapi-webhook (Vapi calls this when interview ends) ──────────────────

@router.post("/vapi-webhook", status_code=200)
async def vapi_interview_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_vapi_secret: Optional[str] = Header(None),
):
    """
    Vapi posts end-of-call-report here when an interview call ends.
    Configure in Vapi dashboard → interview assistant → Server URL.
    """
    # Verify webhook secret if configured
    if settings.VAPI_INTERVIEW_WEBHOOK_SECRET:
        if x_vapi_secret != settings.VAPI_INTERVIEW_WEBHOOK_SECRET:
            raise HTTPException(403, "Invalid webhook secret")

    payload = await request.json()
    message = payload.get("message", payload)
    message_type = message.get("type", "")

    if message_type != "end-of-call-report":
        return {"received": True}

    # Extract call metadata
    call_obj = message.get("call") or {}
    vapi_call_id = call_obj.get("id") or message.get("callId", "")
    ended_reason = message.get("endedReason", "")

    metadata = call_obj.get("metadata") or {}
    if not metadata:
        metadata = (call_obj.get("assistantOverrides") or {}).get("metadata", {}) or {}

    session_id = metadata.get("sessionId", "")
    link_token = metadata.get("linkToken", "")

    # Find the interview session
    session: Optional[InterviewSession] = None

    if session_id:
        result = await db.execute(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )
        session = result.scalar_one_or_none()

    if session is None and link_token:
        result = await db.execute(
            select(InterviewSession).where(InterviewSession.link_token == link_token)
        )
        session = result.scalar_one_or_none()

    if session is None and vapi_call_id:
        result = await db.execute(
            select(InterviewSession).where(InterviewSession.vapi_call_id == vapi_call_id)
        )
        session = result.scalar_one_or_none()

    if session is None:
        logger.warning("Vapi interview webhook: no matching session for call %s", vapi_call_id)
        return {"received": True, "warning": "No matching interview session found"}

    # Guard against double-processing
    if session.status == InterviewStatus.COMPLETED and session.evaluation_status == "complete":
        return {"received": True, "already_processed": True}

    # Store vapi_call_id
    if vapi_call_id and not session.vapi_call_id:
        session.vapi_call_id = vapi_call_id

    # Extract transcript from Vapi artifact
    artifact = message.get("artifact") or {}
    vapi_messages: list[dict] = artifact.get("messages") or []
    transcript_text: list[dict] = artifact.get("transcript") or []

    # Normalize transcript — Vapi uses messages[] with role/content
    raw_transcript = vapi_messages or transcript_text
    normalized_transcript = _normalize_transcript(raw_transcript)

    session.vapi_transcript = normalized_transcript

    # Mark interview completed
    now = _utcnow()
    session.status = InterviewStatus.COMPLETED
    session.ended_at = now
    if session.started_at:
        delta = int((now - session.started_at).total_seconds() // 60)
        session.actual_duration_minutes = delta

    # Store transcript entries in transcript_entries table
    await _save_transcript_entries(db, session.id, normalized_transcript)

    # Mark evaluation as processing and save to DB first
    session.evaluation_status = "processing"
    await db.commit()

    # Run LLM evaluation asynchronously (fire-and-forget, don't block the webhook)
    asyncio.create_task(
        _run_evaluation_task(session_id=session.id)
    )

    return {"received": True, "session_id": session.id}


def _normalize_transcript(raw: list[dict]) -> list[dict]:
    """Normalize Vapi message format to our standard {role, text} format."""
    result = []
    for msg in raw:
        role = msg.get("role", "")
        content = msg.get("content") or msg.get("message") or msg.get("text") or ""
        if not content or not content.strip():
            continue
        if role in ("assistant", "bot", "ai"):
            role = "assistant"
        elif role in ("user", "human", "candidate"):
            role = "user"
        else:
            continue
        result.append({"role": role, "text": content.strip()})
    return result


async def _save_transcript_entries(
    db: AsyncSession,
    session_id: str,
    transcript: list[dict],
) -> None:
    """Persist transcript to transcript_entries table."""
    for i, entry in enumerate(transcript, start=1):
        speaker = (
            TranscriptSpeaker.AI if entry["role"] == "assistant" else TranscriptSpeaker.CANDIDATE
        )
        db.add(TranscriptEntry(
            id=str(uuid.uuid4()),
            session_id=session_id,
            sequence=i,
            speaker=speaker,
            text=entry["text"],
            timestamp_seconds=None,
        ))


async def _run_evaluation_task(session_id: str) -> None:
    """Background task: run LLM evaluation and persist results."""
    from app.db.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(InterviewSession).where(InterviewSession.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session:
                return

            # Load candidate
            candidate = (
                await db.execute(select(Candidate).where(Candidate.id == session.candidate_id))
            ).scalar_one_or_none()

            # Load skills
            skills_result = await db.execute(
                select(CandidateSkill).where(CandidateSkill.candidate_id == session.candidate_id)
            )
            skills = [s.skill for s in skills_result.scalars().all()]

            # Load job description if linked
            jd_text: Optional[str] = None
            if session.job_id:
                jd_result = await db.execute(
                    select(JobDescription).where(JobDescription.id == session.job_id)
                )
                jd = jd_result.scalar_one_or_none()
                if jd:
                    jd_text = jd.raw_text

            transcript = session.vapi_transcript or []

            eval_result = await run_evaluation(
                transcript=transcript,
                candidate_name=candidate.name if candidate else "Candidate",
                applied_role=candidate.applied_role if candidate else "",
                skills_to_assess=skills,
                resume_summary=candidate.summary if candidate else None,
                parsed_profile=candidate.parsed_profile if candidate else None,
                job_description=jd_text,
                difficulty=session.difficulty or "Medium",
                interview_type=session.interview_type or "Technical",
                duration_minutes=session.duration_minutes or 45,
            )

            # Persist evaluation results to session
            from app.db.models import HiringDecision
            rating_value = eval_result.get("overall_rating", "Consider")
            try:
                session.overall_rating = HiringDecision(rating_value)
            except ValueError:
                session.overall_rating = HiringDecision.CONSIDER

            session.ai_summary = eval_result.get("ai_summary", "")
            session.strengths = eval_result.get("strengths", [])
            session.weak_areas = eval_result.get("weak_areas", [])
            session.executive_summary = "\n".join(eval_result.get("executive_summary", []))
            session.topics_covered = eval_result.get("topics_covered", [])
            session.topics_missing = eval_result.get("topics_missing", [])
            session.topics_needs_evaluation = eval_result.get("topics_needs_evaluation", [])
            session.communication_score = eval_result.get("communication_score")
            session.confidence_score = eval_result.get("confidence_score")
            session.clarity_score = eval_result.get("clarity_score")
            session.resume_claim_verification = eval_result.get("resume_claim_verification", [])
            session.candidate_questions = eval_result.get("candidate_questions", [])
            session.interview_timeline = eval_result.get("interview_timeline", [])
            session.evaluation_status = "complete"

            # Persist skill evaluations
            for se in eval_result.get("skill_evaluations", []):
                from app.db.models import EvaluationRating
                try:
                    rating = EvaluationRating(se.get("rating", "Medium"))
                except ValueError:
                    rating = EvaluationRating.MEDIUM
                db.add(SkillEvaluation(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    skill=se.get("skill", ""),
                    rating=rating,
                    score=se.get("score"),
                    questions_asked=se.get("questions_asked", 0),
                    ai_notes=se.get("ai_notes", ""),
                ))

            # Update candidate overall_rating
            if candidate:
                candidate.overall_rating = session.overall_rating

            await db.commit()
            logger.info("Evaluation complete for session %s: %s", session_id, session.overall_rating)

    except Exception:
        logger.exception("Evaluation failed for session %s", session_id)
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(InterviewSession).where(InterviewSession.id == session_id)
                )
                session = result.scalar_one_or_none()
                if session:
                    session.evaluation_status = "failed"
                    await db.commit()
        except Exception:
            pass
