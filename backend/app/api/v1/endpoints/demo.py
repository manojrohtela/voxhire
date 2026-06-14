"""
Demo gate — captures a visitor's info (name + optional email/phone + optional
feedback) before they explore the demo, so the team can follow up. Public; no auth.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import DemoLead
from app.core.email import send_demo_lead

logger = logging.getLogger(__name__)
router = APIRouter()


class DemoLeadBody(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    message: Optional[str] = None


@router.post("/lead", status_code=201)
async def capture_demo_lead(body: DemoLeadBody, request: Request, db: AsyncSession = Depends(get_db)):
    name = (body.name or "").strip() or "Anonymous explorer"
    xff = request.headers.get("x-forwarded-for")
    ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else None)

    db.add(DemoLead(
        name=name, email=(body.email or "").strip() or None,
        phone=(body.phone or "").strip() or None,
        message=(body.message or "").strip() or None, ip=ip,
    ))
    await db.flush()

    # Notify the team (best-effort — never block entry to the demo).
    try:
        send_demo_lead(name, body.email or "", body.phone or "", body.message or "")
    except Exception as e:  # noqa: BLE001
        logger.warning("demo lead email failed: %s", e)

    return {"ok": True}
