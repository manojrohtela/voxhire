"""
Groq-powered resume parser.
Extracts structured candidate profile + AI interview skill suggestions.
Part of Resume Intelligence Engine — Recruitment Layer (Product 2)
"""

import json
import re
from typing import Optional
from groq import Groq
from app.core.config import settings


EXTRACTION_PROMPT = """You are an expert resume parser. Extract ALL information from the resume text below and return ONLY valid JSON — no markdown, no backticks, no explanation.

Extract the following structure:

{
  "personal": {
    "name": "Full name or null",
    "email": "email or null",
    "phone": "phone number or null",
    "location": "city/state/country or null",
    "linkedin": "LinkedIn URL or null",
    "github": "GitHub URL or null",
    "portfolio": "portfolio/website URL or null"
  },
  "summary": "Professional summary in 2-3 sentences, synthesized from the resume. null if not present.",
  "experience": [
    {
      "company": "Company name",
      "role": "Job title",
      "duration": "e.g. Jan 2022 - Present",
      "years": 2.5,
      "description": "Key responsibilities and achievements in 2-3 sentences",
      "technologies": ["list", "of", "tech", "used"]
    }
  ],
  "education": [
    {
      "institution": "University/College name",
      "degree": "B.Tech / M.Tech / BCA etc",
      "field": "Computer Science / Electronics etc",
      "year": "Graduation year or expected year",
      "grade": "CGPA/percentage if mentioned or null"
    }
  ],
  "skills": {
    "technical": ["list of technical skills"],
    "languages": ["programming languages"],
    "frameworks": ["frameworks and libraries"],
    "tools": ["tools, platforms, cloud services"],
    "soft": ["soft skills if mentioned"]
  },
  "projects": [
    {
      "name": "Project name",
      "description": "What it does in 1-2 sentences",
      "technologies": ["tech", "used"],
      "url": "GitHub/demo URL or null"
    }
  ],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": "Issuing organization",
      "year": "Year or null"
    }
  ],
  "total_experience_years": 3.5
}

Resume text:
{resume_text}

Return ONLY the JSON object. No other text."""


SKILL_SUGGESTION_PROMPT = """You are a senior technical recruiter and interviewer. Based on the candidate profile below, suggest the best skills to evaluate in a technical interview.

Candidate Profile:
{candidate_profile}

Return ONLY valid JSON — no markdown, no explanation:

{
  "suggested_skills": [
    {
      "skill": "Skill name",
      "category": "Primary / Secondary / Bonus",
      "suggested_difficulty": "Easy / Medium / Hard",
      "reason": "1 sentence why this skill should be evaluated",
      "interview_areas": ["specific topics to cover in this skill"]
    }
  ],
  "recommended_interview_duration_minutes": 45,
  "interview_focus": "1-2 sentence summary of what this interview should focus on",
  "red_flags": ["any concerns noticed in the resume, e.g. gaps, inconsistencies"],
  "strengths": ["notable strengths visible from the resume"]
}

Return ONLY the JSON object."""


def _clean_json(text: str) -> str:
    """Strip markdown fences and whitespace from LLM response."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text, flags=re.MULTILINE)
    text = re.sub(r"```$", "", text, flags=re.MULTILINE)
    return text.strip()


def parse_resume_with_groq(resume_text: str) -> dict:
    """
    Extract structured candidate profile from resume text using Groq.
    Returns parsed candidate dict.
    """
    client = Groq(api_key=settings.GROQ_API_KEY)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": EXTRACTION_PROMPT.format(resume_text=resume_text[:8000]),  # token safety
            }
        ],
        temperature=0.1,
        max_tokens=3000,
    )

    raw = response.choices[0].message.content
    cleaned = _clean_json(raw)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse Groq response as JSON: {e}\nRaw: {raw[:500]}")


def get_skill_suggestions(candidate_profile: dict) -> dict:
    """
    Get AI-powered interview skill suggestions based on parsed candidate profile.
    Returns skill suggestions dict.
    """
    client = Groq(api_key=settings.GROQ_API_KEY)

    profile_text = json.dumps(candidate_profile, indent=2)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": SKILL_SUGGESTION_PROMPT.format(candidate_profile=profile_text[:4000]),
            }
        ],
        temperature=0.2,
        max_tokens=2000,
    )

    raw = response.choices[0].message.content
    cleaned = _clean_json(raw)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse skill suggestions as JSON: {e}\nRaw: {raw[:500]}")
