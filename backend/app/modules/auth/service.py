"""
Auth service — DB-backed using SQLAlchemy async.
Replaces in-memory store from previous version.
"""

import uuid
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.db.models import Organization, User, Invite, UserRole


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(user_id: str, org_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "org_id": org_id, "role": role, "type": "access", "exp": expire},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": user_id, "type": "refresh", "exp": expire},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


async def create_org_and_admin(db: AsyncSession, org_name: str, admin_name: str, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise ValueError("Email already registered")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

    base_slug = slugify(org_name)
    slug = base_slug
    counter = 1
    while True:
        result = await db.execute(select(Organization).where(Organization.slug == slug))
        if not result.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Organization(id=str(uuid.uuid4()), name=org_name, slug=slug)
    db.add(org)
    await db.flush()

    user = User(id=str(uuid.uuid4()), org_id=org.id, name=admin_name, email=email,
                password_hash=hash_password(password), role=UserRole.ORG_ADMIN)
    db.add(user)
    await db.flush()
    return user


async def login_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise ValueError("Invalid email or password")
    user.last_login = datetime.now(timezone.utc)
    await db.flush()
    return user


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_org_by_id(db: AsyncSession, org_id: str) -> Optional[Organization]:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    return result.scalar_one_or_none()


async def build_token_response(db: AsyncSession, user: User) -> dict:
    org = await get_org_by_id(db, user.org_id)
    return {
        "access_token": create_access_token(user.id, user.org_id, user.role),
        "refresh_token": create_refresh_token(user.id),
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role,
                 "org": {"id": org.id, "name": org.name, "slug": org.slug}},
    }


async def create_invite(db: AsyncSession, org_id: str, invited_by: str, email: str, name: str) -> Invite:
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise ValueError("This email is already registered")
    invite = Invite(id=str(uuid.uuid4()), token=str(uuid.uuid4()), org_id=org_id,
                    invited_by=invited_by, email=email, name=name,
                    expires_at=datetime.now(timezone.utc) + timedelta(days=7))
    db.add(invite)
    await db.flush()
    return invite


async def accept_invite(db: AsyncSession, token: str, name: str, password: str) -> User:
    result = await db.execute(select(Invite).where(Invite.token == token))
    invite = result.scalar_one_or_none()
    if not invite:
        raise ValueError("Invalid or expired invite link")
    if invite.is_used:
        raise ValueError("This invite has already been used")
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        raise ValueError("This invite has expired")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

    user = User(id=str(uuid.uuid4()), org_id=invite.org_id, name=name, email=invite.email,
                password_hash=hash_password(password), role=UserRole.RECRUITER)
    db.add(user)
    invite.is_used = True
    await db.flush()
    return user


async def get_org_recruiters(db: AsyncSession, org_id: str) -> list:
    result = await db.execute(select(User).where(User.org_id == org_id, User.role == UserRole.RECRUITER))
    return list(result.scalars().all())
