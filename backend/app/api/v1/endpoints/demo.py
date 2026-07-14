"""
Demo access requests.

The demo used to be open to anyone: a shared account behind a name/phone form,
with the credentials shipped in the JS bundle. Now a visitor *requests* it —
they say who they are and what they want to see, we get an email with a
one-click "send them the credentials" button, and access is handed out
deliberately rather than taken.

Public; no auth.
"""

import hashlib
import hmac
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.email import send_email
from app.db.database import get_db
from app.db.models import DemoLead

logger = logging.getLogger(__name__)
router = APIRouter()

OWNER = settings.PHANTOM_OWNER_EMAIL or settings.FROM_EMAIL or settings.SMTP_USER
DEMO_EMAIL = getattr(settings, "DEMO_EMAIL", "") or "demo@voxhire.ai"
DEMO_PASSWORD = getattr(settings, "DEMO_PASSWORD", "")


def _token(lead_id: str) -> str:
    """Signed one-click token, so we don't add a DB column just to hold a nonce."""
    return hmac.new(
        settings.SECRET_KEY.encode(), f"demo:{lead_id}".encode(), hashlib.sha256
    ).hexdigest()[:32]


class DemoRequestBody(BaseModel):
    name: str
    email: str
    company: Optional[str] = None
    message: Optional[str] = None      # "what would you like to see?"


@router.post("/request", status_code=201)
async def request_demo(body: DemoRequestBody, request: Request, db: AsyncSession = Depends(get_db)):
    name = (body.name or "").strip()
    email = (body.email or "").strip().lower()
    if not name or "@" not in email:
        raise HTTPException(400, detail="Name and a valid email are required.")

    xff = request.headers.get("x-forwarded-for")
    ip = (request.headers.get("x-real-ip")
          or (xff.split(",")[0].strip() if xff else None)
          or (request.client.host if request.client else None))

    # Company + intent both ride in `message`, so no schema change is needed.
    note = " · ".join(x for x in [(body.company or "").strip(), (body.message or "").strip()] if x)

    lead = DemoLead(name=name, email=email, phone=None, message=note or None, ip=ip)
    db.add(lead)
    await db.flush()
    lead_id = lead.id
    await db.commit()

    base = (getattr(settings, "API_BASE_URL", "") or "https://api.heyagenthive.com/voxhire").rstrip("/")
    grant_url = f"{base}/api/v1/demo/grant/{lead_id}?t={_token(lead_id)}"

    try:
        send_email(
            OWNER,
            f"VoxHire demo request — {name}",
            f"""<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
              <h2>New demo request</h2>
              <p><b>Name:</b> {name}<br/>
                 <b>Email:</b> {email}<br/>
                 <b>Company:</b> {(body.company or '—')}</p>
              <p><b>What they want to see:</b></p>
              <blockquote style="background:#f4f4f8;padding:12px 16px;border-left:3px solid #4F46E5;margin:0">
                {(body.message or '—')}
              </blockquote>
              <p style="margin-top:22px">
                <a href="{grant_url}" style="background:#4F46E5;color:#fff;padding:11px 20px;border-radius:8px;
                   text-decoration:none;font-weight:600">📧 Send them the demo credentials</a>
              </p>
              <p style="color:#888;font-size:12px">Or just ignore this email to decline.</p>
            </div>""",
        )
    except Exception as e:  # noqa: BLE001 — an email hiccup must not fail their request
        logger.warning("demo request email failed: %s", e)

    return {"ok": True, "message": "Thanks! We'll email you demo access shortly."}


@router.get("/grant/{lead_id}", response_class=HTMLResponse)
async def grant_demo(lead_id: str, t: str, db: AsyncSession = Depends(get_db)):
    """One click from the owner's email: send this person the demo credentials."""
    if not hmac.compare_digest(t, _token(lead_id)):
        return HTMLResponse("<h3>Invalid or expired link.</h3>", status_code=403)

    lead = (await db.execute(select(DemoLead).where(DemoLead.id == lead_id))).scalar_one_or_none()
    if not lead or not lead.email:
        return HTMLResponse("<h3>Request not found.</h3>", status_code=404)

    if not DEMO_PASSWORD:
        return HTMLResponse(
            "<h3>DEMO_PASSWORD isn't set on the server.</h3>"
            "<p>Add it to the backend .env, restart, then click this link again.</p>",
            status_code=500,
        )

    login_url = f"{(settings.FRONTEND_URL or 'https://voxhire.heyagenthive.com').rstrip('/')}/auth/login"
    send_email(
        lead.email,
        "Your VoxHire demo access 🎧",
        f"""<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <h2>Hi {lead.name.split()[0]}, here's your demo access</h2>
          <p>Sign in at <a href="{login_url}">{login_url}</a> with:</p>
          <p style="background:#f3f2fb;padding:16px;border-radius:10px;font-size:15px">
            <b>Email:</b> {DEMO_EMAIL}<br/>
            <b>Password:</b> {DEMO_PASSWORD}
          </p>
          <p>It's a fully-loaded workspace — sample jobs, candidates, and AI-scored interview
             reports. Have a look around, and just reply to this email with any questions.</p>
        </div>""",
    )
    return HTMLResponse(
        f"""<div style="font-family:system-ui,sans-serif;max-width:460px;margin:70px auto;text-align:center">
          <h2>✅ Sent</h2>
          <p>Demo credentials emailed to <b>{lead.email}</b>.</p>
        </div>"""
    )
