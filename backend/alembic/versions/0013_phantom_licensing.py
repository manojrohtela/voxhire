"""Phantom licensing — machines, license keys, orders

Revision ID: 0013_phantom_licensing
Revises: 0012_candidate_accounts
Create Date: 2026-06-22
"""

from alembic import op
import sqlalchemy as sa

revision = "0013_phantom_licensing"
down_revision = "0012_candidate_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "phantom_license_keys",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("key", sa.String(40), nullable=False),
        sa.Column("status", sa.String(20), nullable=True),
        sa.Column("bound_machine_id", sa.String(128), nullable=True),
        sa.Column("order_id", sa.String(), nullable=True),
        sa.Column("price_inr", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_phantom_license_keys_key", "phantom_license_keys", ["key"], unique=True)
    op.create_index("ix_phantom_license_keys_bound_machine_id", "phantom_license_keys", ["bound_machine_id"])

    op.create_table(
        "phantom_machines",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("machine_id", sa.String(128), nullable=False),
        sa.Column("trial_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("license_key_id", sa.String(), sa.ForeignKey("phantom_license_keys.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_phantom_machines_machine_id", "phantom_machines", ["machine_id"], unique=True)

    op.create_table(
        "phantom_orders",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("machine_id", sa.String(128), nullable=True),
        sa.Column("utr", sa.String(80), nullable=True),
        sa.Column("amount_inr", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=True),
        sa.Column("approve_token", sa.String(64), nullable=False),
        sa.Column("key_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("phantom_orders")
    op.drop_index("ix_phantom_machines_machine_id", table_name="phantom_machines")
    op.drop_table("phantom_machines")
    op.drop_index("ix_phantom_license_keys_bound_machine_id", table_name="phantom_license_keys")
    op.drop_index("ix_phantom_license_keys_key", table_name="phantom_license_keys")
    op.drop_table("phantom_license_keys")
