"""
Pydantic models for Resume Intelligence Engine.
"""

from typing import Optional
from pydantic import BaseModel


class PersonalInfo(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None


class Experience(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    duration: Optional[str] = None
    years: Optional[float] = None
    description: Optional[str] = None
    technologies: list[str] = []


class Education(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field: Optional[str] = None
    year: Optional[str] = None
    grade: Optional[str] = None


class Skills(BaseModel):
    technical: list[str] = []
    languages: list[str] = []
    frameworks: list[str] = []
    tools: list[str] = []
    soft: list[str] = []


class Project(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    technologies: list[str] = []
    url: Optional[str] = None


class Certification(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    year: Optional[str] = None


class CandidateProfile(BaseModel):
    personal: PersonalInfo = PersonalInfo()
    summary: Optional[str] = None
    experience: list[Experience] = []
    education: list[Education] = []
    skills: Skills = Skills()
    projects: list[Project] = []
    certifications: list[Certification] = []
    total_experience_years: Optional[float] = None


class SuggestedSkill(BaseModel):
    skill: str
    category: str  # Primary / Secondary / Bonus
    suggested_difficulty: str  # Easy / Medium / Hard
    reason: str
    interview_areas: list[str] = []


class SkillSuggestions(BaseModel):
    suggested_skills: list[SuggestedSkill] = []
    recommended_interview_duration_minutes: int = 45
    interview_focus: Optional[str] = None
    red_flags: list[str] = []
    strengths: list[str] = []


class ResumeParseResponse(BaseModel):
    candidate_profile: CandidateProfile
    skill_suggestions: SkillSuggestions
    raw_text_length: int
    filename: str
