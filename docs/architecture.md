# Architecture Decisions

## Modular Monolith
Single repository, strict module boundaries. Each module under `backend/app/modules/` or `backend/app/recruitment/` is independently testable.

## Layer Separation
- **Platform Layer** (`app/modules/`): Conversation, Voice Runtime, Evaluation, Reporting, Workflow — reusable across products
- **Recruitment Layer** (`app/recruitment/`): Resume Intelligence, Skill Graph, Question Engine, Follow-Up Engine, Orchestrator — recruitment-specific

## API Versioning
All endpoints under `/api/v1/`. Breaking changes → new version prefix.
