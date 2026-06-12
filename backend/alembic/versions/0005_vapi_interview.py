"""Add Vapi interview fields and evaluation columns to interview_sessions

Revision ID: 0005_vapi_interview
Revises: 0004_screening_invitation
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_vapi_interview"
down_revision = "0004_screening_invitation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_sessions", sa.Column("vapi_call_id", sa.String(255), nullable=True, unique=True))
    op.add_column("interview_sessions", sa.Column("vapi_transcript", sa.JSON(), nullable=True))
    op.add_column("interview_sessions", sa.Column("topics_covered", sa.JSON(), nullable=True))
    op.add_column("interview_sessions", sa.Column("topics_missing", sa.JSON(), nullable=True))
    op.add_column("interview_sessions", sa.Column("topics_needs_evaluation", sa.JSON(), nullable=True))
    op.add_column("interview_sessions", sa.Column("communication_score", sa.Integer(), nullable=True))
    op.add_column("interview_sessions", sa.Column("confidence_score", sa.Integer(), nullable=True))
    op.add_column("interview_sessions", sa.Column("clarity_score", sa.Integer(), nullable=True))
    op.add_column("interview_sessions", sa.Column("executive_summary", sa.Text(), nullable=True))
    op.add_column("interview_sessions", sa.Column("resume_claim_verification", sa.JSON(), nullable=True))
    op.add_column("interview_sessions", sa.Column("candidate_questions", sa.JSON(), nullable=True))
    op.add_column("interview_sessions", sa.Column("interview_timeline", sa.JSON(), nullable=True))
    op.add_column("interview_sessions", sa.Column("evaluation_status", sa.String(20), nullable=True, server_default="pending"))


def downgrade() -> None:
    for col in [
        "vapi_call_id", "vapi_transcript", "topics_covered", "topics_missing",
        "topics_needs_evaluation", "communication_score", "confidence_score",
        "clarity_score", "executive_summary", "resume_claim_verification",
        "candidate_questions", "interview_timeline", "evaluation_status",
    ]:
        op.drop_column("interview_sessions", col)
