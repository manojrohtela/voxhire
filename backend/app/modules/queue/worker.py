"""
Arq worker — runs durable background jobs (LLM evaluation, etc.).

Run on the server as its own process:
    arq app.modules.queue.worker.WorkerSettings

Requires REDIS_URL in the environment. The worker re-uses the exact same task
logic as the in-process fallback, so behavior is identical either way.
"""

import logging

from arq.connections import RedisSettings

from app.core.config import settings

logger = logging.getLogger(__name__)


async def run_evaluation_task(ctx, session_id: str):
    """Durable wrapper around the interview LLM evaluation."""
    # Imported lazily to keep worker import light and avoid import cycles.
    from app.api.v1.endpoints.interview_vapi import _run_evaluation_task
    logger.info("Worker: running evaluation for session %s", session_id)
    await _run_evaluation_task(session_id)


class WorkerSettings:
    functions = [run_evaluation_task]
    redis_settings = (
        RedisSettings.from_dsn(settings.REDIS_URL) if settings.REDIS_URL else RedisSettings()
    )
    max_tries = 3          # retry transient LLM/DB failures
    job_timeout = 300      # seconds — evaluation should finish well within this
