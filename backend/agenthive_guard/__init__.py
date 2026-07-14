"""
AgentHive Guard — shared server-side quota + access gate for all agent backends.

Why server-side: CORS and any frontend counter are trivially bypassed (incognito,
curl, someone else's website). The only enforcement that holds is here.

Integration is two lines in an agent:

    from agenthive_guard import AgentHiveGuard, guarded_groq

    app.add_middleware(AgentHiveGuard, agent="resumeiq")   # 1. gate + record
    client = guarded_groq(api_key=...)                      # 2. capture tokens

`guarded_groq` returns a normal Groq client whose completions also report
token usage into the current request, so we bill real tokens rather than clicks.
"""

from .guard import AgentHiveGuard
from .groq_wrap import guarded_groq, record_tokens
from .identity import Subject

__all__ = ["AgentHiveGuard", "guarded_groq", "record_tokens", "Subject"]
