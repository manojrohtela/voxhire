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

class HiringDecision(str, enum.Enum):
    STRONG_HIRE = "Strong Hire"
    HIRE = "Hire"
    CONSIDER = "Consider"
    REJECT = "Reject"
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

class CandidateJobStatus(str, enum.Enum):
    SUGGESTED   = "suggested"            # AI suggested, awaiting recruiter review
    SHORTLISTED = "shortlisted"          # Recruiter approved
    INTERVIEW_SCHEDULED = "interview_scheduled"
    INTERVIEW_COMPLETED = "interview_completed"
    HIRED    = "hired"
    REJECTED = "rejected"

class ScreeningStatus(str, enum.Enum):
    NOT_CONTACTED       = "not_contacted"
    LINK_SENT           = "link_sent"          # invitation email sent, waiting for candidate
    CALLING             = "calling"            # active Vapi call in progress
    CALLBACK_REQUESTED  = "callback_requested"
    COMPLETED           = "completed"
    DECLINED            = "declined"
    NO_ANSWER           = "no_answer"
    CALL_DROPPED        = "call_dropped"
    PARTIALLY_COMPLETED = "partially_completed"

class CallOutcome(str, enum.Enum):
    COMPLETED          = "COMPLETED"
    CALLBACK_REQUESTED = "CALLBACK_REQUESTED"
    DECLINED           = "DECLINED"
    CALL_DROPPED       = "CALL_DROPPED"
    NO_ANSWER          = "NO_ANSWER"

class ScreeningEventType(str, enum.Enum):
    INVITATION_SENT      = "INVITATION_SENT"
    SCREENING_INITIATED  = "SCREENING_INITIATED"
    CALL_CONNECTED       = "CALL_CONNECTED"
    SCREENING_COMPLETED  = "SCREENING_COMPLETED"
    CALLBACK_REQUESTED   = "CALLBACK_REQUESTED"
    DECLINED             = "DECLINED"
    CALL_DROPPED         = "CALL_DROPPED"
    NO_ANSWER            = "NO_ANSWER"
    RETRY_SCHEDULED      = "RETRY_SCHEDULED"


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
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, native_enum=False), default=UserRole.RECRUITER)
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

    # Optional profile links
    portfolio: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Applied role (kept for backwards compat — primary job link is via CandidateJob)
    applied_role: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Overall hiring decision (latest/best, kept for quick display)
    overall_rating: Mapped[Optional[HiringDecision]] = mapped_column(
        SAEnum(HiringDecision, native_enum=False), nullable=True
    )

    # Screening status
    screening_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="not_contacted")
    screening_attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    last_screening_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    org: Mapped["Organization"] = relationship("Organization", back_populates="candidates")
    interviews: Mapped[list["InterviewSession"]] = relationship("InterviewSession", back_populates="candidate", cascade="all, delete-orphan")
    selected_skills: Mapped[list["CandidateSkill"]] = relationship("CandidateSkill", back_populates="candidate", cascade="all, delete-orphan")
    job_assignments: Mapped[list["CandidateJob"]] = relationship("CandidateJob", back_populates="candidate", cascade="all, delete-orphan")
    screening_calls: Mapped[list["ScreeningCall"]] = relationship("ScreeningCall", back_populates="candidate", cascade="all, delete-orphan", order_by="ScreeningCall.created_at.desc()")
    screening_events: Mapped[list["ScreeningEvent"]] = relationship("ScreeningEvent", back_populates="candidate", cascade="all, delete-orphan", order_by="ScreeningEvent.created_at.desc()")
    screening_invitations: Mapped[list["ScreeningInvitation"]] = relationship("ScreeningInvitation", back_populates="candidate", cascade="all, delete-orphan", order_by="ScreeningInvitation.created_at.desc()")


# ─── Candidate Skills (HR selected for interview) ──────────────

