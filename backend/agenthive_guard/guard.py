"""The gate. Checks quota before the work, records real token cost after it."""

from __future__ import annotations

import json
import logging
import os

import asyncpg
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from . import groq_wrap, identity

log = logging.getLogger("agenthive_guard")

DATABASE_URL = os.getenv("AH_DATABASE_URL") or os.getenv("DATABASE_URL", "")
# Fail OPEN if the guard's DB is unreachable. A quota service outage must not
# take 13 products down; nginx per-IP limits still cap the blast radius.
FAIL_OPEN = os.getenv("AH_FAIL_OPEN", "1") == "1"

# Endpoints that cost nothing and must never be gated.
SKIP_PATHS = ("/health", "/healthz", "/docs", "/openapi.json", "/redoc")

SIGNUP_URL = os.getenv("AH_SIGNUP_URL", "https://heyagenthive.com/access")

_pool: asyncpg.Pool | None = None


async def _get_pool() -> asyncpg.Pool | None:
    global _pool
    if _pool is None and DATABASE_URL:
        dsn = DATABASE_URL.replace("+asyncpg", "").split("?")[0]
        # Small pool: 13 services share one 1GB box.
        _pool = await asyncpg.create_pool(
            dsn, min_size=1, max_size=3, statement_cache_size=0, timeout=10
        )
    return _pool


def _denied(reason: str, message: str, **extra) -> JSONResponse:
    # 402-ish semantics, but we use 429 for "out of quota" and 403 for "not
    # allowed at all", so the frontend can branch on `reason` alone.
    status = 403 if reason in ("pending_approval", "rejected", "blocked") else 429
    body = {"error": reason, "reason": reason, "message": message, **extra}
    return JSONResponse(body, status_code=status, headers={"Access-Control-Allow-Origin": "*"})


