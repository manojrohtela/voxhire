"""
Vapi Screening Call lifecycle endpoints.

Webhook flow:
  Vapi → POST /screening/webhook  (unauthenticated, verified via secret header)

Web-link screening flow (MVP):
  POST   /screening/{candidate_id}/send-invitation  → recruiter sends link via email
  GET    /screening/invite/{token}                  → public — validate + return context for screening page
  POST   /screening/invite/{token}/start            → public — candidate starts, returns Vapi config

Outbound phone flow (legacy):
  POST   /screening/{candidate_id}/initiate   → trigger outbound Vapi call
  POST   /screening/{candidate_id}/retry      → retry for NO_ANSWER / CALL_DROPPED
  GET    /screening/{candidate_id}            → full screening history + timeline
"""

import secrets
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.database import get_db
from app.db.models import (
    Candidate, Organization, JobDescription,
    ScreeningCall, ScreeningEvent, ScreeningInvitation,
    ScreeningEventType, ScreeningStatus,
    InterviewSession, InterviewStatus,
    CandidateJob, CandidateJobStatus,
    User,
)
from app.core.config import settings
from app.core.email import send_screening_invitation
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


# ─── helpers ───────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _add_event(
    db: AsyncSession,
    candidate_id: str,
    event_type: str,
    screening_call_id: Optional[str] = None,
    event_data: Optional[dict] = None,
) -> ScreeningEvent:
    ev = ScreeningEvent(
        candidate_id=candidate_id,
        screening_call_id=screening_call_id,
        event_type=event_type,
        event_data=event_data or {},
    )
    db.add(ev)
    return ev


def _call_to_dict(sc: ScreeningCall) -> dict:
    return {
        "id": sc.id,
        "vapi_call_id": sc.vapi_call_id,
        "attempt_number": sc.attempt_number,
        "call_outcome": sc.call_outcome,
        "job_id": sc.job_id,
        "screening_completed": sc.screening_completed,
        "work_mode": sc.work_mode,
        "current_ctc": sc.current_ctc,
        "current_role": sc.current_role,
        "expected_ctc": sc.expected_ctc,
        "callback_date": sc.callback_date,
        "callback_time": sc.callback_time,
        "notice_period": sc.notice_period,
        "additional_notes": sc.additional_notes,
        "candidate_intent": sc.candidate_intent,
        "total_experience": sc.total_experience,
        "interview_availability": sc.interview_availability,
        "candidate_question": sc.candidate_question,
        "initiated_at": sc.initiated_at.isoformat() if sc.initiated_at else None,
        "ended_at": sc.ended_at.isoformat() if sc.ended_at else None,
        "decline_timestamp": sc.decline_timestamp.isoformat() if sc.decline_timestamp else None,
        "created_at": sc.created_at.isoformat() if sc.created_at else None,
    }


def _event_to_dict(ev: ScreeningEvent) -> dict:
    return {
        "id": ev.id,
        "event_type": ev.event_type,
        "event_data": ev.event_data,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
    }


# ─── Webhook ───────────────────────────────────────────────────

