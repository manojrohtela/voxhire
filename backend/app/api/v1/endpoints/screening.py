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
from app.core.email import send_screening_invitation, send_interview_invitation
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


# ─── Shared processing helper ──────────────────────────────────

_IST = timezone(timedelta(hours=5, minutes=30))


_WEEKDAY_MAP = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6,
}


def _resolve_relative_date(availability_text: str, call_ended_at: datetime) -> Optional[datetime]:
    """
    Convert natural-language availability to an absolute UTC datetime.
    Candidate times are always treated as IST (all clients are India-based).
    Returns None if the resolved date is in the past or unrecognisable.

    Handles:
      "today", "tomorrow", "day after tomorrow"
      "this friday", "friday", "next friday"
      "next monday at 10 am", "saturday 3 pm", etc.
    """
    if not availability_text:
        return None
    import re
    text = availability_text.lower().strip()
    base_utc = call_ended_at.replace(tzinfo=timezone.utc) if call_ended_at.tzinfo is None else call_ended_at.astimezone(timezone.utc)
    base_ist = base_utc.astimezone(_IST)

    # ── Extract time (e.g. "4 pm", "10 am", "11:30 am", "16:00") ─────────────
    # NOTE: capture optional minutes BEFORE am/pm, else "11:30 am" matches the
    # "30" as the hour → hour=30 → ValueError. (This 500'd the webhook.)
    hour, minute = None, 0
    m = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)', text)
    if m:
        h = int(m.group(1))
        minute = int(m.group(2)) if m.group(2) else 0
        if m.group(3) == "pm" and h != 12:
            h += 12
        elif m.group(3) == "am" and h == 12:
            h = 0
        hour = h
    else:
        m2 = re.search(r'(\d{1,2}):(\d{2})', text)
        if m2:
            hour, minute = int(m2.group(1)), int(m2.group(2))

    # Defensive: never let a malformed time crash the webhook. An out-of-range
    # hour falls back to the 10:00 default (via `hour or 10` below).
    if hour is not None and not (0 <= hour <= 23):
        hour = None
    if not (0 <= minute <= 59):
        minute = 0

    # ── Resolve day ───────────────────────────────────────────────────────────
    day_ist = None

    if "today" in text:
        day_ist = base_ist.replace(hour=hour or 10, minute=minute, second=0, microsecond=0)

    elif "day after tomorrow" in text or "day after" in text:
        day_ist = (base_ist + timedelta(days=2)).replace(hour=hour or 10, minute=minute, second=0, microsecond=0)

    elif "tomorrow" in text:
        day_ist = (base_ist + timedelta(days=1)).replace(hour=hour or 10, minute=minute, second=0, microsecond=0)

    else:
        # Look for a weekday name
        for name, target_wd in _WEEKDAY_MAP.items():
            if name in text:
                current_wd = base_ist.weekday()          # Monday=0 … Sunday=6
                days_ahead = (target_wd - current_wd) % 7

                if "next" in text or "next week" in text:
                    # "next friday" = the Friday of the FOLLOWING week,
                    # not the nearest upcoming Friday this week.
                    if days_ahead == 0:
                        days_ahead = 7   # same weekday → jump one full week
                    else:
                        days_ahead += 7  # e.g. Thu→Fri = 1 day, but "next fri" = 8 days
                else:
                    # "this friday" or bare "friday" = nearest future occurrence
                    if days_ahead == 0:
                        days_ahead = 7   # same weekday today → next week

                day_ist = (base_ist + timedelta(days=days_ahead)).replace(
                    hour=hour or 10, minute=minute, second=0, microsecond=0
                )
                break

    if day_ist is None:
        # Completely unrecognisable — don't auto-schedule
        return None

    resolved_utc = day_ist.astimezone(timezone.utc)
    if resolved_utc <= datetime.now(timezone.utc):
        return None  # Past — do not auto-schedule
    return resolved_utc


