"""phase5: interview config fields + job_descriptions table

Revision ID: 0001_phase5
Revises:
Create Date: 2026-06-09

Changes:
- interview_sessions: add interview_type, language, difficulty, question_strategy, ai_personality
- interview_sessions.overall_rating: stays VARCHAR, now accepts HiringDecision values
- candidates.overall_rating: stays VARCHAR, now accepts HiringDecision values
- new table: job_descriptions
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_phase5"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── interview_sessions: add config columns ───────────────────
    op.add_column("interview_sessions",
        sa.Column("interview_type", sa.String(50), nullable=True))
    op.add_column("interview_sessions",
        sa.Column("language", sa.String(10), nullable=True, server_default="en"))
    op.add_column("interview_sessions",
        sa.Column("difficulty", sa.String(20), nullable=True))
    op.add_column("interview_sessions",
        sa.Column("question_strategy", sa.String(50), nullable=True))
    op.add_column("interview_sessions",
        sa.Column("ai_personality", sa.String(50), nullable=True))

    # ── job_descriptions table ────────────────────────────────────
    op.create_table(
        "job_descriptions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("parsed_jd", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_job_descriptions_org_id", "job_descriptions", ["org_id"])


def downgrade() -> None:
    op.drop_table("job_descriptions")
    op.drop_column("interview_sessions", "ai_personality")
    op.drop_column("interview_sessions", "question_strategy")
    op.drop_column("interview_sessions", "difficulty")
    op.drop_column("interview_sessions", "language")
    op.drop_column("interview_sessions", "interview_type")
