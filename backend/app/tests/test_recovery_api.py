import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.main import create_app


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


def test_list_simulations_empty(client):
    r = client.get("/simulations")
    assert r.status_code == 200
    assert r.json() == []


def test_create_then_recover_via_get(client):
    r = client.post("/simulations", json={"seed": 7})
    sid = r.json()["simulation_id"]
    client.post(f"/simulations/{sid}/step")
    client.post(f"/simulations/{sid}/step")

    summary = client.get(f"/simulations/{sid}").json()
    assert summary["simulation"]["seed"] == 7
    assert summary["step_count"] == 2
    assert summary["latest_state"]["step"] == 2

    timeline = client.get(f"/simulations/{sid}/timeline").json()
    assert len(timeline) == 2
    assert timeline[-1]["decision"]["system_mode"] == "NORMAL"


def test_recovery_endpoints_404_for_unknown(client):
    assert client.get("/simulations/nope").status_code == 404
    assert client.get("/simulations/nope/timeline").status_code == 404
    assert client.get("/simulations/nope/decisions").status_code == 404
    assert client.get("/simulations/nope/faults").status_code == 404


def test_scenarios_endpoint_lists_six(client):
    r = client.get("/scenarios").json()
    names = {s["name"] for s in r}
    assert {
        "nominal_cruise",
        "single_controller_latency",
        "sensor_drift_recovery",
        "split_vote_escalation",
        "multi_fault_failure",
        "intermittent_fault",
    }.issubset(names)


def test_scenario_run_persists_simulation(client):
    r = client.post("/scenarios/nominal_cruise/run/3").json()
    sid = r["simulation_id"]
    assert r["steps_run"] == 3

    listing = {s["id"] for s in client.get("/simulations").json()}
    assert sid in listing

    timeline = client.get(f"/simulations/{sid}/timeline").json()
    assert len(timeline) == 3


def test_scenario_run_invalid_steps_rejected(client):
    assert client.post("/scenarios/nominal_cruise/run/0").status_code == 400
    assert client.post("/scenarios/nominal_cruise/run/9999").status_code == 400
