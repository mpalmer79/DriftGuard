"""Replay-fingerprint endpoint tests (Phase 1.4)."""

import re

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.main import create_app


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


_HEX_64 = re.compile(r"^[0-9a-f]{64}$")


def test_fingerprint_404_for_unknown(client):
    assert client.get("/simulations/nope/replay-fingerprint").status_code == 404


def test_fingerprint_shape(client):
    r = client.post("/scenarios/nominal_cruise/run/5").json()
    sid = r["simulation_id"]

    body = client.get(f"/simulations/{sid}/replay-fingerprint").json()
    assert body["simulation_id"] == sid
    assert body["step_count"] == 5
    assert body["algorithm"] == "sha256"
    assert _HEX_64.match(body["fingerprint"])


def test_fingerprint_is_stable_across_two_runs_of_same_scenario(client):
    """The fingerprint canonicalizes away simulation_id, so two
    independent runs of the same scenario seed produce the same hash."""

    a = client.post("/scenarios/nominal_cruise/run/8").json()
    b = client.post("/scenarios/nominal_cruise/run/8").json()
    assert a["simulation_id"] != b["simulation_id"]

    fa = client.get(f"/simulations/{a['simulation_id']}/replay-fingerprint").json()
    fb = client.get(f"/simulations/{b['simulation_id']}/replay-fingerprint").json()
    assert fa["fingerprint"] == fb["fingerprint"]


def test_fingerprint_differs_for_different_scenarios(client):
    a = client.post("/scenarios/nominal_cruise/run/8").json()
    b = client.post("/scenarios/multi_fault_failure/run/8").json()

    fa = client.get(f"/simulations/{a['simulation_id']}/replay-fingerprint").json()
    fb = client.get(f"/simulations/{b['simulation_id']}/replay-fingerprint").json()
    assert fa["fingerprint"] != fb["fingerprint"]
