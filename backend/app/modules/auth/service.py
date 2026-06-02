"""
Auth service — password hashing, JWT, in-memory user/org store.
Replace in-memory dicts with DB queries when Supabase/PostgreSQL is connected.
"""

import uuid
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import jwt, JWTError

from app.core.config import settings
from app.modules.auth.models import UserRole


# ─── In-memory store (swap with DB later) ──────────────────────
# Structure: { user_id: {...user_data} }
USERS: dict[str, dict] = {}
# Structure: { org_id: {...org_data} }
ORGS: dict[str, dict] = {}
# Structure: { email: user_id }
EMAIL_INDEX: dict[str, str] = {}
# Structure: { invite_token: {...invite_data} }
INVITES: dict[str, dict] = {}


# ─── Helpers ───────────────────────────────────────────────────

def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(user_id: str, org_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "org_id": org_id,
        "role": role,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


# ─── Auth operations ───────────────────────────────────────────

def create_org_and_admin(org_name: str, admin_name: str, email: str, password: str) -> dict:
    """Create a new organization and its admin user."""
    if email in EMAIL_INDEX:
        raise ValueError("Email already registered")

    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

    org_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    slug = slugify(org_name)

    # Ensure slug uniqueness
    existing_slugs = {o["slug"] for o in ORGS.values()}
    base_slug = slug
    counter = 1
    while slug in existing_slugs:
        slug = f"{base_slug}-{counter}"
        counter += 1

    ORGS[org_id] = {
        "id": org_id,
        "name": org_name,
        "slug": slug,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    USERS[user_id] = {
        "id": user_id,
        "name": admin_name,
        "email": email,
        "password_hash": hash_password(password),
        "role": UserRole.ORG_ADMIN,
        "org_id": org_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    EMAIL_INDEX[email] = user_id
    return USERS[user_id]


def login_user(email: str, password: str) -> dict:
    """Validate credentials and return user dict."""
    user_id = EMAIL_INDEX.get(email)
    if not user_id:
        raise ValueError("Invalid email or password")

    user = USERS.get(user_id)
    if not user or not verify_password(password, user["password_hash"]):
        raise ValueError("Invalid email or password")

    return user


def get_user_by_id(user_id: str) -> Optional[dict]:
    return USERS.get(user_id)


def get_org_by_id(org_id: str) -> Optional[dict]:
    return ORGS.get(org_id)


def build_token_response(user: dict) -> dict:
    """Build full token response with user + org info."""
    org = ORGS[user["org_id"]]
    access_token = create_access_token(user["id"], user["org_id"], user["role"])
    refresh_token = create_refresh_token(user["id"])

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "org": {
                "id": org["id"],
                "name": org["name"],
                "slug": org["slug"],
            },
        },
    }


# ─── Invite operations ─────────────────────────────────────────

def create_invite(org_id: str, invited_by: str, email: str, name: str) -> dict:
    """Create a recruiter invite token."""
    if email in EMAIL_INDEX:
        raise ValueError("This email is already registered")

    invite_token = str(uuid.uuid4())
    INVITES[invite_token] = {
        "token": invite_token,
        "org_id": org_id,
        "invited_by": invited_by,
        "email": email,
        "name": name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "used": False,
    }
    return INVITES[invite_token]


def accept_invite(token: str, name: str, password: str) -> dict:
    """Accept an invite and create recruiter account."""
    invite = INVITES.get(token)
    if not invite:
        raise ValueError("Invalid or expired invite link")
    if invite["used"]:
        raise ValueError("This invite has already been used")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

    user_id = str(uuid.uuid4())
    USERS[user_id] = {
        "id": user_id,
        "name": name,
        "email": invite["email"],
        "password_hash": hash_password(password),
        "role": UserRole.RECRUITER,
        "org_id": invite["org_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    EMAIL_INDEX[invite["email"]] = user_id
    invite["used"] = True

    return USERS[user_id]


def get_org_recruiters(org_id: str) -> list[dict]:
    """Get all recruiters in an org."""
    return [
        u for u in USERS.values()
        if u["org_id"] == org_id and u["role"] == UserRole.RECRUITER
    ]
