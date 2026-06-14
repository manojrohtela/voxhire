"""
Billing — subscription plans (super-admin) + org subscription & usage.

Soft enforcement: usage is reported with `over_limit` flags but NOTHING is
blocked. Orgs without a subscription are treated as unlimited (grandfathered),
so this module is fully backward-compatible.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.database import get_db
from app.db.models import (
    SubscriptionPlan, Subscription, SubscriptionStatus,
    Organization, User, InterviewSession,
)
from app.modules.auth.dependencies import get_current_user, require_super_admin
from app.modules.audit.log import record as audit

router = APIRouter()


# ─── Schemas ───────────────────────────────────────────────────

class PlanBody(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    price_cents: int = 0
    currency: str = "INR"
    billing_period: str = "monthly"
    max_interviews_per_month: Optional[int] = None
    max_users: Optional[int] = None
    features: Optional[list[str]] = None
    is_active: bool = True
    is_public: bool = True
    sort_order: int = 0


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_cents: Optional[int] = None
    currency: Optional[str] = None
    billing_period: Optional[str] = None
    max_interviews_per_month: Optional[int] = None
    max_users: Optional[int] = None
    features: Optional[list[str]] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    sort_order: Optional[int] = None


class AssignSubscriptionBody(BaseModel):
    plan_id: str
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    current_period_end: Optional[datetime] = None


def plan_to_dict(p: SubscriptionPlan) -> dict:
    return {
        "id": p.id, "name": p.name, "slug": p.slug, "description": p.description,
        "price_cents": p.price_cents, "currency": p.currency, "billing_period": p.billing_period,
        "max_interviews_per_month": p.max_interviews_per_month, "max_users": p.max_users,
        "features": p.features or [], "is_active": p.is_active, "is_public": p.is_public,
        "sort_order": p.sort_order,
    }


# ─── Super-admin: plan management ──────────────────────────────

@router.get("/admin/plans")
async def list_all_plans(_: dict = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(SubscriptionPlan).order_by(SubscriptionPlan.sort_order))).scalars().all()
    return [plan_to_dict(p) for p in rows]


@router.post("/admin/plans", status_code=201)
async def create_plan(body: PlanBody, admin: dict = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    exists = (await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.slug == body.slug))).scalar_one_or_none()
    if exists:
        raise HTTPException(409, detail="A plan with this slug already exists.")
    plan = SubscriptionPlan(**body.model_dump())
    db.add(plan)
    await db.flush()
    await audit(db, action="plan.create", actor=admin, target_type="plan", target_id=plan.id, meta={"slug": plan.slug})
    return plan_to_dict(plan)


@router.patch("/admin/plans/{plan_id}")
async def update_plan(plan_id: str, body: PlanUpdate, admin: dict = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    plan = (await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))).scalar_one_or_none()
    if not plan:
        raise HTTPException(404, detail="Plan not found")
    changed = body.model_dump(exclude_unset=True)
    for field, value in changed.items():
        setattr(plan, field, value)
    await db.flush()
    await audit(db, action="plan.update", actor=admin, target_type="plan", target_id=plan.id, meta={"fields": list(changed.keys())})
    return plan_to_dict(plan)


@router.delete("/admin/plans/{plan_id}")
async def delete_plan(plan_id: str, admin: dict = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    in_use = (await db.execute(select(func.count()).select_from(Subscription).where(Subscription.plan_id == plan_id))).scalar()
    if in_use:
        raise HTTPException(409, detail="Plan is assigned to organizations. Deactivate it instead of deleting.")
    plan = (await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))).scalar_one_or_none()
    if not plan:
        raise HTTPException(404, detail="Plan not found")
    await db.delete(plan)
    await audit(db, action="plan.delete", actor=admin, target_type="plan", target_id=plan_id)
    return {"deleted": plan_id}


# ─── Super-admin: assign / view an org's subscription ──────────

@router.get("/admin/orgs/{org_id}/subscription")
async def get_org_subscription(org_id: str, _: dict = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    return await _subscription_payload(db, org_id)


@router.put("/admin/orgs/{org_id}/subscription")
async def assign_org_subscription(
    org_id: str, body: AssignSubscriptionBody,
    admin: dict = Depends(require_super_admin), db: AsyncSession = Depends(get_db),
):
    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalar_one_or_none()
    if not org:
        raise HTTPException(404, detail="Organization not found")
    plan = (await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == body.plan_id))).scalar_one_or_none()
    if not plan:
        raise HTTPException(404, detail="Plan not found")

    sub = (await db.execute(select(Subscription).where(Subscription.org_id == org_id))).scalar_one_or_none()
    if sub:
        sub.plan_id = body.plan_id
        sub.status = body.status
        if body.current_period_end is not None:
            sub.current_period_end = body.current_period_end
    else:
        sub = Subscription(
            org_id=org_id, plan_id=body.plan_id, status=body.status,
            current_period_start=datetime.now(timezone.utc),
            current_period_end=body.current_period_end,
        )
        db.add(sub)
    await db.flush()
    await audit(db, action="subscription.assign", actor=admin, org_id=org_id,
                target_type="subscription", target_id=sub.id, meta={"plan_id": body.plan_id, "status": body.status})
    return await _subscription_payload(db, org_id)


# ─── Org-facing: plans + current subscription with usage ───────

@router.get("/plans")
async def list_public_plans(_: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(SubscriptionPlan)
        .where(SubscriptionPlan.is_active.is_(True), SubscriptionPlan.is_public.is_(True))
        .order_by(SubscriptionPlan.sort_order)
    )).scalars().all()
    return [plan_to_dict(p) for p in rows]


@router.get("/subscription")
async def my_subscription(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _subscription_payload(db, current_user["org_id"])


# ─── Helpers ───────────────────────────────────────────────────

def _period_start(sub: Optional[Subscription]) -> datetime:
    if sub and sub.current_period_start:
        start = sub.current_period_start
        return start if start.tzinfo else start.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def _subscription_payload(db: AsyncSession, org_id: str) -> dict:
    """Plan + soft usage report for an org. No subscription ⇒ grandfathered/unlimited."""
    sub = (await db.execute(select(Subscription).where(Subscription.org_id == org_id))).scalar_one_or_none()
    plan = None
    if sub:
        plan = (await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == sub.plan_id))).scalar_one_or_none()

    period_start = _period_start(sub)
    interviews_used = (await db.execute(
        select(func.count()).select_from(InterviewSession)
        .where(InterviewSession.org_id == org_id, InterviewSession.created_at >= period_start)
    )).scalar() or 0
    users_count = (await db.execute(
        select(func.count()).select_from(User).where(User.org_id == org_id)
    )).scalar() or 0

    interview_limit = plan.max_interviews_per_month if plan else None
    user_limit = plan.max_users if plan else None

    return {
        "has_subscription": sub is not None,
        "status": sub.status if sub else None,
        "plan": plan_to_dict(plan) if plan else None,
        "period_start": period_start.isoformat(),
        "current_period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        "usage": {
            "interviews_used": interviews_used,
            "interviews_limit": interview_limit,
            "interviews_over_limit": interview_limit is not None and interviews_used > interview_limit,
            "users_count": users_count,
            "users_limit": user_limit,
            "users_over_limit": user_limit is not None and users_count > user_limit,
        },
        # Soft mode: surfaced for UI warnings; nothing is blocked server-side.
        "enforcement": "soft",
    }
