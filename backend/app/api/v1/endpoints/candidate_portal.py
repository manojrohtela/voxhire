"""
Candidate portal — self-service accounts so a candidate can track their
applications across every org they applied to.

Identity = email (immutable). A CandidateAccount aggregates all Candidate rows
sharing that email. Candidates see UPCOMING interviews/screenings and a
CANDIDATE-SAFE view of past interview results (strengths, areas to improve,
communication scores) — never the hire decision, internal rating, or proctoring
violations.

Signup is gated by a trusted token (the interview link_token or screening
invitation token) so the email is proven and locked.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import get_db
from app.db.models import (
    Candidate, CandidateAccount, InterviewSession, InterviewStatus,
    JobDescription, Organization, ScreeningInvitation,
)
from app.modules.auth.service import hash_password, verify_password

router = APIRouter()
bearer = HTTPBearer(auto_error=True)

CANDIDATE_TOKEN_TYPE = "candidate"


# ─── Auth helpers ──────────────────────────────────────────────

def _create_candidate_token(account: CandidateAccount) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    return jwt.encode(
        {"sub": account.id, "email": account.email, "type": CANDIDATE_TOKEN_TYPE, "exp": expire},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM,
    )


async def get_current_candidate(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> CandidateAccount:
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    if payload.get("type") != CANDIDATE_TOKEN_TYPE:
        raise HTTPException(401, "Not a candidate token")
    acct = (await db.execute(
        select(CandidateAccount).where(CandidateAccount.id == payload.get("sub"))
    )).scalar_one_or_none()
    if not acct:
        raise HTTPException(401, "Account not found")
    return acct


async def _candidate_from_token(db: AsyncSession, token: str) -> Optional[Candidate]:
    """Resolve a trusted signup token (interview link_token or screening token)
    to the candidate it belongs to."""
    sess = (await db.execute(
        select(InterviewSession).where(InterviewSession.link_token == token)
    )).scalar_one_or_none()
    if sess:
        return (await db.execute(select(Candidate).where(Candidate.id == sess.candidate_id))).scalar_one_or_none()
    inv = (await db.execute(
        select(ScreeningInvitation).where(ScreeningInvitation.token == token)
    )).scalar_one_or_none()
    if inv:
        return (await db.execute(select(Candidate).where(Candidate.id == inv.candidate_id))).scalar_one_or_none()
    return None


# ─── Schemas ───────────────────────────────────────────────────

class SignupBody(BaseModel):
    token: str           # interview link_token or screening invitation token
    name: str
    phone: str
    password: str

class LoginBody(BaseModel):
    email: str
    password: str


# ─── Prefill / signup / login ──────────────────────────────────

@router.get("/prefill/{token}")
async def prefill(token: str, db: AsyncSession = Depends(get_db)):
    """Prefill the signup form from the candidate behind a trusted token."""
    cand = await _candidate_from_token(db, token)
    if not cand:
        raise HTTPException(404, "Link not recognized")
    existing = (await db.execute(
        select(CandidateAccount).where(CandidateAccount.email == cand.email)
    )).scalar_one_or_none()
    return {
        "name": cand.name, "email": cand.email, "phone": cand.phone or "",
        "already_registered": existing is not None,
    }


@router.post("/signup", status_code=201)
async def signup(body: SignupBody, db: AsyncSession = Depends(get_db)):
    cand = await _candidate_from_token(db, body.token)
    if not cand:
        raise HTTPException(400, "Invalid signup link")
    email = cand.email  # locked — derived from the trusted token, never the client
    if not body.name.strip() or not body.phone.strip() or len(body.password) < 6:
        raise HTTPException(400, "Name, phone, and a 6+ char password are required")

    existing = (await db.execute(
        select(CandidateAccount).where(CandidateAccount.email == email)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "An account with this email already exists — please log in")

    acct = CandidateAccount(
        email=email, name=body.name.strip(), phone=body.phone.strip(),
        password_hash=hash_password(body.password),
    )
    db.add(acct)
    await db.commit()
    await db.refresh(acct)
    return {"access_token": _create_candidate_token(acct), "candidate": _acct_dict(acct)}


@router.post("/login")
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    acct = (await db.execute(
        select(CandidateAccount).where(CandidateAccount.email == body.email.strip().lower())
    )).scalar_one_or_none()
    # also try exact (in case emails weren't lowercased at signup)
    if not acct:
        acct = (await db.execute(
            select(CandidateAccount).where(CandidateAccount.email == body.email.strip())
        )).scalar_one_or_none()
    if not acct or not verify_password(body.password, acct.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return {"access_token": _create_candidate_token(acct), "candidate": _acct_dict(acct)}


@router.get("/me")
async def me(acct: CandidateAccount = Depends(get_current_candidate)):
    return _acct_dict(acct)


# ─── Portal (aggregated across orgs by email) ──────────────────

@router.get("/portal")
async def portal(acct: CandidateAccount = Depends(get_current_candidate), db: AsyncSession = Depends(get_db)):
    # All candidate rows sharing this email (one per org they applied to).
    cands = (await db.execute(
        select(Candidate).where(Candidate.email == acct.email)
    )).scalars().all()
    cand_ids = [c.id for c in cands]
    if not cand_ids:
        return {"upcoming": [], "past": []}

    orgs = {o.id: o.name for o in (await db.execute(select(Organization))).scalars().all()}
    jobs = {j.id: j.title for j in (await db.execute(select(JobDescription))).scalars().all()}

    sessions = (await db.execute(
        select(InterviewSession).where(InterviewSession.candidate_id.in_(cand_ids))
        .order_by(InterviewSession.created_at.desc())
    )).scalars().all()

    upcoming, past = [], []
    for s in sessions:
        base = {
            "type": "interview",
            "org": orgs.get(s.org_id, "A company"),
            "role": (s.custom_job_title or jobs.get(s.job_id) or "Interview"),
            "interview_type": s.interview_type or "Technical",
            "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
        }
        if s.status == InterviewStatus.SCHEDULED:
            upcoming.append({**base, "status": "scheduled", "join_url": s.interview_link})
        elif s.status == InterviewStatus.COMPLETED or s.evaluation_status == "complete":
            past.append({**base, **_candidate_safe_report(s)})

    # Active (unused, unexpired) screening invitations = upcoming screenings.
    now = datetime.now(timezone.utc)
    invites = (await db.execute(
        select(ScreeningInvitation).where(ScreeningInvitation.candidate_id.in_(cand_ids))
    )).scalars().all()
    for inv in invites:
        exp = inv.expires_at if inv.expires_at and inv.expires_at.tzinfo else (
            inv.expires_at.replace(tzinfo=timezone.utc) if inv.expires_at else None)
        if not inv.is_used and exp and exp > now:
            upcoming.append({
                "type": "screening", "status": "invited",
                "org": orgs.get(inv.org_id, "A company"),
                "role": jobs.get(inv.job_id) or "Screening call",
                "screening_url": f"{(settings.FRONTEND_URL or '').rstrip('/')}/screening/{inv.token}",
                "expires_at": exp.isoformat(),
            })

    return {"upcoming": upcoming, "past": past}


# ─── Serializers ───────────────────────────────────────────────

def _acct_dict(a: CandidateAccount) -> dict:
    return {"id": a.id, "email": a.email, "name": a.name, "phone": a.phone}


def _candidate_safe_report(s: InterviewSession) -> dict:
    """Constructive, candidate-facing view. Deliberately OMITS overall_rating /
    recommendation, proctoring violations, transcript, and resume-claim checks."""
    return {
        "status": "completed",
        "completed_at": (s.ended_at or s.created_at).isoformat() if (s.ended_at or s.created_at) else None,
        "interview_id": s.id,
        "scores": {
            "communication": s.communication_score,
            "confidence": s.confidence_score,
            "clarity": s.clarity_score,
        },
        "strengths": s.strengths or [],
        "areas_to_improve": s.weak_areas or [],
        "topics_covered": s.topics_covered or [],
        "report_ready": s.evaluation_status == "complete",
    }
