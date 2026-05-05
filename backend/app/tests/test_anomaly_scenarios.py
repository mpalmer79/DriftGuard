"""End-to-end anomaly sidecar tests (Phase 6.4).

Three load-bearing claims to pin:

1. The score appears in the timeline and the report.
2. The score stays at INFO under nominal conditions and crosses
   WARNING/CRITICAL once a clear fault is injected.
3. Same seed → bit-identical scores (RngService child determinism
   carries through to the ML signal).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.main import create_app
from app.scenarios import run_scenario
from app.simulation.orchestrator import Simulation


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


def _anomaly_scores(sim) -> list[float]:
    return [s.score for s in sim.anomaly.scores]


def test_nominal_run_keeps_anomaly_at_info():
    """Acceptance criterion: the score stays below WARNING under no
    faults."""

    sim, _ = run_scenario("nominal_cruise", 25)
    sevs = {s.severity.value for s in sim.anomaly.scores}
    assert sevs <= {"INFO"}, f"unexpected severities: {sevs}"


def test_post_warmup_fault_crosses_threshold():
    """Acceptance criterion: when the fault appears AFTER the warm-up
    window, the score crosses WARNING.

    multi_fault_failure starts faults at step 3 (inside the default
    warm-up of 10), so the forest sees faulty rows during fit and
    treats them as normal. We construct a Simulation with a fault
    starting at step 12 instead — the directive's "first N nominal
    steps" framing assumes warm-up data is nominal."""

    from app.domain.enums import FaultType

    sim = Simulation("post_warmup", seed=3)
    sim.inject_fault(
        FaultType.CONTROLLER_INVALID_OUTPUT,
        "controller_a",
        start_step=12,
        duration=20,
    )
    sim.inject_fault(
        FaultType.CONTROLLER_SILENT_FAILURE,
        "controller_b",
        start_step=12,
        duration=20,
    )
    sim.run(25)

    elevated = [s for s in sim.anomaly.scores if s.severity.value != "INFO"]
    assert elevated, (
        "expected at least one WARNING/CRITICAL score "
        "after the warm-up window when faults are injected"
    )


def test_two_runs_with_same_seed_produce_identical_scores():
    a = Simulation("a", seed=42)
    b = Simulation("b", seed=42)
    a.run(20)
    b.run(20)
    assert _anomaly_scores(a) == _anomaly_scores(b)


def test_anomaly_events_land_in_timeline_endpoint(client):
    r = client.post("/scenarios/multi_fault_failure/run/25").json()
    sid = r["simulation_id"]
    timeline = client.get(f"/simulations/{sid}/timeline").json()
    components = {e["component"] for entry in timeline for e in entry["events"]}
    # Some scenarios may stay below WARNING — but the anomaly sidecar
    # logs INFO too. Check that 'anomaly' appears as a component.
    assert "anomaly" in components


def test_report_includes_anomaly_vs_deterministic_block(client):
    r = client.post("/scenarios/multi_fault_failure/run/25").json()
    sid = r["simulation_id"]
    report = client.get(f"/simulations/{sid}/report").json()
    block = report["anomaly_vs_deterministic"]
    for key in (
        "anomaly_alert_steps",
        "deterministic_alert_steps",
        "agreement_steps",
        "agreement_rate",
        "average_anomaly_score",
    ):
        assert key in block

    md = client.get(f"/simulations/{sid}/report/markdown").text
    assert "Anomaly detector vs deterministic" in md
    assert "advisory only (ADR 0009)" in md
