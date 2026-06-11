"""candidate_jobs many-to-many + portfolio + interview job_id

Revision ID: 0002_candidate_jobs
Revises: 0001_phase5
Create Date: 2026-06-10

Changes:
- candidates: add portfolio column
- interview_sessions: add nullable job_id FK
- new table: candidate_jobs (Candidate ↔ Job many-to-many with score + status)
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_candidate_jobs"
down_revision = "0001_phase5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── candidates: add portfolio ─────────────────────────────────
    op.add_column("candidates", sa.Column("portfolio", sa.String(500), nullable=True))

    # ── interview_sessions: add job_id ────────────────────────────
    op.add_column("interview_sessions",
        sa.Column("job_id", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_interview_sessions_job_id",
        "interview_sessions", "job_descriptions",
        ["job_id"], ["id"], ondelete="SET NULL",
    )

    # ── candidate_jobs table ──────────────────────────────────────
    op.create_table(
        "candidate_jobs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("candidate_id", sa.String(),
                  sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", sa.String(),
                  sa.ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("match_score", sa.Float(), nullable=True),
        sa.Column("match_reason", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(50), nullable=True, server_default="suggested"),
        sa.Column("assigned_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_candidate_job", "candidate_jobs", ["candidate_id", "job_id"]
    )
    op.create_index("ix_candidate_jobs_candidate_id", "candidate_jobs", ["candidate_id"])
    op.create_index("ix_candidate_jobs_job_id",       "candidate_jobs", ["job_id"])


def downgrade() -> None:
    op.drop_table("candidate_jobs")
    op.drop_constraint("fk_interview_sessions_job_id", "interview_sessions", type_="foreignkey")
    op.drop_column("interview_sessions", "job_id")
    op.drop_column("candidates", "portfolio")
