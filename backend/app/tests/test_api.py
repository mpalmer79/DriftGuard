import pytest
from fastapi.testclient import TestClient

from app.api.routes import reset_state_for_tests
from app.main import create_app


@pytest.fixture
def client():
    reset_state_for_tests()
    app = create_app()
    return TestClient(app)


def test_create_and_step_simulation(client):
    r = client.post("/simulations", json={"seed": 42})
    assert r.status_code == 201
    sim_id = r.json()["simulation_id"]

    r = client.post(f"/simulations/{sim_id}/step")
    assert r.status_code == 200
    body = r.json()
    assert body["step"] == 1
    assert "final_action" in body["decision"]


def test_get_state_and_events(client):
    r = client.post("/simulations", json={"seed": 1})
    sim_id = r.json()["simulation_id"]
    client.post(f"/simulations/{sim_id}/step")

    s = client.get(f"/simulations/{sim_id}/state")
    assert s.status_code == 200
    assert s.json()["step"] == 1

    e = client.get(f"/simulations/{sim_id}/events")
    assert e.status_code == 200
    assert len(e.json()) > 0


def test_inject_fault(client):
    r = client.post("/simulations", json={"seed": 9})
    sim_id = r.json()["simulation_id"]
    f = client.post(
        f"/simulations/{sim_id}/faults",
        json={
            "type": "DATA_LOSS",
            "target": "sensor",
            "duration": 3,
        },
    )
    assert f.status_code == 201
    body = f.json()
    assert body["target"] == "sensor"
    assert body["type"] == "DATA_LOSS"


def test_invalid_target_rejected(client):
    r = client.post("/simulations", json={"seed": 1})
    sim_id = r.json()["simulation_id"]
    f = client.post(
        f"/simulations/{sim_id}/faults",
        json={"type": "DATA_LOSS", "target": "controller_x"},
    )
    assert f.status_code == 400


def test_step_unknown_simulation(client):
    r = client.post("/simulations/does-not-exist/step")
    assert r.status_code == 404
