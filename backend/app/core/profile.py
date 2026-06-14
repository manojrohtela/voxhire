"""Helpers for reading the (loosely-shaped) parsed resume profile."""

from typing import Any


def extract_candidate_skills(parsed_profile: Any, limit: int | None = None) -> list[str]:
    """
    Pull a flat list of skill strings from a candidate's parsed_profile.

    The resume parser is not strict about shape — `skills` may be:
      - a categorized dict: {"technical": [...], "frameworks": [...], ...}
      - a flat list of strings: ["Python", "React", ...]
      - a flat list of dicts: [{"name": "Python"}, ...]
    This normalizes all of those (and tolerates missing/None).
    """
    out: list[str] = []
    if not isinstance(parsed_profile, dict):
        return out
    raw = parsed_profile.get("skills")

    if isinstance(raw, dict):
        for category in ("technical", "languages", "frameworks", "tools", "soft"):
            vals = raw.get(category)
            if isinstance(vals, list):
                out.extend(str(v).strip() for v in vals if v)
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, str):
                out.append(item.strip())
            elif isinstance(item, dict):
                v = item.get("name") or item.get("skill") or item.get("title")
                if v:
                    out.append(str(v).strip())

    # de-dupe (case-insensitive), preserve order
    seen, deduped = set(), []
    for s in out:
        if s and s.lower() not in seen:
            seen.add(s.lower())
            deduped.append(s)
    return deduped[:limit] if limit else deduped
