"""
Rate limiting (slowapi). Keyed on the real client IP (behind nginx, that's the
first X-Forwarded-For entry). A generous global default protects against abuse;
specific endpoints (e.g. login) apply tighter limits via @limiter.limit.

Note: in-memory storage = per-process. With multiple workers, back it with Redis
(`storage_uri=settings.REDIS_URL`) for shared limits.
"""

from slowapi import Limiter
from starlette.requests import Request


def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "anonymous"


limiter = Limiter(key_func=client_ip, default_limits=["240/minute"])
