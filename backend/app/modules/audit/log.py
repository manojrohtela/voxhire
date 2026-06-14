"""
Audit logging helper. `record(...)` appends an AuditLog row using the caller's
existing DB session. Best-effort: a logging failure must never break the action
being audited, so all errors are swallowed (and warned).
"""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog

logger = logging.getLogger(__name__)


async def record(
    db: AsyncSession,
    *,
    action: str,
    actor: Optional[dict] = None,          # current_user dict (id, email, org_id)
    org_id: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    meta: Optional[dict] = None,
    ip: Optional[str] = None,
) -> None:
    try:
        db.add(AuditLog(
            org_id=org_id or (actor or {}).get("org_id"),
            actor_user_id=(actor or {}).get("id"),
            actor_email=(actor or {}).get("email"),
            action=action,
            target_type=target_type,
            target_id=target_id,
            meta=meta,
            ip=ip,
        ))
        await db.flush()
    except Exception as e:  # noqa: BLE001 — auditing must never break the request
        logger.warning("Audit record failed for %s: %s", action, e)