@router.post("/webhook", status_code=200)
async def vapi_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_vapi_secret: Optional[str] = Header(None),
):
    """
    Vapi posts end-of-call-report here when a screening call ends.
    Configure Vapi to send to: POST /api/v1/screening/webhook
    """
    # Verify shared secret if configured
    if settings.VAPI_WEBHOOK_SECRET:
        if x_vapi_secret != settings.VAPI_WEBHOOK_SECRET:
            raise HTTPException(status_code=403, detail="Invalid webhook secret")

    payload = await request.json()
    message = payload.get("message", payload)   # Vapi wraps in "message" key
    message_type = message.get("type", "")

    # Only handle end-of-call-report
    if message_type != "end-of-call-report":
        return {"received": True}

    vapi_call_id = (message.get("call") or {}).get("id") or message.get("callId", "")
    ended_reason = message.get("endedReason", "")

    # Extract structured data (Vapi puts it under analysis.structuredData)
    analysis = message.get("analysis", {}) or {}
    structured = analysis.get("structuredData", {}) or {}

    # Vapi sometimes wraps structured data as {stepId: {name: "...", result: {...}}}
    # Unwrap if the top-level keys don't look like our field names
    if structured and not structured.get("callOutcome") and not structured.get("screeningCompleted"):
        for val in structured.values():
            if isinstance(val, dict) and "result" in val:
                structured = val["result"]
                break

    call_outcome = structured.get("callOutcome", "")
    screening_completed = bool(structured.get("screeningCompleted", False))

    # Resolve scenario from callOutcome + endedReason
    if call_outcome == "COMPLETED":
        resolved_outcome = "COMPLETED"
    elif call_outcome == "CALLBACK_REQUESTED":
        resolved_outcome = "CALLBACK_REQUESTED"
    elif call_outcome == "DECLINED":
        resolved_outcome = "DECLINED"
    elif ended_reason in ("customer-did-not-answer", "no-answer"):
        resolved_outcome = "NO_ANSWER"
    elif ended_reason in ("customer-hangup", "call-hangup", "connection-error", "pipeline-error", "assistant-error"):
        resolved_outcome = "CALL_DROPPED"
    else:
        # Partial — call ended without structured output
        resolved_outcome = "CALL_DROPPED" if not screening_completed else "COMPLETED"

    # Find matching ScreeningCall — look up by vapi_call_id, or by metadata.screeningCallId
    metadata = (message.get("call") or {}).get("metadata", {}) or {}
    screening_call_id_meta = metadata.get("screeningCallId")
    candidate_id_meta = metadata.get("candidateId")

    sc: Optional[ScreeningCall] = None

    if screening_call_id_meta:
        result = await db.execute(select(ScreeningCall).where(ScreeningCall.id == screening_call_id_meta))
        sc = result.scalar_one_or_none()

    if sc is None and vapi_call_id:
        result = await db.execute(select(ScreeningCall).where(ScreeningCall.vapi_call_id == vapi_call_id))
        sc = result.scalar_one_or_none()

    # If still not found, create a new record from metadata
    if sc is None and candidate_id_meta:
        result = await db.execute(select(Candidate).where(Candidate.id == candidate_id_meta))
        candidate = result.scalar_one_or_none()
        if candidate:
            count_result = await db.execute(
                select(func.count()).where(ScreeningCall.candidate_id == candidate_id_meta)
            )
            attempt_num = (count_result.scalar() or 0) + 1
            sc = ScreeningCall(
                candidate_id=candidate_id_meta,
                org_id=candidate.org_id,
                attempt_number=attempt_num,
                vapi_call_id=vapi_call_id or None,
            )
            db.add(sc)
            await db.flush()

    if sc is None:
        # No matching candidate — log and return
        return {"received": True, "warning": "No matching screening call found"}

    # Fetch candidate
    result = await db.execute(select(Candidate).where(Candidate.id == sc.candidate_id))
    candidate = result.scalar_one_or_none()
    if candidate is None:
        return {"received": True, "warning": "Candidate not found"}

    # Populate structured output fields
    sc.vapi_call_id = vapi_call_id or sc.vapi_call_id
    sc.call_outcome = resolved_outcome
    sc.screening_completed = screening_completed
    sc.ended_at = _utcnow()
    sc.work_mode = structured.get("workMode", "")
    sc.current_ctc = structured.get("currentCTC", "")
    sc.current_role = structured.get("currentRole", "")
    sc.expected_ctc = structured.get("expectedCTC", "")
    sc.callback_date = structured.get("callbackDate", "")
    sc.callback_time = structured.get("callbackTime", "")
    sc.notice_period = structured.get("noticePeriod", "")
    sc.additional_notes = structured.get("additionalNotes", "")
    sc.candidate_intent = structured.get("candidateIntent", "")
    sc.total_experience = structured.get("totalExperience", "")
    sc.interview_availability = structured.get("interviewAvailability", "")
    sc.candidate_question = structured.get("candidateQuestion", "")

    # ── SCENARIO 1: COMPLETED ──────────────────────────────────
    if resolved_outcome == "COMPLETED":
        candidate.screening_status = ScreeningStatus.COMPLETED.value
        await _add_event(db, candidate.id, ScreeningEventType.SCREENING_COMPLETED.value, sc.id, {
            "callOutcome": resolved_outcome,
            "callSummary": structured.get("callSummary", ""),
            "interviewAvailability": sc.interview_availability,
            "candidateIntent": sc.candidate_intent,
        })

        # Auto-schedule interview if candidate is available
        candidate_available = bool(structured.get("candidateAvailableForInterview", False))
        if candidate_available:
            try:
                link_token = str(uuid.uuid4()).replace("-", "")
                base_url = settings.FRONTEND_URL.rstrip("/")
                interview = InterviewSession(
                    id=str(uuid.uuid4()),
                    candidate_id=sc.candidate_id,
                    org_id=sc.org_id,
                    created_by=sc.initiated_by,
                    job_id=sc.job_id,
                    link_token=link_token,
                    interview_link=f"{base_url}/interview/{link_token}",
                    status=InterviewStatus.SCHEDULED,
                )
                db.add(interview)
                await db.flush()

                # Update candidate-job status to interview_scheduled
                if sc.job_id:
                    cj_result = await db.execute(
                        select(CandidateJob).where(
                            CandidateJob.candidate_id == sc.candidate_id,
                            CandidateJob.job_id == sc.job_id,
                        )
                    )
                    cj = cj_result.scalar_one_or_none()
                    if cj:
                        cj.status = CandidateJobStatus.INTERVIEW_SCHEDULED

                await _add_event(db, candidate.id, ScreeningEventType.INTERVIEW_SCHEDULED.value, sc.id, {
                    "interviewAvailability": sc.interview_availability,
                    "interviewLink": interview.interview_link,
                })
            except Exception as exc:
                # Log but don't fail — screening data must still be saved
                import logging
                logging.getLogger(__name__).error("Failed to auto-schedule interview: %s", exc)

    # ── SCENARIO 2: CALLBACK_REQUESTED ────────────────────────
    elif resolved_outcome == "CALLBACK_REQUESTED":
        candidate.screening_status = ScreeningStatus.CALLBACK_REQUESTED.value
        await _add_event(db, candidate.id, ScreeningEventType.CALLBACK_REQUESTED.value, sc.id, {
            "callbackDate": sc.callback_date,
            "callbackTime": sc.callback_time,
            "additionalNotes": sc.additional_notes,
        })

    # ── SCENARIO 3: DECLINED ───────────────────────────────────
    elif resolved_outcome == "DECLINED":
        candidate.screening_status = ScreeningStatus.DECLINED.value
        sc.decline_timestamp = _utcnow()
        sc.candidate_intent = "Not Interested"
        await _add_event(db, candidate.id, ScreeningEventType.DECLINED.value, sc.id, {
            "additionalNotes": sc.additional_notes,
            "candidateQuestion": sc.candidate_question,
        })

    # ── SCENARIO 4: CALL_DROPPED ───────────────────────────────
    elif resolved_outcome == "CALL_DROPPED":
        candidate.screening_status = ScreeningStatus.CALL_DROPPED.value
        if screening_completed is False and any([
            sc.work_mode, sc.current_ctc, sc.current_role, sc.total_experience
        ]):
            candidate.screening_status = ScreeningStatus.PARTIALLY_COMPLETED.value
        await _add_event(db, candidate.id, ScreeningEventType.CALL_DROPPED.value, sc.id, {
            "endedReason": ended_reason,
            "partialData": screening_completed,
        })

    # ── SCENARIO 5: NO_ANSWER ──────────────────────────────────
    elif resolved_outcome == "NO_ANSWER":
        candidate.screening_status = ScreeningStatus.NO_ANSWER.value
        await _add_event(db, candidate.id, ScreeningEventType.NO_ANSWER.value, sc.id, {
            "attemptNumber": sc.attempt_number,
            "endedReason": ended_reason,
        })

    await db.commit()
    return {"received": True, "outcome": resolved_outcome}


