import os
import sys
import tempfile
import uuid
from pathlib import Path


_TEST_DB_PATH_ENV = "OPEN_WEBUI_TEST_DB_PATH"


_TEST_ROOT = Path(__file__).resolve().parents[1]
if str(_TEST_ROOT) not in sys.path:
    # Ensure imports like "main" and "test.util" resolve when running pytest from repo root.
    sys.path.insert(0, str(_TEST_ROOT))


def _ensure_test_database_url() -> None:
    if os.environ.get("DATABASE_URL"):
        return

    # Keep tests isolated from docker-compose DATABASE_URL defaults in .env,
    # and avoid reusing persistent state between test runs.
    test_db_path = Path(tempfile.gettempdir()) / f"open_webui_test_{uuid.uuid4().hex}.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"
    os.environ[_TEST_DB_PATH_ENV] = str(test_db_path)


_ensure_test_database_url()


def pytest_sessionfinish(session, exitstatus) -> None:
    test_db_path = os.environ.get(_TEST_DB_PATH_ENV)
    if not test_db_path:
        return
    try:
        Path(test_db_path).unlink(missing_ok=True)
    except OSError:
        return
