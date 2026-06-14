#!/usr/bin/env bash
#
# Local CI — runs the same checks as .github/workflows/ci.yml, with zero cost
# (no GitHub Actions minutes). Run before pushing:  bash scripts/check.sh
# Optional: wire as a pre-push hook → ln -sf ../../scripts/check.sh .git/hooks/pre-push
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "── Frontend: typecheck + build ──────────────────────────────"
( cd "$ROOT/frontend" && npx tsc --noEmit && npm run build )

echo "── Backend: syntax + tests ──────────────────────────────────"
(
  cd "$ROOT/backend"
  # Use the venv if present, else current python.
  PY=python3
  [ -x venv/bin/python ] && PY=venv/bin/python
  DATABASE_URL="${DATABASE_URL:-postgresql://user:pass@localhost:5432/test}" \
  SECRET_KEY="${SECRET_KEY:-ci-test-secret}" \
  APP_ENV=test \
  bash -c "$PY -m compileall -q app main.py && $PY -m pytest"
)

echo "✓ All checks passed."
