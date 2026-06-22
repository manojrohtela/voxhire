"""Candidate portal accounts (cross-org, keyed by email)

Revision ID: 0012_candidate_accounts
Revises: 0011_interview_share_token
Create Date: 2026-06-19
"""

from alembic import op
import sqlalchemy as sa

revision = "0012_candidate_accounts"
down_revision = "0011_interview_share_token"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "candidate_accounts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_candidate_accounts_email", "candidate_accounts", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_candidate_accounts_email", table_name="candidate_accounts")
    op.drop_table("candidate_accounts")
