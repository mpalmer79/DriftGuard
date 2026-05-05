"""API contract tests for invalid input handling (Phase 10).

These tests pin the rejection path for each major endpoint so a regression
that loosens validation gets caught before it ships.
"""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.main import create_app


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


def test_create_simulation_rejects_non_integer_seed(client):
    r = client.post("/simulations", json={"seed": "not-a-number"})
    assert r.status_code == 422


def test_inject_fault_rejects_unknown_fault_type(client):
    sid = client.post("/simulations", json={"seed": 1}).json()["simulation_id"]
    r = client.post(
        f"/simulations/{sid}/faults",
        json={"type": "NOT_A_REAL_FAULT", "target": "sensor"},
    )
    assert r.status_code == 422


def test_inject_fault_rejects_missing_target(client):
    sid = client.post("/simulations", json={"seed": 1}).json()["simulation_id"]
    r = client.post(f"/simulations/{sid}/faults", json={"type": "SENSOR_DRIFT"})
    assert r.status_code == 422


def test_inject_fault_rejects_unknown_target(client):
    sid = client.post("/simulations", json={"seed": 1}).json()["simulation_id"]
    r = client.post(
        f"/simulations/{sid}/faults",
        json={"type": "SENSOR_DRIFT", "target": "the_engine_room"},
    )
    assert r.status_code == 400


def test_inject_fault_unknown_simulation_returns_404(client):
    r = client.post(
        "/simulations/no-such-sim/faults",
        json={"type": "SENSOR_DRIFT", "target": "sensor"},
    )
    assert r.status_code == 404


def test_get_state_unknown_simulation_returns_404(client):
    assert client.get("/simulations/no-such-sim/state").status_code == 404


def test_get_events_unknown_simulation_returns_404(client):
    assert client.get("/simulations/no-such-sim/events").status_code == 404


def test_run_unknown_scenario_is_rejected(client):
    r = client.post("/scenarios/totally-fake-scenario/run")
    assert r.status_code in (400, 404)


def test_run_scenario_with_negative_steps_rejected(client):
    r = client.post("/scenarios/nominal_cruise/run/-3")
    # FastAPI path validation rejects negative ints as 422 here, since the
    # signature constrains steps. Either is a valid contract failure.
    assert r.status_code in (400, 404, 422)


def test_get_scenario_detail_unknown_is_rejected(client):
    assert client.get("/scenarios/totally-fake-scenario").status_code in (400, 404)


def test_create_scenario_with_empty_body_returns_400(client):
    r = client.post("/scenarios", content=b"", headers={"Content-Type": "text/yaml"})
    assert r.status_code == 400


def test_create_scenario_with_bad_yaml_returns_422(client):
    r = client.post(
        "/scenarios",
        content=b"this: is: not: valid: yaml: [",
        headers={"Content-Type": "text/yaml"},
    )
    assert r.status_code == 422


def test_duplicate_simulation_id_returns_409(client):
    """Re-creating the same simulation_id is an explicit conflict."""

    body = {"seed": 1, "simulation_id": "explicit-id"}
    assert client.post("/simulations", json=body).status_code == 201
    assert client.post("/simulations", json=body).status_code == 409
