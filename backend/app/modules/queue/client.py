"""
Job-queue client (Arq over Redis) with a graceful in-process fallback.

`try_enqueue` returns True if the job was handed to the durable queue, or False
if no queue is configured / it's unreachable — in which case the caller runs the
work in-process (preserving today's behavior). This makes the queue zero-risk to
roll out: nothing changes until REDIS_URL is set and the worker is running.
"""

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

_pool = None


async def _get_pool():
    global _pool
    if not settings.REDIS_URL:
        return None
    if _pool is None:
        from arq import create_pool
        from arq.connections import RedisSettings
        _pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    return _pool


async def try_enqueue(fn_name: str, *args, **kwargs) -> bool:
    """Enqueue a job to the durable queue. Returns False if unavailable (caller falls back)."""
    if not settings.REDIS_URL:
        return False
    try:
        pool = await _get_pool()
        if pool is None:
            return False
        await pool.enqueue_job(fn_name, *args, **kwargs)
        return True
    except Exception as e:  # noqa: BLE001 — never let queueing break the request path
        logger.warning("Enqueue of %s failed; running in-process instead: %s", fn_name, e)
        return False