class AgentHiveGuard(BaseHTTPMiddleware):
    """
    agent   : name used for the quota bucket + ah_limits lookup
    protect : substrings of paths that actually cost an LLM call. Only these are
              metered. Pass it — several agents mix expensive LLM routes with
              cheap DB lookups (MediFriend's medicine search is a public service
              and must stay free; charging a run for it would break the product).
              If omitted, EVERYTHING except SKIP_PATHS is metered.
    """

    def __init__(self, app, agent: str, protect: list[str] | None = None):
        super().__init__(app)
        self.agent = agent
        self.protect = protect

    def _is_metered(self, path: str) -> bool:
        if any(path.endswith(p) for p in SKIP_PATHS):
            return False
        if self.protect is None:
            return True
        return any(p in path for p in self.protect)

    async def dispatch(self, request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or not self._is_metered(path):
            return await call_next(request)

        pool = await _get_pool()
        if pool is None:
            if FAIL_OPEN:
                return await call_next(request)
            return _denied("unavailable", "Access control is unavailable. Try again shortly.")

        ip_consumed = False  # did we take from the IP backstop bucket?
        try:
            async with pool.acquire() as db:
                subj = await identity.resolve(request, db)

                limits = await db.fetchrow(
                    """select runs_per_day, tokens_per_day from ah_limits
                       where tier = $1 and agent in ($2, '*')
                       order by (agent = $2) desc limit 1""",
                    subj.tier, self.agent,
                )
                if limits is None:
                    limits = {"runs_per_day": 0, "tokens_per_day": 0}

                # Hard-stop tiers: no quota to spend at all.
                if (limits["runs_per_day"] or 0) <= 0:
                    if subj.tier == "pending":
                        await self._event(db, subj, "pending_approval")
                        return _denied(
                            "pending_approval",
                            "Thanks! Your access request is being reviewed — "
                            "we'll email you as soon as it's approved.",
                        )
                    if subj.tier in ("rejected", "blocked"):
                        await self._event(db, subj, subj.tier)
                        return _denied("rejected", "This account doesn't have access to the agents.")

                # ── Anonymous backstop, keyed on IP ALONE ──────────────────
                # X-Device-Id is supplied by the client, so a script can send a
                # fresh random fingerprint every call and mint unlimited
                # anonymous quota. The IP bucket is what actually stops that:
                # spoof the fingerprint all you like, the IP still meters you.
                # Set higher than the per-device limit so several genuine users
                # behind one office/college NAT aren't locked out.
                if subj.type == "device":
                    ipl = await db.fetchrow(
                        """select runs_per_day, tokens_per_day from ah_limits
                           where tier='anonymous_ip' and agent in ($1,'*')
                           order by (agent = $1) desc limit 1""",
                        self.agent,
                    )
                    if ipl:
                        ip_row = await db.fetchrow(
                            "select * from ah_try_consume($1,$2,$3,$4,$5)",
                            "ip", subj.ip_hash, self.agent,
                            ipl["runs_per_day"], ipl["tokens_per_day"],
                        )
                        if not ip_row["allowed"]:
                            await self._event(db, subj, "ip_quota_exceeded")
                            return _denied(
                                "signup_required",
                                "This network has used its free runs for today. "
                                "Sign in and tell us what you need the agents for to keep going.",
                                signup_url=SIGNUP_URL,
                            )
                        ip_consumed = True

                # Atomic check+reserve: two parallel requests can't both slip
                # past the last remaining run.
                row = await db.fetchrow(
                    "select * from ah_try_consume($1,$2,$3,$4,$5)",
                    subj.type, subj.id, self.agent,
                    limits["runs_per_day"], limits["tokens_per_day"],
                )

                if not row["allowed"]:
                    # Device bucket is out but we already took from the IP
                    # bucket — hand it back, or the IP drains on blocked calls.
                    if ip_consumed:
                        await db.execute(
                            """update ah_usage set runs = greatest(0, runs - 1)
                               where subject_type='ip' and subject_id=$1
                                 and agent=$2 and day=current_date""",
                            subj.ip_hash, self.agent,
                        )
                    if subj.is_user:
                        await self._event(db, subj, "quota_exceeded")
                        return _denied(
                            "quota_exceeded",
                            f"You've used your {limits['runs_per_day']} runs for today. "
                            "Your quota resets at midnight.",
                            runs_limit=limits["runs_per_day"],
                        )
                    await self._event(db, subj, "signup_required")
                    return _denied(
                        "signup_required",
                        f"You've used your {limits['runs_per_day']} free runs. "
                        "Sign in and tell us what you need the agents for to keep going.",
                        signup_url=SIGNUP_URL,
                        runs_limit=limits["runs_per_day"],
                    )

                runs_used = row["runs_used"]
                if subj.type == "device":
                    await db.execute(
                        """insert into ah_devices(device_key, fingerprint, ip_hash)
                           values ($1,$2,$3)
                           on conflict (device_key) do update set last_seen = now()""",
                        subj.id, request.headers.get("x-device-id"), subj.ip_hash,
                    )
        except Exception as e:  # guard must never take the product down
            log.exception("guard failed: %s", e)
            if FAIL_OPEN:
                return await call_next(request)
            return _denied("unavailable", "Access control is unavailable. Try again shortly.")

        # ── Run the real work, then bill the tokens it actually used ────────
        groq_wrap.start_request()

        # An unhandled error in the agent PROPAGATES through call_next rather
        # than coming back as a 500 response, so we must catch it here — else
        # the reservation below is never refunded and a crash costs the user a run.
        failed = False
        try:
            response = await call_next(request)
        except BaseException:
            prompt, completion = groq_wrap.get_tokens()
            await self._settle(pool, subj, refund=True, refund_ip=ip_consumed,
                               prompt=prompt, completion=completion)
            raise

        prompt, completion = groq_wrap.get_tokens()

        # We reserve the run BEFORE the work (so parallel calls can't race past
        # the limit). Give it back when the user got nothing for it:
        #   5xx           -> our failure, never the user's fault
        #   4xx, 0 tokens -> rejected before the LLM ran (e.g. a 422 validation
        #                    error), so it cost us nothing and must cost them nothing
        # A 4xx that DID spend tokens still counts — the Groq bill is real.
        spent = prompt + completion
        refund = response.status_code >= 500 or (response.status_code >= 400 and spent == 0)

        await self._settle(pool, subj, refund=refund, refund_ip=ip_consumed and refund,
                           prompt=prompt, completion=completion)
        if refund:
            runs_used = max(0, runs_used - 1)

        remaining = max(0, (limits["runs_per_day"] or 0) - runs_used)
        response.headers["X-AH-Runs-Remaining"] = str(remaining)
        response.headers["X-AH-Tier"] = subj.tier
        return response

    async def _settle(self, pool, subj, *, refund: bool, refund_ip: bool,
                      prompt: int, completion: int) -> None:
        """Write the real cost of the request: tokens spent, run refunded if we failed."""
        if not (refund or refund_ip or prompt or completion):
            return
        try:
            async with pool.acquire() as db:
                await db.execute(
                    """update ah_usage
                          set runs = greatest(0, runs - $4),
                              prompt_tokens = prompt_tokens + $5,
                              completion_tokens = completion_tokens + $6
                        where subject_type=$1 and subject_id=$2
                          and agent=$3 and day=current_date""",
                    subj.type, subj.id, self.agent,
                    1 if refund else 0, prompt, completion,
                )
                if refund_ip:
                    # The IP backstop was charged too — give that back as well.
                    await db.execute(
                        """update ah_usage set runs = greatest(0, runs - 1)
                           where subject_type='ip' and subject_id=$1
                             and agent=$2 and day=current_date""",
                        subj.ip_hash, self.agent,
                    )
        except Exception:
            log.exception("failed to settle usage")

    async def _event(self, db, subj, kind: str) -> None:
        try:
            await db.execute(
                "insert into ah_events(subject_id, agent, kind, ip_hash) values ($1,$2,$3,$4)",
                subj.id, self.agent, kind, subj.ip_hash,
            )
        except Exception:
            pass