# ─── GET screening history ──────────────────────────────────────

@router.get("/{candidate_id}")
async def get_screening_history(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user.org_id,
        )
    )
    candidate = result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    calls_result = await db.execute(
        select(ScreeningCall)
        .where(ScreeningCall.candidate_id == candidate_id)
        .order_by(ScreeningCall.created_at.desc())
    )
    calls = calls_result.scalars().all()

    events_result = await db.execute(
        select(ScreeningEvent)
        .where(ScreeningEvent.candidate_id == candidate_id)
        .order_by(ScreeningEvent.created_at.desc())
    )
    events = events_result.scalars().all()

    latest_call = calls[0] if calls else None

    # Invitations
    invitations_result = await db.execute(
        select(ScreeningInvitation)
        .where(ScreeningInvitation.candidate_id == candidate_id)
        .order_by(ScreeningInvitation.created_at.desc())
    )
    invitations = invitations_result.scalars().all()

    # Auto-scheduled interview (created by webhook after screening completes)
    interview_result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.candidate_id == candidate_id)
        .order_by(InterviewSession.created_at.desc())
        .limit(1)
    )
    auto_interview = interview_result.scalar_one_or_none()

    base_url = settings.FRONTEND_URL.rstrip("/")

    return {
        "candidate_id": candidate_id,
        "screening_status": candidate.screening_status,
        "screening_attempt_count": candidate.screening_attempt_count,
        "last_screening_attempt_at": candidate.last_screening_attempt_at.isoformat() if candidate.last_screening_attempt_at else None,
        "latest_call": _call_to_dict(latest_call) if latest_call else None,
        "calls": [_call_to_dict(c) for c in calls],
        "timeline": [_event_to_dict(e) for e in events],
        "invitations": [_invitation_to_dict(inv, f"{base_url}/screening/{inv.token}") for inv in invitations],
        "latest_invitation": _invitation_to_dict(invitations[0], f"{base_url}/screening/{invitations[0].token}") if invitations else None,
        "auto_interview": {
            "id": auto_interview.id,
            "interview_link": auto_interview.interview_link,
            "status": auto_interview.status,
            "created_at": auto_interview.created_at.isoformat() if auto_interview.created_at else None,
        } if auto_interview else None,
    }


