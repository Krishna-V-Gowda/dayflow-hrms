#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt

python -m backend.app.seed

( cd backend && uvicorn app.main:app --reload --port 8000 ) &
BACKEND_PID=$!

( cd frontend && npm run dev -- --host 127.0.0.1 ) &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true' EXIT INT TERM
wait
