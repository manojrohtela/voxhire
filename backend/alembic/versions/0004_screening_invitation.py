"""screening_invitations table + job_id on screening_calls

Revision ID: 0004_screening_invitation
Revises: 0003_screening
Create Date: 2026-06-11

Changes:
- screening_calls: add nullable job_id FK
- new table: screening_invitations (web-link based screening flow)
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_screening_invitation"
down_revision = "0003_screening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── screening_calls: add job_id ───────────────────────────────
    op.add_column("screening_calls",
        sa.Column("job_id", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_screening_calls_job_id",
        "screening_calls", "job_descriptions",
        ["job_id"], ["id"], ondelete="SET NULL",
    )

    # ── screening_invitations table ───────────────────────────────
    op.create_table(
        "screening_invitations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("token", sa.String(255), nullable=False, unique=True),
        sa.Column("candidate_id", sa.String(),
                  sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("org_id", sa.String(),
                  sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sent_by", sa.String(),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("job_id", sa.String(),
                  sa.ForeignKey("job_descriptions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("screening_call_id", sa.String(),
                  sa.ForeignKey("screening_calls.id", ondelete="SET NULL"), nullable=True),
        sa.Column("candidate_email", sa.String(320), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("email_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_screening_invitations_token", "screening_invitations", ["token"])
    op.create_index("ix_screening_invitations_candidate_id", "screening_invitations", ["candidate_id"])


def downgrade() -> None:
    op.drop_table("screening_invitations")
    op.drop_constraint("fk_screening_calls_job_id", "screening_calls", type_="foreignkey")
    op.drop_column("screening_calls", "job_id")
