"""
Resume Intelligence API endpoints.
POST /api/v1/resume/parse — Upload and parse resume
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.recruitment.resume_intelligence.extractor import extract_resume_text
from app.recruitment.resume_intelligence.parser import parse_resume_with_groq, get_skill_suggestions
from app.recruitment.resume_intelligence.models import (
    CandidateProfile,
    SkillSuggestions,
    ResumeParseResponse,
)

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png", ".webp"}


@router.post("/parse", response_model=ResumeParseResponse)
async def parse_resume(file: UploadFile = File(...)):
    """
    Upload a resume (PDF/DOCX/Image) and get:
    - Structured candidate profile
    - AI-suggested skills for interview
    """
    # Validate file size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    # Validate extension
    from pathlib import Path
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, DOCX, JPG, PNG"
        )

    # Extract text
    try:
        resume_text = extract_resume_text(file_bytes, file.filename or "resume.pdf")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {str(e)}")

    if not resume_text or len(resume_text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="Could not extract readable text from this file. Try a different format."
        )

    # Parse with Groq
    try:
        raw_profile = parse_resume_with_groq(resume_text)
        candidate_profile = CandidateProfile(**raw_profile)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"Resume parsing failed: {str(e)}")

    # Get skill suggestions
    try:
        raw_suggestions = get_skill_suggestions(raw_profile)
        skill_suggestions = SkillSuggestions(**raw_suggestions)
    except ValueError as e:
        # Skill suggestions failing shouldn't break the whole response
        skill_suggestions = SkillSuggestions()

    return ResumeParseResponse(
        candidate_profile=candidate_profile,
        skill_suggestions=skill_suggestions,
        raw_text_length=len(resume_text),
        filename=file.filename or "resume",
    )
