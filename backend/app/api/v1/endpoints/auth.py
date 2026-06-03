"""
Auth API endpoints — DB-backed.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.modules.auth import service
from app.modules.auth.models import (
    OrgSignupRequest, LoginRequest, InviteRecruiterRequest,
    AcceptInviteRequest, RefreshTokenRequest, TokenResponse, InviteResponse,
)
from app.modules.auth.dependencies import get_current_user, require_org_admin

router = APIRouter()
BASE_URL = "https://voxhire.vercel.app"


@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(body: OrgSignupRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await service.create_org_and_admin(db, body.org_name, body.admin_name, body.email, body.password)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    return await service.build_token_response(db, user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await service.login_user(db, body.email, body.password)
    except ValueError as e:
        raise HTTPException(401, detail=str(e))
    return await service.build_token_response(db, user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    payload = service.decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(401, detail="Invalid refresh token")
    user = await service.get_user_by_id(db, payload["sub"])
    if not user:
        raise HTTPException(401, detail="User not found")
    return await service.build_token_response(db, user)


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org = await service.get_org_by_id(db, current_user["org_id"])
    return {"id": current_user["id"], "name": current_user["name"],
            "email": current_user["email"], "role": current_user["role"],
            "org": {"id": org.id, "name": org.name, "slug": org.slug}}


@router.post("/invite", response_model=InviteResponse)
async def invite_recruiter(body: InviteRecruiterRequest, admin: dict = Depends(require_org_admin), db: AsyncSession = Depends(get_db)):
    try:
        invite = await service.create_invite(db, admin["org_id"], admin["id"], body.email, body.name)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    return {
        "invite_token": invite.token,
        "email": invite.email,
        "invite_link": f"{BASE_URL}/auth/accept?token={invite.token}",
        "message": f"Invite created for {body.email}.",
    }


@router.post("/accept", response_model=TokenResponse)
async def accept_invite(body: AcceptInviteRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await service.accept_invite(db, body.token, body.name, body.password)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    return await service.build_token_response(db, user)


@router.get("/recruiters")
async def list_recruiters(admin: dict = Depends(require_org_admin), db: AsyncSession = Depends(get_db)):
    recruiters = await service.get_org_recruiters(db, admin["org_id"])
    return [{"id": r.id, "name": r.name, "email": r.email, "role": r.role, "created_at": r.created_at} for r in recruiters]