# ─── POST initiate screening call ──────────────────────────────

@router.post("/{candidate_id}/initiate", status_code=201)
async def initiate_screening(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user.org_id,
        )
    )
    candidate = result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if not candidate.phone:
        raise HTTPException(status_code=422, detail="Candidate has no phone number")

    # Increment attempt count
    candidate.screening_attempt_count = (candidate.screening_attempt_count or 0) + 1
    candidate.last_screening_attempt_at = _utcnow()
    candidate.screening_status = ScreeningStatus.CALLING.value

    # Create ScreeningCall record
    sc = ScreeningCall(
        candidate_id=candidate_id,
        org_id=current_user.org_id,
        initiated_by=current_user.id,
        attempt_number=candidate.screening_attempt_count,
        initiated_at=_utcnow(),
    )
    db.add(sc)
    await db.flush()  # get sc.id

    # Try to trigger Vapi outbound call if credentials configured
    vapi_call_id = None
    if settings.VAPI_API_KEY and settings.VAPI_ASSISTANT_ID:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.vapi.ai/call/phone",
                    headers={"Authorization": f"Bearer {settings.VAPI_API_KEY}"},
                    json={
                        "assistantId": settings.VAPI_ASSISTANT_ID,
                        "customer": {
                            "number": candidate.phone,
                            "name": candidate.name,
                        },
                        "metadata": {
                            "candidateId": candidate_id,
                            "screeningCallId": sc.id,
                        },
                    },
                )
                if resp.status_code in (200, 201):
                    vapi_data = resp.json()
                    vapi_call_id = vapi_data.get("id")
                    sc.vapi_call_id = vapi_call_id
        except Exception:
            pass  # Vapi call failed — record still created, recruiter can retry

    await _add_event(db, candidate_id, ScreeningEventType.SCREENING_INITIATED.value, sc.id, {
        "attemptNumber": sc.attempt_number,
        "vapiCallId": vapi_call_id,
        "initiatedBy": current_user.name,
    })

    await db.commit()

    return {
        "screening_call_id": sc.id,
        "vapi_call_id": vapi_call_id,
        "attempt_number": sc.attempt_number,
        "status": ScreeningStatus.CALLING.value,
        "message": "Screening call initiated" if vapi_call_id else "Record created — trigger Vapi call manually",
    }


