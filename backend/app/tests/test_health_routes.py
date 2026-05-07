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
    # The ten built-in scenarios are registered at import time.
    assert "10 registered" in body["checks"]["scenarios"]


# --- Phase 7.1: liveness/readiness split ---


def test_healthz_returns_ok(client):
    """`/healthz` is the Kubernetes-style liveness probe — always
    200 if the process is up. Distinct from `/health` only by name;
    both stay reachable so existing dashboards don't break."""

    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_readyz_returns_200_when_ready(client):
    """`/readyz` is the Kubernetes-style readiness probe.

    In the default environment SQLite is reachable and the scenario
    registry is populated, so it returns 200 with a `ready` status.
    """

    r = client.get("/readyz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    assert body["checks"]["database"] == "ok"


def test_readyz_returns_503_when_dependency_unavailable(client, monkeypatch):
    """The whole point of `/readyz` over `/ready`: a real 503 when
    the application is not ready to serve traffic. We simulate it
    by making the scenario registry empty.
    """

    def _empty_scenarios():
        return []

    monkeypatch.setattr("app.api.health_routes.all_scenarios", _empty_scenarios)
    r = client.get("/readyz")
    assert r.status_code == 503
    body = r.json()
    assert body["status"] == "not_ready"
    assert body["checks"]["scenarios"].startswith("error: no scenarios")


def test_ready_alias_stays_200_even_when_unready(client, monkeypatch):
    """Operator-facing alias: `/ready` keeps returning 200 with the
    status field, so dashboards that key on the body keep working
    even when the readiness check fails."""

    def _empty_scenarios():
        return []

    monkeypatch.setattr("app.api.health_routes.all_scenarios", _empty_scenarios)
    r = client.get("/ready")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "not_ready"
