"""
Capture Groq token usage without touching every call site.

Each agent builds a Groq client and calls `client.chat.completions.create(...)`
in several places. Rather than editing every call, we wrap `create` once: it
still returns the normal Groq response, but it also adds `response.usage` into a
per-request tally that the middleware flushes to the DB afterwards.

A ContextVar (not a global) keeps the tally per-request, so concurrent requests
can't credit their tokens to each other. It also propagates into the threadpool
FastAPI uses for sync endpoints.
"""

from __future__ import annotations

import contextvars

# The Groq SDK is imported LAZILY, inside guarded_groq(). Several agents
# (MediFriend, Plotify) call the Groq REST API directly over httpx/requests and
# never install the SDK — a module-level `from groq import Groq` would crash
# those services on startup. They use record_tokens() instead.

# (prompt_tokens, completion_tokens) accumulated during the current request
_tokens: contextvars.ContextVar[list[int]] = contextvars.ContextVar("ah_tokens")


def start_request() -> None:
    _tokens.set([0, 0])


def get_tokens() -> tuple[int, int]:
    try:
        p, c = _tokens.get()
        return p, c
    except LookupError:
        return 0, 0


def record_tokens(prompt: int, completion: int) -> None:
    """
    For agents that hit the Groq REST API directly (httpx/requests) rather than
    through the SDK — MediFriend and Plotify do. Call this with the `usage` block
    from the response so their tokens are billed like everyone else's.
    """
    _add(int(prompt or 0), int(completion or 0))


def _add(prompt: int, completion: int) -> None:
    try:
        tally = _tokens.get()
    except LookupError:
        return  # called outside a guarded request (e.g. a warmup script)
    tally[0] += prompt
    tally[1] += completion


class _Completions:
    def __init__(self, inner):
        self._inner = inner

    def create(self, *args, **kwargs):
        resp = self._inner.create(*args, **kwargs)
        usage = getattr(resp, "usage", None)
        if usage is not None:
            _add(getattr(usage, "prompt_tokens", 0) or 0,
                 getattr(usage, "completion_tokens", 0) or 0)
        return resp

    def __getattr__(self, name):
        return getattr(self._inner, name)


class _Chat:
    def __init__(self, inner):
        self._inner = inner
        self.completions = _Completions(inner.completions)

    def __getattr__(self, name):
        return getattr(self._inner, name)


class _GuardedGroq:
    """Quacks like Groq; only `chat.completions.create` is instrumented."""

    def __init__(self, *args, **kwargs):
        from groq import Groq  # lazy: only agents that use the SDK need it installed

        self._inner = Groq(*args, **kwargs)
        self.chat = _Chat(self._inner.chat)

    def __getattr__(self, name):
        return getattr(self._inner, name)


def guarded_groq(*args, **kwargs) -> _GuardedGroq:
    """Drop-in for `Groq(...)` that reports token usage to the guard."""
    return _GuardedGroq(*args, **kwargs)
