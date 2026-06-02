"""
Resume text extraction from PDF, DOCX, and Image files.
Part of Resume Intelligence Engine — Recruitment Layer (Product 2)
"""

import io
from pathlib import Path
from typing import Optional


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF using PyMuPDF."""
    import fitz  # PyMuPDF

    text_parts = []
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        for page in doc:
            text_parts.append(page.get_text("text"))
    return "\n".join(text_parts).strip()


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX file."""
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs).strip()


def extract_text_from_image(file_bytes: bytes) -> str:
    """
    Extract text from image resume.
    Returns a placeholder — in production, use Tesseract OCR or a vision API.
    For now we pass the raw bytes hint to Groq vision if needed.
    """
    # TODO: integrate pytesseract or Groq vision for image OCR
    return "[IMAGE_RESUME: OCR extraction pending — integrate Tesseract or vision API]"


def extract_resume_text(file_bytes: bytes, filename: str) -> str:
    """
    Route to correct extractor based on file extension.
    Raises ValueError for unsupported formats.
    """
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext in (".docx", ".doc"):
        return extract_text_from_docx(file_bytes)
    elif ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
        return extract_text_from_image(file_bytes)
    else:
        raise ValueError(f"Unsupported file format: {ext}. Supported: PDF, DOCX, JPG, PNG")
