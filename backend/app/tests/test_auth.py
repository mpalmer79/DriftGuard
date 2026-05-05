"""Bearer token guard tests (Phase 8.3)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.main import create_app


@pytest.fixture
def open_client(monkeypatch):
    monkeypatch.delenv("SENTINEL_API_TOKEN", raising=False)
    reset_state_for_tests()
    return TestClient(create_app())


@pytest.fixture
def guarded_client(monkeypatch):
    monkeypatch.setenv("SENTINEL_API_TOKEN", "secret-123")
    reset_state_for_tests()
    return TestClient(create_app())


def test_writes_open_when_token_unset(open_client):
    r = open_client.post("/simulations", json={"seed": 1})
    assert r.status_code == 201


def test_reads_unaffected_when_token_set(guarded_client):
    r = guarded_client.get("/health")
    assert r.status_code == 200
    r = guarded_client.get("/scenarios")
    assert r.status_code == 200


def test_writes_blocked_without_header(guarded_client):
    r = guarded_client.post("/simulations", json={"seed": 1})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_writes_blocked_with_wrong_token(guarded_client):
    r = guarded_client.post(
        "/simulations",
        json={"seed": 1},
        headers={"authorization": "Bearer wrong-token"},
    )
    assert r.status_code == 401


def test_writes_blocked_with_malformed_header(guarded_client):
    r = guarded_client.post(
        "/simulations",
        json={"seed": 1},
        headers={"authorization": "Token secret-123"},
    )
    assert r.status_code == 401


def test_writes_allowed_with_correct_token(guarded_client):
    r = guarded_client.post(
        "/simulations",
        json={"seed": 1},
        headers={"authorization": "Bearer secret-123"},
    )
    assert r.status_code == 201


def test_scenario_run_blocked_without_token(guarded_client):
    r = guarded_client.post("/scenarios/nominal_cruise/run/3")
    assert r.status_code == 401


def test_delete_scenario_blocked_without_token(guarded_client):
    r = guarded_client.delete("/scenarios/nominal_cruise")
    # 401 first because the auth dep runs before the immutability check.
    assert r.status_code == 401


def test_token_compare_uses_constant_time(monkeypatch):
    """Phase 5.1 — guard against ``==``-based timing leak.

    A real timing test is flaky; a structural test that the auth path
    actually uses ``hmac.compare_digest`` is enough to keep a future
    refactor honest.
    """

    import inspect

    from app.api import auth

    src = inspect.getsource(auth)
    assert "hmac.compare_digest" in src
    # And `supplied != expected` should not be the comparison anymore.
    assert "supplied != expected" not in src
