"""
Auth API endpoints.
POST /api/v1/auth/signup     — Create org + admin
POST /api/v1/auth/login      — Login
POST /api/v1/auth/refresh    — Refresh access token
GET  /api/v1/auth/me         — Get current user
POST /api/v1/auth/invite     — Invite recruiter (admin only)
POST /api/v1/auth/accept     — Accept invite + set password
GET  /api/v1/auth/recruiters — List org recruiters (admin only)
"""

from fastapi import APIRouter, HTTPException, Depends, status

from app.modules.auth import service
from app.modules.auth.models import (
    OrgSignupRequest, LoginRequest, InviteRecruiterRequest,
    AcceptInviteRequest, RefreshTokenRequest,
    TokenResponse, InviteResponse, MessageResponse, UserResponse, OrgResponse,
)
from app.modules.auth.dependencies import get_current_user, require_org_admin
from app.modules.auth.service import decode_token, get_user_by_id, build_token_response

router = APIRouter()

BASE_URL = "https://voxhire.vercel.app"  # update in prod via env


# ─── Org Signup ────────────────────────────────────────────────
@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(body: OrgSignupRequest):
    """Create a new organization and admin account."""
    try:
        user = service.create_org_and_admin(
            org_name=body.org_name,
            admin_name=body.admin_name,
            email=body.email,
            password=body.password,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return service.build_token_response(user)


# ─── Login ─────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    """Login with email + password."""
    try:
        user = service.login_user(email=body.email, password=body.password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    return service.build_token_response(user)


# ─── Refresh Token ─────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshTokenRequest):
    """Exchange refresh token for new access token."""
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return build_token_response(user)


# ─── Me ────────────────────────────────────────────────────────
@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    """Get current user info."""
    org = service.get_org_by_id(current_user["org_id"])
    return {
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user["role"],
        "org": {
            "id": org["id"],
            "name": org["name"],
            "slug": org["slug"],
        },
    }


# ─── Invite Recruiter ──────────────────────────────────────────
@router.post("/invite", response_model=InviteResponse)
def invite_recruiter(
    body: InviteRecruiterRequest,
    admin: dict = Depends(require_org_admin),
):
    """Admin invites a recruiter to their org."""
    try:
        invite = service.create_invite(
            org_id=admin["org_id"],
            invited_by=admin["id"],
            email=body.email,
            name=body.name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    invite_link = f"{BASE_URL}/auth/accept?token={invite['token']}"
    return {
        "invite_token": invite["token"],
        "email": invite["email"],
        "invite_link": invite_link,
        "message": f"Invite created for {body.email}. In production, this link would be emailed automatically.",
    }


# ─── Accept Invite ─────────────────────────────────────────────
@router.post("/accept", response_model=TokenResponse)
def accept_invite(body: AcceptInviteRequest):
    """Accept an invite and create recruiter account."""
    try:
        user = service.accept_invite(
            token=body.token,
            name=body.name,
            password=body.password,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return build_token_response(user)


# ─── List Recruiters ───────────────────────────────────────────
@router.get("/recruiters")
def list_recruiters(admin: dict = Depends(require_org_admin)):
    """Get all recruiters in the org."""
    recruiters = service.get_org_recruiters(admin["org_id"])
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "email": r["email"],
            "role": r["role"],
            "created_at": r["created_at"],
        }
        for r in recruiters
    ]