async def _process_screening_result(
    *,
    db: AsyncSession,
    sc: ScreeningCall,
    candidate,
    resolved_outcome: str,
    screening_completed: bool,
    structured: dict,
    ended_reason: str,
):
    """Populate ScreeningCall fields and drive candidate/interview state."""
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

    # Expire the related screening invitation immediately after the call ends
    if sc.id:
        inv_result = await db.execute(
            select(ScreeningInvitation).where(ScreeningInvitation.screening_call_id == sc.id)
        )
        inv = inv_result.scalar_one_or_none()
        if inv:
            inv.is_used = True

    if resolved_outcome == "COMPLETED":
        candidate.screening_status = ScreeningStatus.COMPLETED.value
        await _add_event(db, candidate.id, ScreeningEventType.SCREENING_COMPLETED.value, sc.id, {
            "callOutcome": resolved_outcome,
            "callSummary": structured.get("callSummary", ""),
            "interviewAvailability": sc.interview_availability,
            "candidateIntent": sc.candidate_intent,
        })

        candidate_available = bool(structured.get("candidateAvailableForInterview", False))
        if candidate_available:
            # Validate the requested time is in the future. Never let date parsing
            # crash the webhook — a failure here must not undo the COMPLETED status.
            try:
                resolved_dt = _resolve_relative_date(sc.interview_availability, sc.ended_at or _utcnow())
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning("availability parse failed (%r): %s", sc.interview_availability, exc)
                resolved_dt = None
            # If the candidate gave a specific time but it resolved to the past, skip auto-schedule
            past_blocked = (resolved_dt is None and bool(sc.interview_availability))
            if past_blocked:
                import logging
                logging.getLogger(__name__).warning(
                    "Interview availability '%s' resolved to past — skipping auto-schedule",
                    sc.interview_availability,
                )
            if not past_blocked:
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
                        scheduled_at=resolved_dt,
                    )
                    db.add(interview)
                    await db.flush()

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
                        "scheduledAt": resolved_dt.isoformat() if resolved_dt else None,
                    })

                    # Auto-send interview invitation email to candidate
                    if candidate.email:
                        org_result = await db.execute(
                            select(Organization).where(Organization.id == sc.org_id)
                        ) if sc.org_id else None
                        org = org_result.scalar_one_or_none() if org_result else None
                        job_result = await db.execute(
                            select(JobDescription).where(JobDescription.id == sc.job_id)
                        ) if sc.job_id else None
                        job = job_result.scalar_one_or_none() if job_result else None
                        send_interview_invitation(
                            to_email=candidate.email,
                            candidate_name=candidate.name,
                            org_name=org.name if org else "VoxHire",
                            job_title=job.title if job else None,
                            interview_url=interview.interview_link,
                            interview_availability=sc.interview_availability,
                        )
                except Exception as exc:
                    import logging
                    logging.getLogger(__name__).error("Failed to auto-schedule interview: %s", exc)

    elif resolved_outcome == "CALLBACK_REQUESTED":
        candidate.screening_status = ScreeningStatus.CALLBACK_REQUESTED.value
        await _add_event(db, candidate.id, ScreeningEventType.CALLBACK_REQUESTED.value, sc.id, {
            "callbackDate": sc.callback_date,
            "callbackTime": sc.callback_time,
            "additionalNotes": sc.additional_notes,
        })

    elif resolved_outcome == "DECLINED":
        candidate.screening_status = ScreeningStatus.DECLINED.value
        sc.decline_timestamp = _utcnow()
        sc.candidate_intent = "Not Interested"
        await _add_event(db, candidate.id, ScreeningEventType.DECLINED.value, sc.id, {
            "additionalNotes": sc.additional_notes,
            "candidateQuestion": sc.candidate_question,
        })

    elif resolved_outcome == "CALL_DROPPED":
        candidate.screening_status = ScreeningStatus.CALL_DROPPED.value
        if not screening_completed and any([sc.work_mode, sc.current_ctc, sc.current_role, sc.total_experience]):
            candidate.screening_status = ScreeningStatus.PARTIALLY_COMPLETED.value
        await _add_event(db, candidate.id, ScreeningEventType.CALL_DROPPED.value, sc.id, {
            "endedReason": ended_reason,
            "partialData": screening_completed,
        })

    elif resolved_outcome == "NO_ANSWER":
        candidate.screening_status = ScreeningStatus.NO_ANSWER.value
        await _add_event(db, candidate.id, ScreeningEventType.NO_ANSWER.value, sc.id, {
            "attemptNumber": sc.attempt_number,
            "endedReason": ended_reason,
        })


# ─── Webhook ───────────────────────────────────────────────────

# Field names we expect inside a screening structured-data result.
_SCREENING_FIELDS = {
    "callOutcome", "screeningCompleted", "workMode", "currentCTC", "currentRole",
    "expectedCTC", "callbackDate", "callbackTime", "noticePeriod", "additionalNotes",
    "candidateIntent", "totalExperience", "interviewAvailability", "candidateQuestion",
    "callSummary", "candidateAvailableForInterview",
}