# ─── POST retry screening call ─────────────────────────────────

@router.post("/{candidate_id}/retry", status_code=201)
async def retry_screening(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user.org_id,
        )
    )
    candidate = result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.screening_status not in (
        ScreeningStatus.NO_ANSWER.value,
        ScreeningStatus.CALL_DROPPED.value,
        ScreeningStatus.CALLBACK_REQUESTED.value,
        ScreeningStatus.PARTIALLY_COMPLETED.value,
    ):
        raise HTTPException(
            status_code=422,
            detail=f"Cannot retry from status '{candidate.screening_status}'. Retry is only for no_answer, call_dropped, callback_requested, or partially_completed.",
        )

    # Delegate to initiate (same logic)
    return await initiate_screening(candidate_id=candidate_id, db=db, current_user=current_user)


# ─── Invitation serialiser ──────────────────────────────────────

def _invitation_to_dict(inv: ScreeningInvitation, screening_url: str) -> dict:
    return {
        "id": inv.id,
        "token": inv.token,
        "candidate_email": inv.candidate_email,
        "job_id": inv.job_id,
        "screening_call_id": inv.screening_call_id,
        "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
        "is_used": inv.is_used,
        "started_at": inv.started_at.isoformat() if inv.started_at else None,
        "email_sent": inv.email_sent,
        "screening_url": screening_url,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
    }


# ─── POST send-invitation (web-link flow) ──────────────────────

class SendInvitationRequest(BaseModel):
    job_id: Optional[str] = None
    expires_in_hours: int = 72


