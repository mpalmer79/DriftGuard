"""Liveness and readiness endpoint tests (Phase 4.4)."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.main import create_app


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


def test_health_returns_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_ready_returns_ready_in_default_environment(client):
    r = client.get("/ready")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    assert body["checks"]["database"] == "ok"
    assert body["checks"]["scenarios"].startswith("ok ")


def test_ready_includes_scenario_count(client):
    body = client.get("/ready").json()
    # The six built-in scenarios are registered at import time.
    assert "6 registered" in body["checks"]["scenarios"]
