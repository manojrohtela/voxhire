"""
Optional SMTP email utility.
If SMTP_HOST is not configured, functions return False silently.
"""

import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    configured = bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)
    if not configured:
        logger.warning("SMTP not configured — SMTP_HOST=%r SMTP_USER=%r SMTP_PASSWORD set=%s",
                       settings.SMTP_HOST, settings.SMTP_USER, bool(settings.SMTP_PASSWORD))
    return configured


def send_screening_invitation(
    to_email: str,
    candidate_name: str,
    org_name: str,
    job_title: Optional[str],
    screening_url: str,
    expires_in_hours: int = 72,
) -> bool:
    """Send screening invitation email. Returns True if sent, False if SMTP not configured or failed."""
    if not _smtp_configured():
        return False

    subject = f"{org_name} — Your screening invitation is ready"
    job_line = f"for the <strong>{job_title}</strong> role " if job_title else ""

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#0f0e14;color:#e2e0f0;margin:0;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;background:#1a1825;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:48px;height:48px;background:#6c63ff;border-radius:12px;line-height:48px;text-align:center;font-size:22px;">🎙</div>
      <h1 style="color:#fff;font-size:22px;margin:16px 0 4px;">VoxHire Screening</h1>
      <p style="color:#888;font-size:14px;margin:0;">{org_name}</p>
    </div>

    <p style="color:#ccc;font-size:15px;line-height:1.6;">Hi <strong>{candidate_name}</strong>,</p>
    <p style="color:#ccc;font-size:15px;line-height:1.6;">
      You've been invited {job_line}to complete a quick AI-powered screening with <strong>{org_name}</strong>.
      The screening takes about 5–10 minutes and can be done from your browser — no downloads required.
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="{screening_url}"
         style="display:inline-block;background:#6c63ff;color:#fff;text-decoration:none;
                padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
        Start My Screening →
      </a>
    </div>

    <p style="color:#666;font-size:13px;text-align:center;">
      This link expires in {expires_in_hours} hours. If you have any issues, contact your recruiter directly.
    </p>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;">
    <p style="color:#555;font-size:12px;text-align:center;margin:0;">
      Powered by <a href="https://voxhire.ai" style="color:#6c63ff;text-decoration:none;">VoxHire</a>
    </p>
  </div>
</body>
</html>
"""

    plain = (
        f"Hi {candidate_name},\n\n"
        f"You've been invited {f'for the {job_title} role ' if job_title else ''}"
        f"to complete a quick AI-powered screening with {org_name}.\n\n"
        f"Start your screening here:\n{screening_url}\n\n"
        f"This link expires in {expires_in_hours} hours.\n\n"
        f"— VoxHire"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.FROM_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    logger.info("Sending screening invitation to %s via %s:%s (user=%s)",
                to_email, settings.SMTP_HOST, settings.SMTP_PORT, settings.SMTP_USER)
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())
        logger.info("Screening invitation sent successfully to %s", to_email)
        return True
    except Exception as exc:
        logger.error("Failed to send screening invitation to %s: %s", to_email, exc, exc_info=True)
        return False


def send_interview_invitation(
    to_email: str,
    candidate_name: str,
    org_name: str,
    job_title: Optional[str],
    interview_url: str,
    interview_availability: Optional[str] = None,
) -> bool:
    """Send auto-scheduled interview link to candidate. Returns True if sent."""
    if not _smtp_configured():
        return False

    subject = f"{org_name} — Your interview has been scheduled"
    job_line = f"for the <strong>{job_title}</strong> role " if job_title else ""
    avail_block = (
        f'<p style="color:#ccc;font-size:15px;line-height:1.6;">Your preferred availability: <strong>{interview_availability}</strong></p>'
        if interview_availability else ""
    )

    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#0f0e14;color:#e2e0f0;margin:0;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;background:#1a1825;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:48px;height:48px;background:#10b981;border-radius:12px;line-height:48px;text-align:center;font-size:22px;">🗓️</div>
      <h1 style="color:#fff;font-size:22px;margin:16px 0 4px;">Interview Scheduled</h1>
      <p style="color:#888;font-size:14px;margin:0;">{org_name}</p>
    </div>

    <p style="color:#ccc;font-size:15px;line-height:1.6;">Hi <strong>{candidate_name}</strong>,</p>
    <p style="color:#ccc;font-size:15px;line-height:1.6;">
      Your screening was successful and an AI-powered interview {job_line}has been scheduled with <strong>{org_name}</strong>.
    </p>
    {avail_block}

    <div style="text-align:center;margin:32px 0;">
      <a href="{interview_url}"
         style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;
                padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
        Join My Interview →
      </a>
    </div>

    <p style="color:#666;font-size:13px;text-align:center;">
      If you have any issues, contact your recruiter directly.
    </p>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;">
    <p style="color:#555;font-size:12px;text-align:center;margin:0;">
      Powered by <a href="https://voxhire.ai" style="color:#6c63ff;text-decoration:none;">VoxHire</a>
    </p>
  </div>
</body>
</html>
"""

    plain = (
        f"Hi {candidate_name},\n\n"
        f"Your screening was successful! Your interview {f'for the {job_title} role ' if job_title else ''}"
        f"with {org_name} has been scheduled.\n\n"
        + (f"Your preferred availability: {interview_availability}\n\n" if interview_availability else "")
        + f"Join your interview here:\n{interview_url}\n\n"
        f"— VoxHire"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.FROM_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())
        logger.info("Interview invitation sent successfully to %s", to_email)
        return True
    except Exception as exc:
        logger.error("Failed to send interview invitation to %s: %s", to_email, exc, exc_info=True)
        return False


def send_demo_lead(name: str, email: str, phone: str, message: str) -> bool:
    """Notify the team that someone is exploring the demo. Returns True if sent."""
    if not _smtp_configured():
        return False
    to_email = settings.FROM_EMAIL or settings.SMTP_USER
    subject = f"VoxHire demo — {name} is exploring 👀"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 12px;">New demo visitor</h2>
      <p style="color:#444;line-height:1.6;">
        <strong>Name:</strong> {name}<br/>
        <strong>Email:</strong> {email or '—'}<br/>
        <strong>Phone:</strong> {phone or '—'}
      </p>
      <p style="color:#444;line-height:1.6;"><strong>Feedback / feature wish:</strong><br/>{message or '—'}</p>
    </div>
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.FROM_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(f"{name} | {email} | {phone}\n\n{message}", "plain"))
    msg.attach(MIMEText(html, "html"))
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())
        return True
    except Exception as exc:
        logger.error("Failed to send demo lead notification: %s", exc)
        return False


def send_email(to_email: str, subject: str, html: str, plain: Optional[str] = None) -> bool:
    """Generic transactional email. Returns True if sent, False if SMTP off/failed."""
    if not _smtp_configured() or not to_email:
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.FROM_EMAIL or settings.SMTP_USER
    msg["To"] = to_email
    msg.attach(MIMEText(plain or subject, "plain"))
    msg.attach(MIMEText(html, "html"))
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(msg["From"], to_email, msg.as_string())
        return True
    except Exception as exc:
        logger.error("send_email failed: %s", exc)
        return False
