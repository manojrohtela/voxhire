"""
One-time script to create the VoxHire super admin account.

Usage (from the backend/ directory):
    python scripts/seed_superadmin.py

Edit the constants below before running, or set env vars:
    SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD / SUPER_ADMIN_NAME
"""

import asyncio
import os
import sys
import uuid

# Make sure the backend package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.db.models import Organization, User, UserRole
from app.modules.auth.service import hash_password

SUPER_ADMIN_NAME     = os.getenv("SUPER_ADMIN_NAME",     "Super Admin")
SUPER_ADMIN_EMAIL    = os.getenv("SUPER_ADMIN_EMAIL",    "admin@voxhire.com")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "Admin@12345")


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # Abort if super admin already exists
        existing = (await db.execute(
            select(User).where(User.email == SUPER_ADMIN_EMAIL)
        )).scalar_one_or_none()
        if existing:
            print(f"[skip] Super admin already exists: {SUPER_ADMIN_EMAIL}")
            return

        # Get or create the system org
        system_org = (await db.execute(
            select(Organization).where(Organization.slug == "voxhire-platform")
        )).scalar_one_or_none()

        if not system_org:
            system_org = Organization(
                id=str(uuid.uuid4()),
                name="VoxHire Platform",
                slug="voxhire-platform",
            )
            db.add(system_org)
            await db.flush()

        admin = User(
            id=str(uuid.uuid4()),
            org_id=system_org.id,
            name=SUPER_ADMIN_NAME,
            email=SUPER_ADMIN_EMAIL,
            password_hash=hash_password(SUPER_ADMIN_PASSWORD),
            role=UserRole.SUPER_ADMIN,
            is_active=True,
        )
        db.add(admin)
        await db.commit()

        print("Super admin created successfully!")
        print(f"  Email:    {SUPER_ADMIN_EMAIL}")
        print(f"  Password: {SUPER_ADMIN_PASSWORD}")
        print(f"  Login at: http://admin.localhost:3000")
        print()
        print("Change this password immediately after first login.")


if __name__ == "__main__":
    asyncio.run(seed())
