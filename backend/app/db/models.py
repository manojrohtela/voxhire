"""
VoxHire — Complete Database Models
Tables: organizations, users, invites, candidates, interview_sessions,
        skill_evaluations, transcript_entries, anti_cheat_violations, interview_schedules
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    String, Text, Float, Integer, Boolean, DateTime,
    ForeignKey, Enum as SAEnum, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base
import enum


def utcnow():
    return datetime.now(timezone.utc)

def new_uuid():
    return str(uuid.uuid4())


# ─── Enums ─────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ORG_ADMIN = "org_admin"
    RECRUITER = "recruiter"

class InterviewStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    TERMINATED = "terminated"
    CANCELLED = "cancelled"

class EvaluationRating(str, enum.Enum):
    STRONG = "Strong"
    MEDIUM = "Medium"
    WEAK = "Weak"
    PENDING = "Pending"

class SkillDifficulty(str, enum.Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"

class SkillCategory(str, enum.Enum):
    PRIMARY = "Primary"
    SECONDARY = "Secondary"
    BONUS = "Bonus"

class TranscriptSpeaker(str, enum.Enum):
    AI = "ai"
    CANDIDATE = "candidate"

class ViolationType(str, enum.Enum):
    TAB_SWITCH = "TAB_SWITCH"
    FULLSCREEN_EXIT = "FULLSCREEN_EXIT"
    MULTIPLE_SCREENS = "MULTIPLE_SCREENS"
    DEVTOOLS_OPEN = "DEVTOOLS_OPEN"
    COPY_PASTE = "COPY_PASTE"
    SCREEN_SHARE_STOP = "SCREEN_SHARE_STOP"


# ─── Organizations ─────────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    users: Mapped[list["User"]] = relationship("User", back_populates="org", cascade="all, delete-orphan")
    invites: Mapped[list["Invite"]] = relationship("Invite", back_populates="org", cascade="all, delete-orphan")
    candidates: Mapped[list["Candidate"]] = relationship("Candidate", back_populates="org", cascade="all, delete-orphan")


# ─── Users ─────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    org_id: Mapped[str] = mapped_column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.RECRUITER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    org: Mapped["Organization"] = relationship("Organization", back_populates="users")
    interviews_created: Mapped[list["InterviewSession"]] = relationship("InterviewSession", back_populates="created_by_user")


# ─── Invites ───────────────────────────────────────────────────

class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    org_id: Mapped[str] = mapped_column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    invited_by: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    org: Mapped["Organization"] = relationship("Organization", back_populates="invites")


# ─── Candidates ────────────────────────────────────────────────

class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    org_id: Mapped[str] = mapped_column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Personal info
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    linkedin: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    github: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Resume
    resume_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    resume_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Parsed profile (stored as JSON)
    parsed_profile: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    total_experience_years: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Applied role
    applied_role: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Overall rating (set after interview)
    overall_rating: Mapped[Optional[EvaluationRating]] = mapped_column(
        SAEnum(EvaluationRating), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    org: Mapped["Organization"] = relationship("Organization", back_populates="candidates")
    interviews: Mapped[list["InterviewSession"]] = relationship("InterviewSession", back_populates="candidate", cascade="all, delete-orphan")
    selected_skills: Mapped[list["CandidateSkill"]] = relationship("CandidateSkill", back_populates="candidate", cascade="all, delete-orphan")


# ─── Candidate Skills (HR selected for interview) ──────────────

class CandidateSkill(Base):
    __tablename__ = "candidate_skills"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    candidate_id: Mapped[str] = mapped_column(String, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    skill: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[SkillCategory] = mapped_column(SAEnum(SkillCategory), default=SkillCategory.PRIMARY)
    difficulty: Mapped[SkillDifficulty] = mapped_column(SAEnum(SkillDifficulty), default=SkillDifficulty.MEDIUM)
    weight_percent: Mapped[int] = mapped_column(Integer, default=0)  # % of interview time
    interview_areas: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="selected_skills")


# ─── Interview Sessions ────────────────────────────────────────

class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    candidate_id: Mapped[str] = mapped_column(String, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    org_id: Mapped[str] = mapped_column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Scheduling
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=45)
    interview_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    link_token: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)

    # Status
    status: Mapped[InterviewStatus] = mapped_column(SAEnum(InterviewStatus), default=InterviewStatus.SCHEDULED)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Recording
    recording_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    recording_size_mb: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Evaluation summary
    overall_rating: Mapped[Optional[EvaluationRating]] = mapped_column(SAEnum(EvaluationRating), nullable=True)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    strengths: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    weak_areas: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Email
    invite_email_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    invite_email_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="interviews")
    created_by_user: Mapped[Optional["User"]] = relationship("User", back_populates="interviews_created")
    skill_evaluations: Mapped[list["SkillEvaluation"]] = relationship("SkillEvaluation", back_populates="session", cascade="all, delete-orphan")
    transcript: Mapped[list["TranscriptEntry"]] = relationship("TranscriptEntry", back_populates="session", cascade="all, delete-orphan", order_by="TranscriptEntry.sequence")
    violations: Mapped[list["AntiCheatViolation"]] = relationship("AntiCheatViolation", back_populates="session", cascade="all, delete-orphan")


# ─── Skill Evaluations ─────────────────────────────────────────

class SkillEvaluation(Base):
    __tablename__ = "skill_evaluations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False)
    skill: Mapped[str] = mapped_column(String(100), nullable=False)
    rating: Mapped[Optional[EvaluationRating]] = mapped_column(SAEnum(EvaluationRating), nullable=True)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0-100 internal
    questions_asked: Mapped[int] = mapped_column(Integer, default=0)
    ai_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="skill_evaluations")


# ─── Transcript Entries ────────────────────────────────────────

class TranscriptEntry(Base):
    __tablename__ = "transcript_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    speaker: Mapped[TranscriptSpeaker] = mapped_column(SAEnum(TranscriptSpeaker), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="transcript")


# ─── Anti Cheat Violations ─────────────────────────────────────

class AntiCheatViolation(Base):
    __tablename__ = "anti_cheat_violations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    violation_type: Mapped[ViolationType] = mapped_column(SAEnum(ViolationType), nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=1)
    timestamp_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="violations")
