"""
WebSocket endpoint for the real-time voice interview pipeline.

  WS /api/v1/ws/interview/{link_token}

Auth model matches the candidate-facing REST endpoints: possession of a valid
link_token is the credential. Session config (candidate, role, skills,
difficulty, personality) is loaded server-side — the client sends only audio.
"""

import logging

from fastapi import APIRouter, WebSocket
from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.db.models import (
    Candidate,
    CandidateSkill,
    InterviewSession,
    InterviewStatus,
    Organization,
)
from app.modules.voice_runtime.orchestrator import VoiceSession
from app.modules.voice_runtime.prompts import SessionConfig

logger = logging.getLogger(__name__)
router = APIRouter()


async def _load_config(link_token: str) -> SessionConfig | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InterviewSession).where(InterviewSession.link_token == link_token)
        )
        session = result.scalar_one_or_none()
        if session is None or session.status in (
            InterviewStatus.COMPLETED,
            InterviewStatus.TERMINATED,
        ):
            return None

        candidate = (
            await db.execute(select(Candidate).where(Candidate.id == session.candidate_id))
        ).scalar_one_or_none()
        org = (
            await db.execute(select(Organization).where(Organization.id == session.org_id))
        ).scalar_one_or_none()
        skills = (
            (
                await db.execute(
                    select(CandidateSkill).where(
                        CandidateSkill.candidate_id == session.candidate_id
                    )
                )
            )
            .scalars()
            .all()
        )

        return SessionConfig(
            session_id=session.id,
            link_token=link_token,
            candidate_name=candidate.name if candidate else "Candidate",
            applied_role=(candidate.applied_role or "") if candidate else "",
            org_name=org.name if org else "",
            skills=[s.skill for s in skills],
            difficulty=session.difficulty or "Medium",
            personality=session.ai_personality or "Neutral",
            interview_type=session.interview_type or "Technical",
            duration_minutes=session.duration_minutes or 30,
        )


@router.websocket("/ws/interview/{link_token}")
async def interview_websocket(websocket: WebSocket, link_token: str):
    await websocket.accept()
    try:
        cfg = await _load_config(link_token)
    except Exception:
        logger.exception("Failed to load interview session for voice WS")
        await websocket.close(code=1011, reason="Failed to load interview session")
        return

    if cfg is None:
        await websocket.close(code=4404, reason="Invalid or expired interview link")
        return

    await VoiceSession(websocket, cfg).run()
