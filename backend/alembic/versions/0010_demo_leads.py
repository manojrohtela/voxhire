"""Demo leads (captured at the demo gate)

Revision ID: 0010_demo_leads
Revises: 0009_audit_log
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa

revision = "0010_demo_leads"
down_revision = "0009_audit_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "demo_leads",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_demo_leads_created_at", "demo_leads", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_demo_leads_created_at", table_name="demo_leads")
    op.drop_table("demo_leads")
