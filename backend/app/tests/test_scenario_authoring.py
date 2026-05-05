"""POST/DELETE /scenarios endpoint tests (Phase 5.3)."""

import contextlib

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.main import create_app
from app.scenarios.registry import _SCENARIOS, unregister_user_scenario  # noqa: F401


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


@pytest.fixture(autouse=True)
def _cleanup_user_scenarios():
    """Drop any user scenarios between tests so the registry stays
    aligned with the built-in baseline."""

    yield
    for name in list(_SCENARIOS.keys()):
        with contextlib.suppress(Exception):
            unregister_user_scenario(name)


_VALID_YAML = """
name: my_user_scenario
description: A test scenario.
expected_behavior: Stays in NORMAL.
seed: 99
steps: 5
faults:
  - type: SENSOR_DRIFT
    target: sensor
    start_step: 1
    duration: 3
    metadata: { magnitude: 1.5 }
"""


def test_create_scenario_returns_201_and_appears_in_list(client):
    r = client.post("/scenarios", content=_VALID_YAML)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "my_user_scenario"
    assert body["builtin"] is False

    listing = client.get("/scenarios").json()
    names = {s["name"] for s in listing}
    assert "my_user_scenario" in names


def test_create_scenario_with_invalid_yaml_returns_422(client):
    r = client.post("/scenarios", content="this is: : : not valid: yaml: [")
    assert r.status_code == 422


def test_create_scenario_with_schema_violation_returns_422(client):
    bad = """
name: bad
description: ""
expected_behavior: ""
seed: -1
steps: 99999
"""
    r = client.post("/scenarios", content=bad)
    assert r.status_code == 422


def test_create_scenario_rejects_built_in_name(client):
    bad = """
name: nominal_cruise
description: ""
expected_behavior: ""
seed: 1
steps: 5
"""
    r = client.post("/scenarios", content=bad)
    # ScenarioError is mapped via the global error handler to 400.
    assert r.status_code in (400, 409)


def test_delete_user_scenario(client):
    client.post("/scenarios", content=_VALID_YAML)
    r = client.delete("/scenarios/my_user_scenario")
    assert r.status_code == 204
    listing = client.get("/scenarios").json()
    assert "my_user_scenario" not in {s["name"] for s in listing}


def test_delete_built_in_rejected(client):
    r = client.delete("/scenarios/nominal_cruise")
    assert r.status_code == 400


def test_delete_unknown_scenario(client):
    r = client.delete("/scenarios/does_not_exist")
    assert r.status_code == 400


def test_get_scenario_detail_marks_builtin(client):
    body = client.get("/scenarios/nominal_cruise").json()
    assert body["builtin"] is True


def test_user_scenario_is_runnable(client):
    client.post("/scenarios", content=_VALID_YAML)
    r = client.post("/scenarios/my_user_scenario/run/3")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["scenario"] == "my_user_scenario"
    assert body["steps_run"] == 3


def test_empty_body_rejected(client):
    r = client.post("/scenarios", content="")
    assert r.status_code == 400
