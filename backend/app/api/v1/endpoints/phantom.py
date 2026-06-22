"""
Phantom licensing API — server-side trial + lifetime keys for the desktop app.

Design: the SERVER is the source of truth, keyed by a stable machine id. This
defeats the two abuse cases by construction:
  * reinstalling the app  → same machine id → original trial start is remembered
  * changing the system clock → trial time is computed on the server's clock

Payment is UPI + manual approval for now (zero KYC); a Razorpay webhook can
later call the same approve path automatically.
"""

import secrets
from datetime import datetime, timezone, timedelta
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.email import send_email
from app.db.database import get_db
from app.db.models import PhantomMachine, PhantomLicenseKey, PhantomOrder

router = APIRouter()

TRIAL_DAYS = 3
OFFER_LIMIT = 200      # first 200 keys at the launch price
OFFER_PRICE = 200      # ₹
REGULAR_PRICE = 1000   # ₹ after the offer
# Marketing scarcity: the landing shows fewer "remaining" than reality to create
# urgency — it starts the displayed counter as if 100 are already claimed.
DISPLAY_CLAIMED_BASELINE = 100

_KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no ambiguous chars


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _gen_key() -> str:
    grp = lambda: "".join(secrets.choice(_KEY_ALPHABET) for _ in range(4))
    return f"PHN-{grp()}-{grp()}-{grp()}"


async def _issued_count(db: AsyncSession) -> int:
    return (await db.execute(
        select(func.count()).select_from(PhantomLicenseKey).where(PhantomLicenseKey.status == "active")
    )).scalar() or 0


async def _current_price(db: AsyncSession) -> tuple[int, int]:
    issued = await _issued_count(db)
    slots_left = max(0, OFFER_LIMIT - issued)
    price = OFFER_PRICE if issued < OFFER_LIMIT else REGULAR_PRICE
    return price, slots_left


# ─── Schemas ───────────────────────────────────────────────────

class ActivateBody(BaseModel):
    machine_id: str
    key: Optional[str] = None

