"""Run-endpoint override block tests (Phase 5.4)."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.main import create_app
from app.scenarios.registry import run_scenario


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


def test_seed_override_changes_initial_rng_seed():
    sim_default, _ = run_scenario("nominal_cruise", 3)
    sim_overridden, _ = run_scenario("nominal_cruise", 3, seed_override=999)
    assert sim_default.seed != sim_overridden.seed
    assert sim_overridden.seed == 999


def test_fault_metadata_override_merges_over_declared():
    sim, _ = run_scenario(
        "sensor_drift_recovery",
        3,
        fault_metadata_overrides={0: {"magnitude": 99.0}},
    )
    drift = next(f for f in sim.faults.all() if f.type.value == "SENSOR_DRIFT")
    assert drift.metadata["magnitude"] == 99.0


def test_out_of_range_fault_index_raises():
    from app.core.exceptions import ScenarioError

    with pytest.raises(ScenarioError):
        run_scenario("nominal_cruise", 3, fault_metadata_overrides={0: {"magnitude": 1.0}})


def test_run_endpoint_accepts_override_body(client):
    r = client.post(
        "/scenarios/nominal_cruise/run/3",
        json={"seed": 1234, "fault_metadata": {}},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["scenario"] == "nominal_cruise"


def test_run_endpoint_overrides_fault_metadata(client):
    r = client.post(
        "/scenarios/sensor_drift_recovery/run/4",
        json={"fault_metadata": {"0": {"magnitude": 50.0}}},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    drift = next(f for f in body["fault_summary"] if f["type"] == "SENSOR_DRIFT")
    assert drift["metadata"]["magnitude"] == 50.0


def test_run_endpoint_invalid_seed_returns_422(client):
    r = client.post(
        "/scenarios/nominal_cruise/run/3",
        json={"seed": -1},
    )
    assert r.status_code == 422


def test_run_endpoint_unknown_fault_index_returns_400(client):
    r = client.post(
        "/scenarios/nominal_cruise/run/3",
        json={"fault_metadata": {"0": {"magnitude": 1.0}}},
    )
    assert r.status_code == 400


def test_run_endpoint_no_body_still_works(client):
    """Override block is optional; the endpoint must keep working
    when callers don't supply one."""

    r = client.post("/scenarios/nominal_cruise/run/3")
    assert r.status_code == 200
