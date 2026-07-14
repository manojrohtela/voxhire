"""Work out WHO is making this request — a verified user, or an anonymous device."""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass

try:
    import jwt  # PyJWT
except ImportError:  # auth not wired yet -> everyone is anonymous
    jwt = None

# Our own access service signs these (HS256). SUPABASE_JWT_SECRET is kept as a
# fallback for when Google/Supabase Auth is wired in later.
AH_JWT_SECRET = os.getenv("AH_JWT_SECRET", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# VoxHire is a real SaaS with its OWN accounts. We trust its token rather than
# forcing recruiters through a second AgentHive signup — they're already
# authenticated customers. We only meter them, keyed on their organization.
VOXHIRE_JWT_SECRET = os.getenv("VOXHIRE_JWT_SECRET", "")
VOXHIRE_TIER = os.getenv("VOXHIRE_TIER", "voxhire")


@dataclass
class Subject:
    """The thing we meter. Either a signed-in user or an anonymous device."""

    type: str          # 'user' | 'device'
    id: str            # user uuid | device_key
    tier: str          # anonymous|pending|approved|rejected|blocked|pro
    email: str | None = None
    ip_hash: str | None = None

    @property
    def is_user(self) -> bool:
        return self.type == "user"


def _sha(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def client_ip(request) -> str:
    """
    Real client IP. nginx sits in front AND Cloudflare in front of that, so
    trust X-Real-IP (nginx sets it from $remote_addr, which the real_ip module
    has already rewritten to Cloudflare's CF-Connecting-IP). Falls back through
    X-Forwarded-For, then the socket.
    """
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


def device_key(fingerprint: str | None, ip: str) -> str:
    """
    Anonymous identity.

    Keyed on fingerprint + IP, deliberately NOT on a cookie/localStorage value:
    an incognito window throws those away, but it does NOT change the IP, and a
    browser fingerprint (canvas/WebGL/fonts/audio) largely survives it. Same
    person in a private window therefore lands in the same bucket.

    No fingerprint (curl, scripts) -> fall back to IP alone, which still meters
    them. Not bulletproof against VPN + spoofing; it isn't meant to be. It makes
    casual bulk abuse pointless, and real volume requires an approved account.
    """
    return _sha(fingerprint or "nofp", ip)


def _decode(token: str) -> dict | None:
    """Accept a token from our own access service, or (later) from Supabase Auth."""
    if AH_JWT_SECRET:
        try:
            return jwt.decode(token, AH_JWT_SECRET, algorithms=["HS256"])
        except Exception:
            pass
    if SUPABASE_JWT_SECRET:
        try:
            return jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"],
                              audience="authenticated")
        except Exception:
            pass
    return None


async def resolve(request, db) -> Subject:
    ip = client_ip(request)
    iph = _sha(ip)

    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer ") and jwt:
        token = auth.split(" ", 1)[1].strip()

        # A VoxHire access token: an already-authenticated paying customer.
        # Meter per ORGANIZATION (the customer), not per recruiter — a firm with
        # five recruiters shouldn't get five times the budget.
        if VOXHIRE_JWT_SECRET:
            try:
                vc = jwt.decode(token, VOXHIRE_JWT_SECRET, algorithms=["HS256"])
                if vc.get("type") == "access" and vc.get("sub"):
                    key = vc.get("org_id") or vc["sub"]
                    return Subject("user", f"vox:{key}", VOXHIRE_TIER, None, iph)
            except Exception:
                pass

        try:
            claims = _decode(token)
            uid = claims.get("sub") if claims else None
            if uid:
                row = await db.fetchrow(
                    "select id, email, status, tier from ah_users where id = $1::uuid", uid
                )
                if row:
                    # A user's effective tier IS their status, except that an
                    # approved user may have been upgraded to a paid tier.
                    tier = row["tier"] if row["status"] == "approved" and row["tier"] == "pro" else row["status"]
                    return Subject("user", str(row["id"]), tier, row["email"], iph)
                # Authenticated with Supabase but no ah_users row yet: they have
                # not told us why they want access -> pending, not anonymous.
                return Subject("user", uid, "pending", claims.get("email"), iph)
        except Exception:
            pass  # bad/expired token -> fall through to anonymous, never 500

    fp = request.headers.get("x-device-id")
    return Subject("device", device_key(fp, ip), "anonymous", None, iph)
