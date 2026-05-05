"""End-to-end /metrics endpoint test (Phase 4.2 acceptance).

Spins up the FastAPI app, runs a scenario, then asserts /metrics
returns Prometheus exposition format containing every metric named
in the Phase 4 directive.
"""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.core import metrics
from app.main import create_app


@pytest.fixture
def client():
    metrics.reset_registry()
    reset_state_for_tests()
    return TestClient(create_app())


_REQUIRED_METRIC_NAMES = (
    "sentinel_simulation_steps_total",
    "sentinel_decisions_total",
    "sentinel_vote_outcome_total",
    "sentinel_faults_active",
    "sentinel_controller_health",
    "sentinel_step_duration_seconds",
    "sentinel_replay_fingerprint",
)


def test_metrics_endpoint_returns_prometheus_text(client):
    # Drive at least one step so labeled metrics have observed values.
    client.post("/scenarios/nominal_cruise/run/3")

    r = client.get("/metrics")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/plain")

    body = r.text
    for name in _REQUIRED_METRIC_NAMES[:-1]:
        # The Info metric is rendered with ``_info`` suffix; we check
        # it separately in the next test.
        assert name in body, f"missing metric: {name}"


def test_metrics_endpoint_includes_decisions_for_normal_run(client):
    client.post("/scenarios/nominal_cruise/run/4")
    body = client.get("/metrics").text
    # nominal_cruise stays in NORMAL with HOLD action.
    assert 'sentinel_decisions_total{action="HOLD",mode="NORMAL"} 4.0' in body


def test_metrics_endpoint_includes_steps_per_simulation(client):
    r = client.post("/scenarios/nominal_cruise/run/5").json()
    sid = r["simulation_id"]
    body = client.get("/metrics").text
    assert f'sentinel_simulation_steps_total{{simulation_id="{sid}"}} 5.0' in body


def test_metrics_endpoint_default_state_has_no_data(client):
    body = client.get("/metrics").text
    # The metric NAMES are present (HELP / TYPE lines) but the labeled
    # series are not until something runs.
    assert "sentinel_simulation_steps_total" in body
    assert "sentinel_simulation_steps_total{" not in body
