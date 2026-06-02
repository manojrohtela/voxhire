"""
Auth & Organization models.
Roles: super_admin (platform) | org_admin | recruiter
"""

from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ORG_ADMIN = "org_admin"
    RECRUITER = "recruiter"


# ─── Request models ────────────────────────────────────────────

class OrgSignupRequest(BaseModel):
    org_name: str
    admin_name: str
    email: EmailStr
    password: str  # min 8 chars validated in endpoint


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class InviteRecruiterRequest(BaseModel):
    email: EmailStr
    name: str


class AcceptInviteRequest(BaseModel):
    token: str
    name: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ─── Response models ───────────────────────────────────────────

class OrgResponse(BaseModel):
    id: str
    name: str
    slug: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    org: OrgResponse


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class InviteResponse(BaseModel):
    invite_token: str
    email: str
    invite_link: str
    message: str


class MessageResponse(BaseModel):
    message: str
