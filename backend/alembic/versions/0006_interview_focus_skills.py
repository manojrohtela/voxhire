"""Add focus_skills to interview_sessions for HR-defined Vapi context

Revision ID: 0006_interview_focus_skills
Revises: 0005_vapi_interview
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_interview_focus_skills"
down_revision = "0005_vapi_interview"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_sessions", sa.Column("focus_skills", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("interview_sessions", "focus_skills")
