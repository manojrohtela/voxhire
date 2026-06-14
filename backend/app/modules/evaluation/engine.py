"""
LLM Evaluation Engine — runs after interview completion.

Takes the full Vapi transcript + candidate/job context and produces a
structured evaluation report. Entirely under our control — Vapi is NOT
involved in scoring or hiring decisions.

Output shape matches InterviewSession evaluation columns + skill_evaluations table.
"""

import json
import logging
from typing import Optional

from groq import AsyncGroq

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Optional[AsyncGroq] = None


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


def _format_transcript(transcript: list[dict]) -> str:
    lines = []
    for entry in transcript:
        role = entry.get("role", entry.get("speaker", "unknown"))
        text = entry.get("text", entry.get("content", "")).strip()
        if text:
            speaker = "Interviewer" if role in ("assistant", "ai") else "Candidate"
            lines.append(f"{speaker}: {text}")
    return "\n".join(lines)


_EVAL_SYSTEM = """You are an expert technical recruiter and interview analyst.
Analyze the provided interview transcript against the candidate's resume and job requirements.
Return ONLY valid JSON matching the exact schema provided. No explanation, no markdown fences."""


_EVAL_SCHEMA = """{
  "overall_rating": "Strong Hire | Hire | Consider | Reject",
  "executive_summary": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weak_areas": ["weakness 1", "weakness 2"],
  "communication_score": 0,
  "confidence_score": 0,
  "clarity_score": 0,
  "ai_summary": "2-3 sentence narrative summary for the recruiter",
  "skill_evaluations": [
    {
      "skill": "skill name",
      "rating": "Strong | Medium | Weak",
      "score": 0,
      "questions_asked": 0,
      "ai_notes": "1-2 sentence assessment of this skill",
      "confidence_level": "High | Medium | Low"
    }
  ],
  "topics_covered": ["topic 1", "topic 2"],
  "topics_missing": ["topic 1"],
  "topics_needs_evaluation": ["topic 1"],
  "resume_claim_verification": [
    {
      "claim": "claim from resume",
      "interview_evidence": "what candidate said about it",
      "verdict": "Verified | Partially Verified | Not Verified"
    }
  ],
  "candidate_questions": ["question the candidate asked"],
  "interview_timeline": [
    {"stage": "Introduction", "summary": "brief summary"},
    {"stage": "Technical Discussion", "summary": "brief summary"},
    {"stage": "Wrap-up", "summary": "brief summary"}
  ]
}"""


async def run_evaluation(
    *,
    transcript: list[dict],
    candidate_name: str,
    applied_role: str,
    skills_to_assess: list[str],
    resume_summary: Optional[str] = None,
    parsed_profile: Optional[dict] = None,
    job_description: Optional[str] = None,
    difficulty: str = "Medium",
    interview_type: str = "Technical",
    duration_minutes: int = 45,
) -> dict:
    """
    Run LLM evaluation on interview transcript. Returns structured evaluation dict.
    Raises on LLM error — caller should catch and set evaluation_status='failed'.
    """
    transcript_text = _format_transcript(transcript)
    if not transcript_text.strip():
        raise ValueError("Empty transcript — cannot evaluate")

    # Build resume context
    resume_ctx = ""
    if resume_summary:
        resume_ctx += f"Resume Summary: {resume_summary}\n"
    if isinstance(parsed_profile, dict):
        from app.core.profile import extract_candidate_skills
        exp = parsed_profile.get("total_experience_years") or parsed_profile.get("experience", {})
        edu = parsed_profile.get("education", [])
        candidate_skills = extract_candidate_skills(parsed_profile, limit=20)
        if candidate_skills:
            resume_ctx += f"Candidate Skills on Resume: {', '.join(candidate_skills[:20])}\n"
        if exp:
            resume_ctx += f"Experience: {exp}\n"
        if edu:
            edu_text = "; ".join(
                f"{e.get('degree', '')} from {e.get('institution', '')}" for e in edu[:3]
            )
            if edu_text.strip("; "):
                resume_ctx += f"Education: {edu_text}\n"

    jd_ctx = f"\nJob Description:\n{job_description[:2000]}" if job_description else ""

    prompt = f"""Evaluate this {interview_type} interview for the role of {applied_role}.
Candidate: {candidate_name}
Difficulty: {difficulty}
Duration: {duration_minutes} minutes
Skills to assess: {', '.join(skills_to_assess) if skills_to_assess else 'General skills for role'}

{resume_ctx}{jd_ctx}

INTERVIEW TRANSCRIPT:
{transcript_text}

Scoring guidelines:
- communication_score, confidence_score, clarity_score: 0-100 integers
- skill score: 0-100 integer (0=not demonstrated, 50=adequate, 80+=strong)
- Evaluate ONLY skills actually discussed in the transcript
- executive_summary: 5-8 recruiter-focused bullets, each under 15 words
- Resume claim verification: check 2-4 key claims from the resume against what was said
- Be honest and specific — vague answers should score lower

Return exactly this JSON schema (fill all fields):
{_EVAL_SCHEMA}"""

    response = await _get_client().chat.completions.create(
        model=settings.GROQ_LLM_MODEL,
        messages=[
            {"role": "system", "content": _EVAL_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=3000,
    )

    raw = response.choices[0].message.content or ""

    # Strip markdown fences if present
    if "```" in raw:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        raw = raw[start:end]

    result = json.loads(raw)

    # Normalise rating field values
    rating_map = {
        "strong hire": "Strong Hire", "strong_hire": "Strong Hire",
        "hire": "Hire",
        "consider": "Consider", "borderline": "Consider", "maybe": "Consider",
        "no hire": "Reject", "no_hire": "Reject", "reject": "Reject",
    }
    raw_rating = str(result.get("overall_rating", "")).lower()
    result["overall_rating"] = rating_map.get(raw_rating, "Consider")

    # Clamp scores to 0-100
    for field in ("communication_score", "confidence_score", "clarity_score"):
        val = result.get(field)
        if isinstance(val, (int, float)):
            result[field] = max(0, min(100, int(val)))
        else:
            result[field] = 50

    for skill_eval in result.get("skill_evaluations", []):
        score = skill_eval.get("score")
        if isinstance(score, (int, float)):
            skill_eval["score"] = max(0, min(100, int(score)))
        else:
            skill_eval["score"] = 50

        rating_raw = str(skill_eval.get("rating", "")).lower()
        skill_eval["rating"] = {"strong": "Strong", "medium": "Medium", "weak": "Weak"}.get(
            rating_raw, "Medium"
        )

    return result
