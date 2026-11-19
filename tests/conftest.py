"""Run the API tests against a fresh, seeded SQLite database.

The tests never touch the developer database in backend/data/, and they no longer
depend on scripts/dev_up.sh having seeded it first.
"""

import os
import tempfile
from pathlib import Path

_DATABASE_DIR = tempfile.mkdtemp(prefix="dayflow-tests-")
os.environ["DAYFLOW_DATABASE_URL"] = f"sqlite:///{Path(_DATABASE_DIR) / 'dayflow-test.db'}"
os.environ.setdefault("DAYFLOW_SECRET_KEY", "dayflow-test-secret-key-with-sufficient-length")

from backend.app.seed import seed  # noqa: E402  (must import after the environment is set)

seed()
