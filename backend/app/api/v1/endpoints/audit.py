"""
Audit log read API.
- Org users (org_admin/recruiter): see their own organization's entries.
- Super-admins: see everything, optionally filtered by ?org_id=.
"""

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import AuditLog, UserRole
from app.modules.auth.dependencies import get_current_user

router = APIRouter()


@router.get("")
async def list_audit_logs(
    org_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = max(1, min(limit, 200))
    q = select(AuditLog).order_by(desc(AuditLog.created_at))

    if current_user["role"] == UserRole.SUPER_ADMIN:
        if org_id:
            q = q.where(AuditLog.org_id == org_id)
    else:
        # Non-super-admins are scoped to their own org regardless of params.
        q = q.where(AuditLog.org_id == current_user["org_id"])

    rows = (await db.execute(q.offset(offset).limit(limit))).scalars().all()
    return [
        {
            "id": r.id, "org_id": r.org_id, "actor_user_id": r.actor_user_id,
            "actor_email": r.actor_email, "action": r.action,
            "target_type": r.target_type, "target_id": r.target_id,
            "meta": r.meta, "ip": r.ip,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
