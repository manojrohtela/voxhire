"""
Real recruiting analytics for an organization — computed from the DB, not
estimated client-side. Powers the dashboard + the YC/customer "numbers".
"""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Candidate, InterviewSession, InterviewStatus, HiringDecision
from app.modules.auth.dependencies import get_current_user

router = APIRouter()

# Assume an AI interview saves a recruiter ~45 min of live screening time.
HOURS_SAVED_PER_INTERVIEW = 0.75


def _enum_val(v) -> str:
    return v.value if hasattr(v, "value") else (str(v) if v is not None else "Pending")


@router.get("/overview")
async def analytics_overview(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org = current_user["org_id"]

    candidates_total = (await db.execute(
        select(func.count()).select_from(Candidate).where(Candidate.org_id == org)
    )).scalar() or 0

    # Interview counts by status
    status_rows = (await db.execute(
        select(InterviewSession.status, func.count())
        .where(InterviewSession.org_id == org)
        .group_by(InterviewSession.status)
    )).all()
    by_status = { _enum_val(s).lower(): n for s, n in status_rows }
    iv_total = sum(by_status.values())
    completed = by_status.get("completed", 0)
    scheduled = by_status.get("scheduled", 0) + by_status.get("in_progress", 0)
    completion_rate = round(completed / iv_total * 100) if iv_total else 0

    # Candidate rating breakdown (real HiringDecision values)
    rating_rows = (await db.execute(
        select(Candidate.overall_rating, func.count())
        .where(Candidate.org_id == org)
        .group_by(Candidate.overall_rating)
    )).all()
    ratings = {"Strong Hire": 0, "Hire": 0, "Consider": 0, "Reject": 0, "Pending": 0}
    for r, n in rating_rows:
        key = _enum_val(r)
        ratings[key] = ratings.get(key, 0) + n

    # Average communication/confidence/clarity over completed interviews
    avg = (await db.execute(
        select(
            func.avg(InterviewSession.communication_score),
            func.avg(InterviewSession.confidence_score),
            func.avg(InterviewSession.clarity_score),
        ).where(
            InterviewSession.org_id == org,
            InterviewSession.communication_score.isnot(None),
        )
    )).first()
    avg_scores = {
        "communication": round(avg[0]) if avg and avg[0] is not None else None,
        "confidence": round(avg[1]) if avg and avg[1] is not None else None,
        "clarity": round(avg[2]) if avg and avg[2] is not None else None,
    }

    # Hiring funnel (real)
    screened = (await db.execute(
        select(func.count()).select_from(Candidate).where(
            Candidate.org_id == org,
            Candidate.screening_status.isnot(None),
            Candidate.screening_status.notin_(["not_contacted"]),
        )
    )).scalar() or 0
    interviewed = (await db.execute(
        select(func.count(func.distinct(InterviewSession.candidate_id))).where(
            InterviewSession.org_id == org,
            InterviewSession.status == InterviewStatus.COMPLETED,
        )
    )).scalar() or 0
    shortlisted = (ratings.get("Strong Hire", 0) + ratings.get("Hire", 0))

    # Interviews per week (last 8 weeks)
    since = datetime.now(timezone.utc) - timedelta(weeks=8)
    week_rows = (await db.execute(
        select(func.date_trunc("week", InterviewSession.created_at), func.count())
        .where(InterviewSession.org_id == org, InterviewSession.created_at >= since)
        .group_by(func.date_trunc("week", InterviewSession.created_at))
        .order_by(func.date_trunc("week", InterviewSession.created_at))
    )).all()
    interviews_by_week = [
        {"week": (w.date().isoformat() if hasattr(w, "date") else str(w)), "count": n}
        for w, n in week_rows
    ]

    return {
        "candidates_total": candidates_total,
        "interviews": {
            "total": iv_total, "completed": completed, "scheduled": scheduled,
            "completion_rate": completion_rate,
        },
        "ratings": ratings,
        "avg_scores": avg_scores,
        "funnel": {
            "applied": candidates_total, "screened": screened,
            "interviewed": interviewed, "shortlisted": shortlisted,
        },
        "hours_saved": round(completed * HOURS_SAVED_PER_INTERVIEW, 1),
        "interviews_by_week": interviews_by_week,
    }