class CandidateSkill(Base):
    __tablename__ = "candidate_skills"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    candidate_id: Mapped[str] = mapped_column(String, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    skill: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[SkillCategory] = mapped_column(SAEnum(SkillCategory, native_enum=False), default=SkillCategory.PRIMARY)
    difficulty: Mapped[SkillDifficulty] = mapped_column(SAEnum(SkillDifficulty, native_enum=False), default=SkillDifficulty.MEDIUM)
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

    # Interview configuration
    interview_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)   # Technical/HR/Leadership/Sales
    language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default="en")
    difficulty: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)        # Easy/Medium/Hard
    question_strategy: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ai_personality: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)   # Friendly/Strict/Neutral

    # Status
    status: Mapped[InterviewStatus] = mapped_column(SAEnum(InterviewStatus, native_enum=False), default=InterviewStatus.SCHEDULED)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Recording
    recording_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    recording_size_mb: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Evaluation summary (hiring decision set by recruiter)
    overall_rating: Mapped[Optional[HiringDecision]] = mapped_column(SAEnum(HiringDecision, native_enum=False), nullable=True)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    strengths: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    weak_areas: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Job link (which job is this interview for)
    job_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("job_descriptions.id", ondelete="SET NULL"), nullable=True)

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
    rating: Mapped[Optional[EvaluationRating]] = mapped_column(SAEnum(EvaluationRating, native_enum=False), nullable=True)
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
    speaker: Mapped[TranscriptSpeaker] = mapped_column(SAEnum(TranscriptSpeaker, native_enum=False), nullable=False)
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
    violation_type: Mapped[ViolationType] = mapped_column(SAEnum(ViolationType, native_enum=False), nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=1)
    timestamp_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="violations")


# ─── Job Descriptions ──────────────────────────────────────────

class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    org_id: Mapped[str] = mapped_column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Parsed JD data — extracted by AI
    parsed_jd: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # parsed_jd shape: { skills, experience_requirements, responsibilities, keywords }

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    org: Mapped["Organization"] = relationship("Organization")
    candidate_jobs: Mapped[list["CandidateJob"]] = relationship("CandidateJob", back_populates="job", cascade="all, delete-orphan")


# ─── Candidate ↔ Job (Many-to-Many with score + status) ────────

class CandidateJob(Base):
    __tablename__ = "candidate_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    candidate_id: Mapped[str] = mapped_column(String, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id: Mapped[str] = mapped_column(String, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)

    # AI match result
    match_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)       # 0–100
    match_reason: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)        # {matched:[], missing:[]}

    # Recruiter-driven status for this specific candidate ↔ job pair
    status: Mapped[CandidateJobStatus] = mapped_column(
        SAEnum(CandidateJobStatus, native_enum=False), default=CandidateJobStatus.SUGGESTED
    )

    assigned_by: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="job_assignments")
    job: Mapped["JobDescription"] = relationship("JobDescription", back_populates="candidate_jobs")


# ─── Screening Calls (Vapi pre-screening) ──────────────────────

class ScreeningCall(Base):
    __tablename__ = "screening_calls"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    candidate_id: Mapped[str] = mapped_column(String, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id: Mapped[str] = mapped_column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    initiated_by: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Vapi call tracking
    vapi_call_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, unique=True, index=True)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)

    # Which job this screening is for (optional)
    job_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("job_descriptions.id", ondelete="SET NULL"), nullable=True)

    # Outcome
    call_outcome: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)   # COMPLETED, CALLBACK_REQUESTED, DECLINED, CALL_DROPPED, NO_ANSWER
    screening_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Vapi structured output fields
    work_mode: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_ctc: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_role: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    expected_ctc: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    callback_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    callback_time: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notice_period: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    additional_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    candidate_intent: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    total_experience: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    interview_availability: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    candidate_question: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    initiated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    decline_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="screening_calls")
    events: Mapped[list["ScreeningEvent"]] = relationship("ScreeningEvent", back_populates="screening_call", cascade="all, delete-orphan")


# ─── Screening Events (timeline / audit log) ───────────────────

class ScreeningEvent(Base):
    __tablename__ = "screening_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    candidate_id: Mapped[str] = mapped_column(String, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    screening_call_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("screening_calls.id", ondelete="SET NULL"), nullable=True, index=True)

    event_type: Mapped[str] = mapped_column(String(50), nullable=False)   # ScreeningEventType values
    event_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="screening_events")
    screening_call: Mapped[Optional["ScreeningCall"]] = relationship("ScreeningCall", back_populates="events")


# ─── Screening Invitations (web-link based screening flow) ─────

class ScreeningInvitation(Base):
    __tablename__ = "screening_invitations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    candidate_id: Mapped[str] = mapped_column(String, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id: Mapped[str] = mapped_column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    sent_by: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    job_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("job_descriptions.id", ondelete="SET NULL"), nullable=True)
    screening_call_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("screening_calls.id", ondelete="SET NULL"), nullable=True)

    # Snapshot fields (stable even if candidate record changes)
    candidate_email: Mapped[str] = mapped_column(String(320), nullable=False)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)       # True after call completes
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # When candidate clicked Start
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="screening_invitations")
    org: Mapped["Organization"] = relationship("Organization")
