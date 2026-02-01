from __future__ import annotations

from pathlib import Path
import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure CWD points at backend so "static" exists for StaticFiles.
os.chdir(Path(__file__).resolve().parents[1])

# Ensure settings can initialize during import time.
os.environ.setdefault(
    "NMM_DATABASE_URL",
    f"sqlite:///{Path(tempfile.gettempdir()) / 'nmm_test_env.db'}",
)

from app.main import create_app
import app.main as app_main
import app.core.paths as core_paths
import app.modules.media.service as media_service
from app.db.base import Base
from app.db import models  # noqa: F401
from app.db.session import get_db
import app.modules.products.service as product_service


@pytest.fixture()
def db_session(tmp_path: Path):
    db_path = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session, tmp_path: Path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Redirect uploads to tmp for tests (avoid writing to /app/static/uploads).
    core_paths.UPLOAD_DIR = upload_dir
    app_main.UPLOAD_DIR = upload_dir
    product_service.UPLOAD_DIR = upload_dir
    media_service.UPLOAD_DIR = upload_dir

    app = create_app()

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    return TestClient(app)