def _extract_structured_data(message: dict) -> dict:
    """
    Pull screening fields out of a Vapi end-of-call report, tolerant of every
    shape Vapi uses depending on assistant config:
      - analysis.structuredData       → flat {field: value}, or wrapped {id: {name, result}}
      - analysis.structuredDataMulti  → [{name, result}] OR {id: {name, result}}
      - artifact.structuredOutputs    → {stepId: {name, result}}
    Merges every discovered result object into one flat dict.
    """
    analysis = message.get("analysis") or {}
    merged: dict = {}

    def absorb(obj) -> None:
        if not isinstance(obj, dict):
            return
        if isinstance(obj.get("result"), dict):
            merged.update(obj["result"])
        elif _SCREENING_FIELDS & obj.keys():
            merged.update(obj)
        else:
            # Wrapper keyed by id whose values are {name, result} / flat results.
            for v in obj.values():
                if isinstance(v, dict):
                    absorb(v)

    # 1. Flat (or wrapped) structuredData
    absorb(analysis.get("structuredData"))

    # 2. structuredDataMulti — list or id-keyed dict of {name, result}
    sdm = analysis.get("structuredDataMulti")
    if isinstance(sdm, list):
        for item in sdm:
            absorb(item)
    elif isinstance(sdm, dict):
        absorb(sdm)

    # 3. Fallback: artifact.structuredOutputs
    if not merged:
        artifact = message.get("artifact") or {}
        absorb(artifact.get("structuredOutputs"))

    return merged


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

    # Extract structured data — tolerant of structuredData / structuredDataMulti /
    # artifact.structuredOutputs, flat or {id: {name, result}} wrapped.
    structured = _extract_structured_data(message)

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
    elif ended_reason in ("customer-hangup", "call-hangup", "customer-ended-call", "connection-error", "pipeline-error", "assistant-error"):
        # customer-ended-call = candidate hung up normally after completing the call
        resolved_outcome = "CALL_DROPPED" if not screening_completed else "COMPLETED"
    else:
        # Partial — call ended without structured output
        resolved_outcome = "CALL_DROPPED" if not screening_completed else "COMPLETED"

    # Find matching ScreeningCall — look up by vapi_call_id, or by metadata.screeningCallId
    # Web SDK passes metadata inside assistantOverrides; server-side Vapi puts it in call.metadata
    call_obj = message.get("call") or {}
    metadata = call_obj.get("metadata", {}) or {}
    if not metadata:
        metadata = (call_obj.get("assistantOverrides") or {}).get("metadata", {}) or {}
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

    # Store the Vapi call ID
    sc.vapi_call_id = vapi_call_id or sc.vapi_call_id

    await _process_screening_result(
        db=db, sc=sc, candidate=candidate,
        resolved_outcome=resolved_outcome,
        screening_completed=screening_completed,
        structured=structured,
        ended_reason=ended_reason,
    )
    await db.commit()
    return {"received": True, "outcome": resolved_outcome}


# ─── GET screening history ──────────────────────────────────────