@router.post("/{candidate_id}/send-invitation", status_code=201)
async def send_invitation(
    candidate_id: str,
    body: SendInvitationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recruiter sends a web-based screening link to the candidate.
    Creates a ScreeningInvitation with a secure token and optionally emails it.
    """
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user.org_id,
        )
    )
    candidate = result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if not candidate.email:
        raise HTTPException(status_code=422, detail="Candidate has no email address")

    # Resolve job title if job_id provided
    job_title: Optional[str] = None
    if body.job_id:
        job_result = await db.execute(
            select(JobDescription).where(JobDescription.id == body.job_id)
        )
        job = job_result.scalar_one_or_none()
        if job:
            job_title = job.title

    # Fetch org name
    org_result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_result.scalar_one_or_none()
    org_name = org.name if org else "VoxHire"

    # Create ScreeningCall record (no vapi_call_id yet — will be set when call starts)
    candidate.screening_attempt_count = (candidate.screening_attempt_count or 0) + 1
    candidate.last_screening_attempt_at = _utcnow()
    candidate.screening_status = ScreeningStatus.LINK_SENT.value

    sc = ScreeningCall(
        candidate_id=candidate_id,
        org_id=current_user.org_id,
        initiated_by=current_user.id,
        job_id=body.job_id,
        attempt_number=candidate.screening_attempt_count,
        initiated_at=_utcnow(),
    )
    db.add(sc)
    await db.flush()  # get sc.id

    # Generate invitation token and URL
    token = secrets.token_urlsafe(32)
    expires_at = _utcnow() + timedelta(hours=body.expires_in_hours)
    base_url = settings.FRONTEND_URL.rstrip("/")
    screening_url = f"{base_url}/screening/{token}"

    inv = ScreeningInvitation(
        token=token,
        candidate_id=candidate_id,
        org_id=current_user.org_id,
        sent_by=current_user.id,
        job_id=body.job_id,
        screening_call_id=sc.id,
        candidate_email=candidate.email,
        expires_at=expires_at,
    )
    db.add(inv)

    # Optionally send email
    email_sent = send_screening_invitation(
        to_email=candidate.email,
        candidate_name=candidate.name,
        org_name=org_name,
        job_title=job_title,
        screening_url=screening_url,
        expires_in_hours=body.expires_in_hours,
    )
    inv.email_sent = email_sent

    await _add_event(db, candidate_id, ScreeningEventType.INVITATION_SENT.value, sc.id, {
        "invitationToken": token,
        "jobTitle": job_title,
        "emailSent": email_sent,
        "sentBy": current_user.name,
    })

    await db.commit()
    await db.refresh(inv)

    return {
        **_invitation_to_dict(inv, screening_url),
        "email_sent": email_sent,
        "message": "Invitation sent via email" if email_sent else "Invitation created — copy the link to send manually (SMTP not configured)",
    }


# ─── GET public invite info ────────────────────────────────────

@router.get("/invite/{token}")
async def get_invite_info(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — candidate (or anyone with the link) calls this to load
    the screening page context: candidate name, org name, job title.
    """
    result = await db.execute(
        select(ScreeningInvitation).where(ScreeningInvitation.token == token)
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=404, detail="Invalid or expired screening link")

    now = _utcnow()
    is_expired = inv.expires_at < now
    already_completed = inv.is_used

    # Fetch candidate
    cand_result = await db.execute(select(Candidate).where(Candidate.id == inv.candidate_id))
    candidate = cand_result.scalar_one_or_none()

    # Fetch org
    org_result = await db.execute(select(Organization).where(Organization.id == inv.org_id))
    org = org_result.scalar_one_or_none()

    # Fetch job (if linked)
    job_title: Optional[str] = None
    if inv.job_id:
        job_result = await db.execute(select(JobDescription).where(JobDescription.id == inv.job_id))
        job = job_result.scalar_one_or_none()
        if job:
            job_title = job.title

    return {
        "is_expired": is_expired,
        "already_completed": already_completed,
        "candidate_name": candidate.name if candidate else "Candidate",
        "candidate_email": inv.candidate_email,
        "org_name": org.name if org else "VoxHire",
        "org_logo_url": org.logo_url if org else None,
        "job_title": job_title,
        "expires_at": inv.expires_at.isoformat(),
    }


# ─── POST public invite start ──────────────────────────────────

@router.post("/invite/{token}/start")
async def start_invite_screening(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — candidate clicks "Start Screening".
    Validates the token, marks invitation as started, returns Vapi config
    so the browser can launch the Vapi Web SDK.
    """
    result = await db.execute(
        select(ScreeningInvitation).where(ScreeningInvitation.token == token)
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=404, detail="Invalid screening link")

    now = _utcnow()
    if inv.expires_at < now:
        raise HTTPException(status_code=410, detail="This screening link has expired")

    if inv.is_used:
        raise HTTPException(status_code=410, detail="This screening has already been completed")

    # Mark invitation as started (idempotent — only set once)
    if inv.started_at is None:
        inv.started_at = now

    # Update the linked ScreeningCall
    sc: Optional[ScreeningCall] = None
    if inv.screening_call_id:
        sc_result = await db.execute(
            select(ScreeningCall).where(ScreeningCall.id == inv.screening_call_id)
        )
        sc = sc_result.scalar_one_or_none()

    if sc is None:
        # Fallback: create a call record if somehow missing
        cand_result = await db.execute(select(Candidate).where(Candidate.id == inv.candidate_id))
        candidate = cand_result.scalar_one_or_none()
        sc = ScreeningCall(
            candidate_id=inv.candidate_id,
            org_id=inv.org_id,
            job_id=inv.job_id,
            attempt_number=1,
            initiated_at=now,
        )
        db.add(sc)
        await db.flush()
        inv.screening_call_id = sc.id

    # Update candidate status to CALLING
    cand_result = await db.execute(select(Candidate).where(Candidate.id == inv.candidate_id))
    candidate = cand_result.scalar_one_or_none()
    if candidate:
        candidate.screening_status = ScreeningStatus.CALLING.value
        candidate.last_screening_attempt_at = now

    await _add_event(db, inv.candidate_id, ScreeningEventType.SCREENING_INITIATED.value, sc.id, {
        "via": "web_link",
        "invitationToken": token,
    })

    await db.commit()

    # Return Vapi Web SDK config — frontend uses this to start the call
    metadata = {
        "screeningCallId": sc.id,
        "candidateId": inv.candidate_id,
        "orgId": inv.org_id,
    }
    if inv.job_id:
        metadata["jobId"] = inv.job_id

    return {
        "screening_call_id": sc.id,
        "vapi_public_key": settings.VAPI_PUBLIC_KEY,
        "vapi_assistant_id": settings.VAPI_ASSISTANT_ID,
        "metadata": metadata,
    }
