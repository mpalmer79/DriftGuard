"""Phase 4.1: SENTINEL_DB_PATH env override + WAL on filesystem DBs.

Two properties to pin:
1. Setting `SENTINEL_DB_PATH` to a tmp file routes the singleton DB
   through that file (writes survive a restart of the singleton).
2. The Phase 4.1 WAL journal mode is actually applied on a filesystem
   DB. WAL allows concurrent reads alongside a single writer and is
   the standard SQLite-on-FastAPI pattern.

Both tests use `monkeypatch.setenv` + `reset_state_for_tests` so the
default `":memory:"` path is restored at teardown.
"""

from __future__ import annotations

import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_db, get_repository, reset_state_for_tests
from app.main import create_app


@pytest.fixture
def fs_db(monkeypatch, tmp_path):
    """Hand control of the singleton DB to a tmp filesystem path."""

    db_file = tmp_path / "driftguard.db"
    monkeypatch.setenv("SENTINEL_DB_PATH", str(db_file))
    reset_state_for_tests()
    yield db_file
    reset_state_for_tests()


def test_db_path_env_override_routes_writes_to_file(fs_db):
    client = TestClient(create_app())
    r = client.post("/simulations", json={"seed": 11})
    assert r.status_code == 201
    sid = r.json()["simulation_id"]
    client.post(f"/simulations/{sid}/step")

    # Singleton wrote to the env-supplied path...
    assert fs_db.exists(), f"expected DB file at {fs_db}"
    # ...and the row is queryable through a fresh connection.
    conn = sqlite3.connect(str(fs_db))
    try:
        rows = conn.execute("SELECT id FROM simulations WHERE id = ?", (sid,)).fetchall()
    finally:
        conn.close()
    assert len(rows) == 1


def test_wal_mode_enabled_on_filesystem_db(fs_db):
    # Force the singleton to materialise (WAL is set on first connect).
    repo = get_repository()
    assert repo is not None
    db = get_db()
    db.connect()  # ensures the schema + PRAGMA have been applied

    # Open a *separate* connection and read the journal mode. WAL is a
    # persistent file-level setting, so a second connection sees it too.
    conn = sqlite3.connect(str(fs_db))
    try:
        mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
    finally:
        conn.close()
    assert mode.lower() == "wal", f"expected WAL journal mode, got {mode!r}"


def test_in_memory_default_does_not_apply_wal(monkeypatch):
    """The :memory: path cannot run WAL — verify we don't try to."""

    monkeypatch.delenv("SENTINEL_DB_PATH", raising=False)
    reset_state_for_tests()
    db = get_db()
    conn = db.connect()
    mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
    # SQLite reports "memory" for :memory: DBs; "wal" would mean we
    # incorrectly forced the PRAGMA on a non-filesystem DB.
    assert mode.lower() != "wal"
    reset_state_for_tests()