@router.get("/{candidate_id}")
async def get_screening_history(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user["org_id"],
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
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user["org_id"],
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
        org_id=current_user["org_id"],
        initiated_by=current_user["id"],
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
        "initiatedBy": current_user["name"],
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
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user["org_id"],
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
    current_user: dict = Depends(get_current_user),
):
    """
    Recruiter sends a web-based screening link to the candidate.
    Creates a ScreeningInvitation with a secure token and optionally emails it.
    """
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user["org_id"],
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
    org_result = await db.execute(select(Organization).where(Organization.id == current_user["org_id"]))
    org = org_result.scalar_one_or_none()
    org_name = org.name if org else "VoxHire"

    # Create ScreeningCall record (no vapi_call_id yet — will be set when call starts)
    candidate.screening_attempt_count = (candidate.screening_attempt_count or 0) + 1
    candidate.last_screening_attempt_at = _utcnow()
    candidate.screening_status = ScreeningStatus.LINK_SENT.value

    sc = ScreeningCall(
        candidate_id=candidate_id,
        org_id=current_user["org_id"],
        initiated_by=current_user["id"],
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
        org_id=current_user["org_id"],
        sent_by=current_user["id"],
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
        "sentBy": current_user["name"],
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
    # Dev / demo test harness — /screening/test exercises the real Vapi screening
    # flow with no DB invitation, mirroring /interview/test.
    if token == "test":
        return {
            "is_expired": False,
            "already_completed": False,
            "candidate_name": "Test Candidate",
            "candidate_email": "test@voxhire.ai",
            "org_name": "VoxHire Dev",
            "org_logo_url": None,
            "job_title": "Software Engineer",
            "expires_at": (_utcnow() + timedelta(days=1)).isoformat(),
        }

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
    # Test harness — return the screening assistant config without DB writes.
    if token == "test":
        return {
            "screening_call_id": "test",
            "vapi_public_key": settings.VAPI_PUBLIC_KEY,
            "vapi_assistant_id": settings.VAPI_ASSISTANT_ID,
            "metadata": {"screeningCallId": "test", "test": True},
            "max_duration_seconds": 5 * 60,  # demo cap so testers can't run long sessions
        }

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


# ─── POST public: store vapi_call_id when call starts ─────────

@router.post("/invite/{token}/call-started", status_code=200)
async def invite_call_started(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — called by the screening page immediately after vapi.start()
    returns. Stores the Vapi call ID on the ScreeningCall so the server-side
    webhook can find it by vapi_call_id later.
    """
    body = await request.json()
    vapi_call_id = body.get("vapi_call_id", "")
    if not vapi_call_id:
        return {"ok": False, "reason": "missing vapi_call_id"}

    result = await db.execute(
        select(ScreeningInvitation).where(ScreeningInvitation.token == token)
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        return {"ok": False, "reason": "invalid token"}

    if inv.screening_call_id:
        sc_result = await db.execute(
            select(ScreeningCall).where(ScreeningCall.id == inv.screening_call_id)
        )
        sc = sc_result.scalar_one_or_none()
        if sc and not sc.vapi_call_id:
            sc.vapi_call_id = vapi_call_id
            await db.commit()

    return {"ok": True}


# ─── POST public: frontend-forwarded end-of-call-report ──────

class _InviteCompleteRequest(BaseModel):
    message: dict


@router.post("/invite/{token}/complete", status_code=200)
async def invite_call_complete(
    token: str,
    body: _InviteCompleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — called by the screening page when the Vapi SDK fires
    end-of-call-report. Uses the invitation token as auth (no Vapi secret needed).
    Processes structured output and auto-schedules interview if eligible.
    """
    result = await db.execute(
        select(ScreeningInvitation).where(ScreeningInvitation.token == token)
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=404, detail="Invalid screening link")

    message = body.message
    message_type = message.get("type", "")
    if message_type != "end-of-call-report":
        return {"received": True}

    # Find the ScreeningCall for this invitation
    sc: Optional[ScreeningCall] = None
    if inv.screening_call_id:
        sc_result = await db.execute(
            select(ScreeningCall).where(ScreeningCall.id == inv.screening_call_id)
        )
        sc = sc_result.scalar_one_or_none()

    if sc is None:
        return {"received": True, "warning": "No screening call found for this invitation"}

    # Avoid double-processing
    if sc.screening_completed:
        return {"received": True, "already_processed": True}

    # Build a synthetic payload and delegate to the shared processor
    vapi_call_id = (message.get("call") or {}).get("id") or ""
    if vapi_call_id and not sc.vapi_call_id:
        sc.vapi_call_id = vapi_call_id

    ended_reason = message.get("endedReason", "")
    analysis = message.get("analysis", {}) or {}
    structured = analysis.get("structuredData", {}) or {}
    if not structured:
        artifact = message.get("artifact", {}) or {}
        for val in (artifact.get("structuredOutputs", {}) or {}).values():
            if isinstance(val, dict) and "result" in val:
                structured = val["result"]
                break
    if structured and not structured.get("callOutcome") and not structured.get("screeningCompleted"):
        for val in structured.values():
            if isinstance(val, dict) and "result" in val:
                structured = val["result"]
                break

    call_outcome = structured.get("callOutcome", "")
    screening_completed = bool(structured.get("screeningCompleted", False))

    if call_outcome == "COMPLETED":
        resolved_outcome = "COMPLETED"
    elif call_outcome == "CALLBACK_REQUESTED":
        resolved_outcome = "CALLBACK_REQUESTED"
    elif call_outcome == "DECLINED":
        resolved_outcome = "DECLINED"
    elif ended_reason in ("customer-did-not-answer", "no-answer"):
        resolved_outcome = "NO_ANSWER"
    else:
        resolved_outcome = "CALL_DROPPED" if not screening_completed else "COMPLETED"

    candidate_result = await db.execute(select(Candidate).where(Candidate.id == sc.candidate_id))
    candidate = candidate_result.scalar_one_or_none()
    if candidate is None:
        return {"received": True, "warning": "Candidate not found"}

    await _process_screening_result(
        db=db, sc=sc, candidate=candidate,
        resolved_outcome=resolved_outcome,
        screening_completed=screening_completed,
        structured=structured,
        ended_reason=ended_reason,
    )
    inv.is_used = True
    await db.commit()
    return {"received": True, "outcome": resolved_outcome}
