"""Billing: subscription_plans + subscriptions (additive, provider-agnostic)

Revision ID: 0008_billing
Revises: 0007_interview_custom_job_title
Create Date: 2026-06-14
"""

import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

revision = "0008_billing"
down_revision = "0007_interview_custom_job_title"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("billing_period", sa.String(10), nullable=False, server_default="monthly"),
        sa.Column("max_interviews_per_month", sa.Integer(), nullable=True),
        sa.Column("max_users", sa.Integer(), nullable=True),
        sa.Column("features", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_subscription_plans_slug", "subscription_plans", ["slug"], unique=True)

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("plan_id", sa.String(), sa.ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("provider", sa.String(20), nullable=True),
        sa.Column("provider_customer_id", sa.String(255), nullable=True),
        sa.Column("provider_subscription_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_subscriptions_org_id", "subscriptions", ["org_id"], unique=True)

    # Seed sensible default plans (super-admins can edit/add more later).
    now = datetime.now(timezone.utc)
    plans = sa.table(
        "subscription_plans",
        sa.column("id", sa.String), sa.column("name", sa.String), sa.column("slug", sa.String),
        sa.column("description", sa.Text), sa.column("price_cents", sa.Integer),
        sa.column("currency", sa.String), sa.column("billing_period", sa.String),
        sa.column("max_interviews_per_month", sa.Integer), sa.column("max_users", sa.Integer),
        sa.column("features", sa.JSON), sa.column("is_active", sa.Boolean),
        sa.column("is_public", sa.Boolean), sa.column("sort_order", sa.Integer),
        sa.column("created_at", sa.DateTime(timezone=True)), sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(plans, [
        {
            "id": str(uuid.uuid4()), "name": "Free", "slug": "free",
            "description": "Get started — basic AI screening & interviews.",
            "price_cents": 0, "currency": "INR", "billing_period": "monthly",
            "max_interviews_per_month": 10, "max_users": 2,
            "features": ["voice_interview", "ai_evaluation"],
            "is_active": True, "is_public": True, "sort_order": 1,
            "created_at": now, "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()), "name": "Pro", "slug": "pro",
            "description": "For growing teams — more interviews, more seats.",
            "price_cents": 499900, "currency": "INR", "billing_period": "monthly",
            "max_interviews_per_month": 200, "max_users": 15,
            "features": ["voice_interview", "ai_evaluation", "analytics", "bulk_upload", "branding"],
            "is_active": True, "is_public": True, "sort_order": 2,
            "created_at": now, "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()), "name": "Enterprise", "slug": "enterprise",
            "description": "Unlimited scale, SSO, white-label, priority support.",
            "price_cents": 0, "currency": "INR", "billing_period": "monthly",
            "max_interviews_per_month": None, "max_users": None,
            "features": ["voice_interview", "ai_evaluation", "analytics", "bulk_upload",
                         "branding", "sso", "white_label", "api_access", "priority_support"],
            "is_active": True, "is_public": True, "sort_order": 3,
            "created_at": now, "updated_at": now,
        },
    ])


def downgrade() -> None:
    op.drop_index("ix_subscriptions_org_id", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_index("ix_subscription_plans_slug", table_name="subscription_plans")
    op.drop_table("subscription_plans")
