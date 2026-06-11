"""screening_calls and screening_events tables + candidate screening fields

Revision ID: 0003_screening
Revises: 0002_candidate_jobs
Create Date: 2026-06-11

Changes:
- candidates: add screening_status, screening_attempt_count, last_screening_attempt_at
- new table: screening_calls (one row per Vapi call attempt)
- new table: screening_events (timeline / audit log per candidate)
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_screening"
down_revision = "0002_candidate_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── candidates: screening tracking columns ────────────────────
    op.add_column("candidates", sa.Column("screening_status", sa.String(50), nullable=True, server_default="not_contacted"))
    op.add_column("candidates", sa.Column("screening_attempt_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("candidates", sa.Column("last_screening_attempt_at", sa.DateTime(timezone=True), nullable=True))

    # ── screening_calls table ─────────────────────────────────────
    op.create_table(
        "screening_calls",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("candidate_id", sa.String(),
                  sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("org_id", sa.String(),
                  sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiated_by", sa.String(),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("vapi_call_id", sa.String(255), nullable=True, unique=True),
        sa.Column("attempt_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("call_outcome", sa.String(50), nullable=True),
        sa.Column("screening_completed", sa.Boolean(), nullable=False, server_default="false"),
        # Vapi structured output fields
        sa.Column("work_mode", sa.String(100), nullable=True),
        sa.Column("current_ctc", sa.String(100), nullable=True),
        sa.Column("current_role", sa.String(200), nullable=True),
        sa.Column("expected_ctc", sa.String(100), nullable=True),
        sa.Column("callback_date", sa.String(50), nullable=True),
        sa.Column("callback_time", sa.String(50), nullable=True),
        sa.Column("notice_period", sa.String(100), nullable=True),
        sa.Column("additional_notes", sa.Text(), nullable=True),
        sa.Column("candidate_intent", sa.String(200), nullable=True),
        sa.Column("total_experience", sa.String(100), nullable=True),
        sa.Column("interview_availability", sa.Text(), nullable=True),
        sa.Column("candidate_question", sa.Text(), nullable=True),
        # Timestamps
        sa.Column("initiated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decline_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_screening_calls_candidate_id", "screening_calls", ["candidate_id"])
    op.create_index("ix_screening_calls_vapi_call_id", "screening_calls", ["vapi_call_id"])

    # ── screening_events table ────────────────────────────────────
    op.create_table(
        "screening_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("candidate_id", sa.String(),
                  sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("screening_call_id", sa.String(),
                  sa.ForeignKey("screening_calls.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("event_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_screening_events_candidate_id", "screening_events", ["candidate_id"])
    op.create_index("ix_screening_events_screening_call_id", "screening_events", ["screening_call_id"])


def downgrade() -> None:
    op.drop_table("screening_events")
    op.drop_table("screening_calls")
    op.drop_column("candidates", "last_screening_attempt_at")
    op.drop_column("candidates", "screening_attempt_count")
    op.drop_column("candidates", "screening_status")
