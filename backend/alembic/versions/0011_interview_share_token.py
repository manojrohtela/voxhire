"""Add share_token to interview_sessions (public report sharing)

Revision ID: 0011_interview_share_token
Revises: 0010_demo_leads
Create Date: 2026-06-15
"""

from alembic import op
import sqlalchemy as sa

revision = "0011_interview_share_token"
down_revision = "0010_demo_leads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interview_sessions", sa.Column("share_token", sa.String(255), nullable=True))
    op.create_index(
        "ix_interview_sessions_share_token",
        "interview_sessions",
        ["share_token"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_interview_sessions_share_token", table_name="interview_sessions")
    op.drop_column("interview_sessions", "share_token")
