"""
Super-admin endpoints — manage organizations across the platform.
Requires super_admin role.
"""

import uuid
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.db.database import get_db
from app.db.models import Organization, User, InterviewSession, Candidate, UserRole
from app.modules.auth.dependencies import require_super_admin
from app.modules.auth.service import create_org_and_admin, hash_password
from app.core.config import settings

router = APIRouter()


class CreateOrgBody(BaseModel):
    org_name: str
    admin_email: EmailStr
    admin_password: str

class UpdateOrgBody(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None

class BootstrapBody(BaseModel):
    seed_key: str
    name: str
    email: EmailStr
    password: str


@router.get("/stats")
async def platform_stats(
    _: dict = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    orgs     = (await db.execute(select(func.count()).select_from(Organization))).scalar()
    users    = (await db.execute(select(func.count()).select_from(User))).scalar()
    sessions = (await db.execute(select(func.count()).select_from(InterviewSession))).scalar()
    cands    = (await db.execute(select(func.count()).select_from(Candidate))).scalar()
    return {"organizations": orgs, "users": users, "interviews": sessions, "candidates": cands}


@router.get("/orgs")
async def list_orgs(
    _: dict = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).order_by(Organization.created_at.desc()))
    orgs = result.scalars().all()

    out = []
    for org in orgs:
        users = (await db.execute(
            select(func.count()).select_from(User).where(User.org_id == org.id)
        )).scalar()
        sessions = (await db.execute(
            select(func.count()).select_from(InterviewSession).where(InterviewSession.org_id == org.id)
        )).scalar()
        out.append({
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "is_active": org.is_active,
            "created_at": org.created_at,
            "users": users,
            "interviews": sessions,
        })
    return out


@router.post("/orgs", status_code=201)
async def create_org(
    body: CreateOrgBody,
    _: dict = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await create_org_and_admin(
            db, body.org_name, body.org_name, body.admin_email, body.admin_password
        )
        await db.commit()
        org = await db.get(Organization, user.org_id)
        return {"id": org.id, "name": org.name, "slug": org.slug, "admin_email": user.email}
    except ValueError as e:
        raise HTTPException(400, detail=str(e))


@router.patch("/orgs/{org_id}/toggle")
async def toggle_org(
    org_id: str,
    _: dict = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(404, detail="Organization not found")
    org.is_active = not org.is_active
    await db.commit()
    return {"id": org.id, "name": org.name, "is_active": org.is_active}


@router.patch("/orgs/{org_id}")
async def update_org(
    org_id: str,
    body: UpdateOrgBody,
    _: dict = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Edit organization name or slug."""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(404, detail="Organization not found")
    if body.name:
        org.name = body.name
    if body.slug:
        # Check slug uniqueness
        existing = (await db.execute(
            select(Organization).where(Organization.slug == body.slug, Organization.id != org_id)
        )).scalar_one_or_none()
        if existing:
            raise HTTPException(400, detail="Slug already in use")
        org.slug = body.slug
    await db.commit()
    return {"id": org.id, "name": org.name, "slug": org.slug, "is_active": org.is_active}


@router.delete("/orgs/{org_id}")
async def delete_org(
    org_id: str,
    _: dict = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(404, detail="Organization not found")
    name = org.name
    await db.delete(org)
    await db.commit()
    return {"message": f"Organization '{name}' deleted"}


@router.post("/bootstrap", status_code=201)
async def bootstrap_super_admin(
    body: BootstrapBody,
    db: AsyncSession = Depends(get_db),
):
    """
    One-time super admin creation — protected by SUPER_ADMIN_SEED_KEY env var.
    Set SUPER_ADMIN_SEED_KEY in environment, call this once, then clear the key.
    """
    if not settings.SUPER_ADMIN_SEED_KEY:
        raise HTTPException(403, detail="Bootstrap is disabled. Set SUPER_ADMIN_SEED_KEY in environment.")
    if body.seed_key != settings.SUPER_ADMIN_SEED_KEY:
        raise HTTPException(403, detail="Invalid seed key")

    # Check no super admin exists yet
    existing = (await db.execute(
        select(User).where(User.role == UserRole.SUPER_ADMIN)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, detail="Super admin already exists. Bootstrap can only be used once.")

    # Create a system org for super admin
    system_org = Organization(
        id=str(uuid.uuid4()),
        name="VoxHire Platform",
        slug="voxhire-platform",
    )
    db.add(system_org)
    await db.flush()

    admin = User(
        id=str(uuid.uuid4()),
        org_id=system_org.id,
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole.SUPER_ADMIN,
        is_active=True,
    )
    db.add(admin)
    await db.commit()
    return {"message": "Super admin created. Remove SUPER_ADMIN_SEED_KEY from environment now.", "email": body.email}