class OrderBody(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    machine_id: Optional[str] = None
    utr: Optional[str] = None

class ReleaseBody(BaseModel):
    machine_id: str
    key: str


# ─── Endpoints ─────────────────────────────────────────────────

@router.get("/pricing")
async def pricing(db: AsyncSession = Depends(get_db)):
    price, slots_left = await _current_price(db)
    issued = OFFER_LIMIT - slots_left
    claimed_display = min(OFFER_LIMIT, DISPLAY_CLAIMED_BASELINE + issued)
    left_display = max(0, OFFER_LIMIT - claimed_display)
    return {
        "price_inr": price, "regular_price_inr": REGULAR_PRICE,
        "offer_limit": OFFER_LIMIT, "slots_left": slots_left,
        # Marketing display (scarcity) — starts near 100 left, ticks down with real sales.
        "offer_total": OFFER_LIMIT,
        "offer_left_display": left_display,
        "offer_claimed_display": claimed_display,
        "upi_id": settings.PHANTOM_UPI_ID, "upi_name": settings.PHANTOM_UPI_NAME,
        "trial_days": TRIAL_DAYS,
    }


@router.post("/activate")
async def activate(body: ActivateBody, db: AsyncSession = Depends(get_db)):
    mid = body.machine_id.strip()
    if not mid:
        raise HTTPException(400, "machine_id required")

    machine = (await db.execute(
        select(PhantomMachine).where(PhantomMachine.machine_id == mid)
    )).scalar_one_or_none()
    if not machine:
        machine = PhantomMachine(machine_id=mid, trial_started_at=_now())
        db.add(machine)
        await db.flush()

    # Optional key activation (single-PC binding).
    if body.key:
        k = (await db.execute(
            select(PhantomLicenseKey).where(PhantomLicenseKey.key == body.key.strip().upper())
        )).scalar_one_or_none()
        if not k or k.status != "active":
            raise HTTPException(404, "Invalid or inactive key")
        if k.bound_machine_id and k.bound_machine_id != mid:
            raise HTTPException(409, "This key is already active on another device. Release it there first.")
        if not k.bound_machine_id:
            k.bound_machine_id = mid
            k.activated_at = _now()
        machine.license_key_id = k.id

    machine.last_seen_at = _now()

    # Resolve status from the SERVER clock.
    licensed = False
    if machine.license_key_id:
        k = (await db.execute(
            select(PhantomLicenseKey).where(PhantomLicenseKey.id == machine.license_key_id)
        )).scalar_one_or_none()
        licensed = bool(k and k.status == "active" and k.bound_machine_id == mid)

    await db.commit()

    start = machine.trial_started_at
    if start and start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    ends_at = (start + timedelta(days=TRIAL_DAYS)) if start else _now()
    remaining = (ends_at - _now()).total_seconds()
    days_left = max(0, ceil(remaining / 86400)) if remaining > 0 else 0

    if licensed:
        status = "licensed"
    elif remaining > 0:
        status = "trial"
    else:
        status = "expired"

    price, slots_left = await _current_price(db)
    return {
        "status": status,
        "days_left": days_left,
        "trial_ends_at": ends_at.isoformat(),
        "price_inr": price, "slots_left": slots_left,
        "upi_id": settings.PHANTOM_UPI_ID, "upi_name": settings.PHANTOM_UPI_NAME,
    }


@router.post("/release")
async def release(body: ReleaseBody, db: AsyncSession = Depends(get_db)):
    """Unbind a key from this machine so it can be used on another PC."""
    k = (await db.execute(
        select(PhantomLicenseKey).where(PhantomLicenseKey.key == body.key.strip().upper())
    )).scalar_one_or_none()
    if not k:
        raise HTTPException(404, "Key not found")
    if k.bound_machine_id != body.machine_id.strip():
        raise HTTPException(403, "This key isn't bound to this device")
    k.bound_machine_id = None
    # detach from machine record(s)
    m = (await db.execute(select(PhantomMachine).where(PhantomMachine.license_key_id == k.id))).scalars().all()
    for row in m:
        row.license_key_id = None
    await db.commit()
    return {"released": True}


@router.post("/order", status_code=201)
async def create_order(body: OrderBody, db: AsyncSession = Depends(get_db)):
    if not body.name.strip() or not body.email.strip():
        raise HTTPException(400, "Name and email are required")
    price, _ = await _current_price(db)
    order = PhantomOrder(
        name=body.name.strip(), email=body.email.strip(), phone=(body.phone or "").strip() or None,
        machine_id=(body.machine_id or "").strip() or None, utr=(body.utr or "").strip() or None,
        amount_inr=price, approve_token=secrets.token_urlsafe(24),
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    # Notify the owner with a one-click approve link.
    owner = settings.PHANTOM_OWNER_EMAIL or settings.FROM_EMAIL
    approve_url = f"{settings.API_BASE_URL.rstrip('/')}/api/v1/phantom/order/{order.id}/approve?t={order.approve_token}"
    send_email(
        owner,
        f"Phantom order — {order.name} · ₹{order.amount_inr}",
        f"""<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2>New Phantom key order</h2>
          <p><b>Name:</b> {order.name}<br/><b>Email:</b> {order.email}<br/>
             <b>Phone:</b> {order.phone or '—'}<br/><b>Amount:</b> ₹{order.amount_inr}<br/>
             <b>UPI ref / UTR:</b> {order.utr or '—'}</p>
          <p>Verify the ₹{order.amount_inr} hit your UPI, then:</p>
          <p><a href="{approve_url}" style="background:#4F46E5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Approve &amp; send key →</a></p>
        </div>""",
    )
    # Acknowledge the buyer.
    send_email(
        order.email, "We received your Phantom order",
        f"""<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2>Thanks, {order.name}!</h2>
          <p>We got your order for a Phantom lifetime key (₹{order.amount_inr}). Once we confirm
             your UPI payment, we'll email your license key — usually within a few hours.</p>
        </div>""",
    )
    return {"order_id": order.id, "status": "pending", "amount_inr": order.amount_inr}


@router.get("/order/{order_id}/approve", response_class=HTMLResponse)
async def approve_order(order_id: str, t: str, db: AsyncSession = Depends(get_db)):
    order = (await db.execute(
        select(PhantomOrder).where(PhantomOrder.id == order_id)
    )).scalar_one_or_none()
    if not order or not secrets.compare_digest(order.approve_token, t):
        return HTMLResponse("<h3>Invalid or expired approval link.</h3>", status_code=403)

    if order.status == "approved" and order.key_id:
        k = (await db.execute(select(PhantomLicenseKey).where(PhantomLicenseKey.id == order.key_id))).scalar_one_or_none()
        return HTMLResponse(f"<h3>Already approved.</h3><p>Key: <b>{k.key if k else '—'}</b> (sent to {order.email})</p>")

    key = PhantomLicenseKey(key=_gen_key(), price_inr=order.amount_inr, order_id=order.id)
    db.add(key)
    await db.flush()
    order.key_id = key.id
    order.status = "approved"
    order.approved_at = _now()
    await db.commit()

    send_email(
        order.email, "Your Phantom lifetime license key 🔑",
        f"""<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2>You're in, {order.name}!</h2>
          <p>Here's your Phantom <b>lifetime</b> license key:</p>
          <p style="font-size:22px;font-weight:700;letter-spacing:2px;background:#f3f2fb;padding:14px;border-radius:10px;text-align:center;">{key.key}</p>
          <p>Open Phantom → <b>Enter key</b> → paste it. One key works on one PC at a time;
             you can release it from a device to move to another.</p>
        </div>""",
    )
    return HTMLResponse(
        f"""<div style="font-family:sans-serif;max-width:480px;margin:60px auto;text-align:center;">
          <h2>✅ Approved</h2>
          <p>Key <b>{key.key}</b> generated and emailed to <b>{order.email}</b>.</p>
        </div>"""
    )
