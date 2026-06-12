"""Add custom_job_title to interview_sessions

Revision ID: 0007_interview_custom_job_title
Revises: 0006_interview_focus_skills
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_interview_custom_job_title"
down_revision = "0006_interview_focus_skills"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_sessions", sa.Column("custom_job_title", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("interview_sessions", "custom_job_title")
