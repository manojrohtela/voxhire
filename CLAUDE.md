# VoxHire — Project Context for AI Agents

> This file is auto-loaded into every Claude Code session. It exists so new
> conversations start with full context and don't need re-explaining. Keep it
> accurate — update it when architecture, deploy, or conventions change.

## What VoxHire is

VoxHire is a **recruiter SaaS platform** — AI-powered voice interviews. Recruiters
post jobs, upload candidate resumes, let an AI voice agent screen and interview
candidates, and get an automatically-scored feedback report.

It is a **multi-tenant** product with **two portals** and **three user roles**
(`UserRole`: `super_admin`, `org_admin`, `recruiter`):

### 1. Super-Admin portal
Platform operators. Scope is intentionally narrow — **super admins have NO
visibility into the interview process** (that's entirely per-organization).
- Built (`backend/app/api/v1/endpoints/admin.py`): create / edit / delete /
  toggle-active organizations, platform stats, bootstrap the first super admin.
- **PLANNED, NOT built yet** (as of 2026-06): **subscriptions** (create &
  customize plans, assign to orgs) and a **payment / billing dashboard**. There
  is currently *zero* subscription / billing / Stripe / Razorpay code, and
  `Organization` has only `name / slug / logo_url / is_active`. This is greenfield.

### 2. Organization portal (the bulk of the app)
The recruiting workflow, scoped to one organization:
1. An org user **creates Jobs** with required skills (`jobs.py`; JD skills
   extracted via LLM).
2. **Uploads resumes** — single via `resume.py` `/parse`, or **bulk via
   `POST /api/v1/candidates/bulk-parse`** (real multi-file endpoint; Bulk Upload
   Modal lives in `dashboard/candidates/page.tsx`). Candidates are de-duplicated
   by email/phone within the org (409 `DUPLICATE_CANDIDATE`).
3. HR **assigns a candidate to a job** (`CandidateJob` — M2M with score + status).
4. A **screening** invite (email) is sent; screening is an AI **Vapi** phone call.
5. After screening, an **interview is scheduled** (invite email with a link).
6. Candidate joins → **Vapi voice interview** in the browser.
7. Transcript → **LLM evaluation** (Groq) → **feedback report** scored on multiple
   parameters (skills, communication/confidence/clarity, strengths/weaknesses,
   resume-claim verification, recommendation).

## Tech stack

- **Frontend**: Next.js 14 (App Router) · React 18 · TypeScript · Tailwind v3 ·
  `framer-motion` · `next-themes` (light/dark/system) · `@vapi-ai/web` (Vapi Web SDK).
  Design system = "Aura" Material-3-style CSS-variable tokens in
  `src/app/globals.css` + `tailwind.config.ts`. Reusable UI in `src/components/ui/`.
- **Backend**: FastAPI · SQLAlchemy 2 (async) · Alembic · Groq (LLM) · Vapi · SMTP (Gmail).
- **DB**: Supabase Postgres (shared across environments — migrations apply once).
- **Voice**: **Vapi** is the production voice layer. An older custom WebSocket
  pipeline (Deepgram STT + Cartesia TTS, in `app/modules/voice_runtime/`) was
  **replaced by Vapi**; pre-Vapi state is preserved on branch
  `backup/pre-vapi-migration`.

## Repo layout

```
backend/
  app/
    api/v1/endpoints/   auth, admin, candidates, interviews, interview_vapi,
                        jobs, resume, screening, voice_ws
    api/v1/router.py    mounts all routers under /api/v1
    core/               config (settings/env), email (SMTP templates)
    db/                 models.py (SQLAlchemy), database.py
    modules/            auth, evaluation (Groq engine), voice_runtime (legacy), ...
    recruitment/        resume_intelligence (parser), screening_agent, scheduling, ...
  alembic/versions/     0001..0007 migrations
frontend/
  src/app/              App Router pages: auth, dashboard (candidates, jobs,
                        schedule, interviews/[id], settings, admin), interview/[sessionId],
                        interview/test, screening/[token], resume
  src/components/ui/    Button, Card, Input, Badge, Modal, SegmentedControl, Feedback, Motion
  src/hooks/            useVapiInterview (production), useStreamingInterview (legacy)
  src/lib/              api-client.ts, auth.tsx, cn.ts
docs/                   additional docs
```

## Deployment (IMPORTANT — read before deploying)

- **Frontend → Vercel via CLI**: `cd frontend && vercel --prod --yes`. It is
  **NOT git-auto-deploy** — pushing to GitHub `main` does NOT update the live site.
  Live at `https://voxhire.heyagenthive.com` (Cloudflare → Vercel). The Vercel
  project is `voxhire` (account `appmanojapple-5554`). Verify with
  `vercel alias ls | grep voxhire.heyagent`.
- **Backend → Oracle Cloud** server `140.245.10.153` (SSH user `ubuntu`, key
  `~/Desktop/ssh-key-2026-05-15.key`). Code at `/home/ubuntu/agents/voxhire`,
  runs as systemd `voxhire.service` on port 8013, served at
  `https://api.heyagenthive.com/voxhire/` via nginx. Deploy:
  `git pull origin main` → `cd backend && source venv/bin/activate &&
  alembic upgrade head` (if new migrations) → `sudo systemctl restart voxhire`.
- **Repo**: `github.com/manojrohtela/voxhire`.

### Deploy gotchas (these have bitten us)
- **Silent backend `git pull` aborts**: the server checkout has untracked files
  (`frontend/package-lock.json`, `frontend/.env.production`,
  `backend/app/modules/voice_runtime/models/`) that can make `git pull` ABORT
  ("untracked working tree files would be overwritten") while still printing an
  "Updating x..y" line — so `git pull | tail -1` hides the failure and the server
  silently stays on the old commit. **Always verify `git log --oneline -1` HEAD
  actually moved after a backend deploy.** Fix: `rm` the blocking untracked
  file(s), then pull. The server does NOT serve the frontend (Vercel does), so
  removing its frontend artifacts is safe.
- **CORS allow-headers**: browser calls authenticated with the `X-Interview-Token`
  header (interview config, transcript, violations) require that header in nginx's
  `Access-Control-Allow-Headers` for the `/voxhire/` location. It was missing once
  and silently broke the entire interview flow ("Failed to fetch" / stuck on
  "preparing"). Current allow-list: `Content-Type, Authorization, X-Interview-Token`.

## Vapi integration

- Two assistants (IDs in backend env): **interview** `VAPI_INTERVIEW_ASSISTANT_ID`
  (`8e44dddb-…`) and **screening** `VAPI_ASSISTANT_ID` (`8b58ccd6-…`).
- Browser flow: interview page calls `GET /api/v1/interviews/{session_id}/vapi-config`
  (auth: `X-Interview-Token` = the session's `link_token`) → gets public key +
  assistant id + `variableValues` (jobTitle, candidateName, requiredSkills,
  focusAreas, difficulty, …) → `useVapiInterview` runs `vapi.start(assistantId,
  { variableValues, metadata })`.
- `session_id == "test"` is a **dev bypass** in `get_vapi_config` (no DB/auth) so
  `/interview/test` can exercise the real Vapi flow without scheduling.
- End-of-call webhook: `POST /api/v1/interviews/vapi-webhook` (set this as the
  assistant's **Server URL** in the Vapi dashboard) → saves transcript → triggers
  async Groq evaluation. Secret: `VAPI_INTERVIEW_WEBHOOK_SECRET` (`X-Vapi-Secret`).
- **If the call connects but the AI never speaks**, it is a **Vapi dashboard
  config** problem (assistant needs Model + First message + Voice + Transcriber) —
  not our code.

## Key conventions

- **Theming**: use the Aura tokens (`bg-surface`, `text-foreground`,
  `border-base`, `text-primary`, etc.) — NOT raw hex or hardcoded `violet-*`.
  Brand = indigo (`--c-primary` `#4F46E5` light / `#6C63FF` dark). Light/dark/system
  all supported; the candidate **interview page is intentionally fixed-dark**.
- **Components**: prefer `src/components/ui/*` (cva + `cn()` from `src/lib/cn.ts`).
- **API client**: all frontend calls go through `src/lib/api-client.ts`
  (`request()` adds auth + token refresh; throws `Error` with `.status` and
  `.detail`). Interview-token endpoints use the `X-Interview-Token` header.
- **Rules of Hooks**: never put hooks after early returns (caused a prod crash,
  React #310, on the candidate page).
- **Migrations**: add an Alembic revision for any model change; the DB is shared
  so migrations run once on the server.

## Env vars

- Backend (`backend/.env`): `DATABASE_URL`, `SECRET_KEY`, `GROQ_API_KEY`,
  `VAPI_API_KEY`, `VAPI_PUBLIC_KEY`, `VAPI_ASSISTANT_ID` (screening),
  `VAPI_INTERVIEW_ASSISTANT_ID`, `VAPI_WEBHOOK_SECRET`,
  `VAPI_INTERVIEW_WEBHOOK_SECRET`, SMTP_* (Gmail), `FRONTEND_URL`,
  `CARTESIA_API_KEY` / `DEEPGRAM_API_KEY` (legacy voice).
- Frontend (Vercel project env): `NEXT_PUBLIC_API_URL` =
  `https://api.heyagenthive.com/voxhire`, `NEXT_PUBLIC_APP_DOMAIN`.

## Common commands

```bash
# Frontend
cd frontend && npm run build              # production build / typecheck
cd frontend && vercel --prod --yes        # deploy to production

# Backend (local)
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8001
cd backend && alembic upgrade head        # apply migrations

# Backend deploy (Oracle)
ssh -i ~/Desktop/ssh-key-2026-05-15.key ubuntu@140.245.10.153
  cd /home/ubuntu/agents/voxhire && git pull origin main \
    && cd backend && source venv/bin/activate && alembic upgrade head \
    && sudo systemctl restart voxhire
```

## Status / open items (update as these change)
- Interview voice flow migrated to Vapi; CORS + deploy issues resolved. Verify the
  Vapi assistant dashboard config if the AI connects but stays silent.
- Super-admin **subscriptions + payments**: not started.
