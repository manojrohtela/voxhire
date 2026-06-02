# AI Voice Platform

A conversational AI platform for conducting human-like voice interviews.

## Structure

```
voxhire/
├── backend/          # FastAPI — core platform + recruitment modules
├── frontend/         # Next.js — recruiter dashboard + browser interview
└── docs/             # Architecture decisions, API contracts
```

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Stack
- **Frontend**: Next.js, TypeScript, TailwindCSS
- **Backend**: FastAPI, Python
- **STT**: Faster Whisper (local)
- **LLM**: Groq
- **TTS**: Cartesia
- **Architecture**: Modular Monolith
