"""GET /simulations/{id}/trajectory endpoint tests (Phase 2.7)."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.main import create_app


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


def test_trajectory_endpoint_404_for_unknown(client):
    assert client.get("/simulations/nope/trajectory").status_code == 404


def test_trajectory_endpoint_returns_persisted_points(client):
    r = client.post("/scenarios/nominal_cruise/run/4").json()
    sid = r["simulation_id"]
    body = client.get(f"/simulations/{sid}/trajectory").json()
    assert isinstance(body, list)
    assert len(body) >= 4
    sample = body[0]
    for key in ("step", "timestamp", "position_x", "position_y", "altitude", "system_mode"):
        assert key in sample


def test_trajectory_steps_strictly_increase(client):
    r = client.post("/scenarios/multi_fault_failure/run/6").json()
    sid = r["simulation_id"]
    body = client.get(f"/simulations/{sid}/trajectory").json()
    steps = [p["step"] for p in body]
    assert steps == sorted(steps)
    assert len(set(steps)) == len(steps)
