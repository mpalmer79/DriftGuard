"""Causality fields on SystemDecision (Agent C, Phase 2 hardening).

Pins the operator-console contract: each decision row carries the
previous mode, the trigger reason, the IDs of faults active during
that step, the live detector findings, and a flat vote summary —
all derived from real domain state, not invented.
"""

from __future__ import annotations

from app.domain.enums import (
    FaultSeverity,
    FaultType,
    HealthStatus,
    SystemMode,
    VoteOutcome,
)
from app.persistence.database import Database
from app.persistence.repository import SimulationRepository
from app.simulation.orchestrator import Simulation


def _new_sim(seed: int = 42, sim_id: str = "causality_test") -> Simulation:
    return Simulation(simulation_id=sim_id, seed=seed)


def test_previous_mode_is_NORMAL_at_step_one():
    sim = _new_sim()
    record = sim.step()
    # Step 1: there has been no prior published mode, so the
    # SafeModeManager's NORMAL default is the previous mode.
    assert record.decision.previous_mode == SystemMode.NORMAL


def test_previous_mode_chains_across_steps():
    """`previous_mode` at step N+1 == `system_mode` at step N. This is
    the property the dashboard's mode-transition arrow relies on.
    """

    sim = _new_sim()
    records = sim.run(6)
    for prev, curr in zip(records, records[1:], strict=False):
        assert curr.decision.previous_mode == prev.decision.system_mode


def test_active_fault_ids_match_registry():
    sim = _new_sim()
    fault = sim.inject_fault(
        fault_type=FaultType.SENSOR_DRIFT,
        target="sensor",
        start_step=1,
        duration=4,
        severity=FaultSeverity.WARNING,
        metadata={"magnitude": 4.0},
    )
    records = sim.run(6)
    # Steps 1..4 should report the fault in active_fault_ids; step 5+
    # should not, since duration=4 means end_step=5 (active up to but
    # not including step 5).
    for i, record in enumerate(records, start=1):
        ids = record.decision.active_fault_ids
        if i <= 4:
            assert fault.fault_id in ids, f"step {i}: missing fault id"
        else:
            assert fault.fault_id not in ids, f"step {i}: fault should be cleared"


def test_trigger_reason_mirrors_justification():
    sim = _new_sim()
    sim.inject_fault(
        fault_type=FaultType.CONTROLLER_INVALID_OUTPUT,
        target="controller_a",
        start_step=1,
        duration=10,
    )
    records = sim.run(8)
    for r in records:
        assert r.decision.trigger_reason == r.decision.justification


def test_vote_split_summarizes_vote_result():
    sim = _new_sim()
    record = sim.step()
    vs = record.decision.vote_split
    # The flat alias must agree with the underlying VoteResult; the
    # operator console reads `vote_split` directly without having to
    # cross-reference the per-step vote payload.
    assert vs["outcome"] == record.vote.outcome.value
    if record.vote.selected_action is not None:
        assert vs["selected_action"] == record.vote.selected_action.value
    else:
        assert vs["selected_action"] is None
    assert vs["agreeing"] == record.vote.agreeing_controllers
    assert vs["rejected"] == record.vote.rejected_controllers
    assert vs["reason"] == record.vote.reason


def test_detector_findings_populated_on_health_change():
    """A persistent invalid-controller fault must drive at least one
    TrustDetector finding (HEALTHY -> SUSPECT). That finding has to
    surface on the decision row, not just in the event log.
    """

    sim = _new_sim()
    sim.inject_fault(
        fault_type=FaultType.CONTROLLER_INVALID_OUTPUT,
        target="controller_a",
        start_step=1,
        duration=15,
    )
    records = sim.run(8)
    # At least one decision in the run must have surfaced a finding.
    all_findings: list[dict] = []
    for r in records:
        all_findings.extend(r.decision.detector_findings)
    assert all_findings, "expected at least one detector finding on decision rows"
    # And the finding shape is the compact {component, severity, message}
    # the UI binds to.
    sample = all_findings[0]
    assert {"component", "severity", "message"} <= sample.keys()
    assert sample["severity"] in {s.value for s in HealthStatus}


def test_split_vote_yields_split_outcome_in_vote_split():
    """When two controllers are forced into disagreeing actions, the
    vote outcome must be SPLIT and `vote_split` must report it.
    """

    sim = _new_sim(sim_id="split_test")
    sim.inject_fault(
        fault_type=FaultType.CONTROLLER_ACTION_BIAS,
        target="controller_b",
        start_step=1,
        duration=10,
        metadata={"forced_action": "ABORT"},
    )
    sim.inject_fault(
        fault_type=FaultType.CONTROLLER_ACTION_BIAS,
        target="controller_c",
        start_step=1,
        duration=10,
        metadata={"forced_action": "TURN_RIGHT"},
    )
    records = sim.run(4)
    split_outcomes = [
        r.decision.vote_split["outcome"]
        for r in records
        if r.decision.vote_split["outcome"] != VoteOutcome.CONSENSUS.value
    ]
    assert split_outcomes, "expected at least one non-consensus outcome"


def test_causality_round_trips_through_persistence():
    """The decision row that comes back out of the repository must
    carry the same causality fields the domain object was built with.
    """

    db = Database(":memory:")
    repo = SimulationRepository(db)
    sim = _new_sim(sim_id="round_trip")
    sim.inject_fault(
        fault_type=FaultType.SENSOR_DRIFT,
        target="sensor",
        start_step=1,
        duration=3,
        metadata={"magnitude": 3.0},
    )
    repo.create_simulation(sim)
    records = sim.run(4)
    for r in records:
        repo.save_step(sim.id, r)

    rows = repo.get_decisions(sim.id)
    assert len(rows) == 4
    for record, row in zip(records, rows, strict=True):
        assert row["previous_mode"] == record.decision.previous_mode.value
        assert row["trigger_reason"] == record.decision.trigger_reason
        assert row["active_fault_ids"] == record.decision.active_fault_ids
        assert row["detector_findings"] == record.decision.detector_findings
        assert row["vote_split"] == record.decision.vote_split


def test_legacy_decision_row_without_payload_back_fills_defaults():
    """Rows persisted before the migration ran have NULL in the
    causality_payload column. `decision_row` must back-fill safe
    defaults so existing clients keep working.
    """

    db = Database(":memory:")
    conn = db.connect()
    conn.execute(
        """INSERT INTO system_decisions
        (simulation_id, step, final_action, system_mode, safe_mode_active,
         justification, trusted, rejected, causality_payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)""",
        ("legacy", 1, "HOLD", "NORMAL", 0, "all good", "[]", "[]"),
    )
    conn.commit()
    rows = conn.execute("SELECT * FROM system_decisions WHERE simulation_id='legacy'").fetchall()
    from app.persistence.repository_serialization import decision_row

    d = decision_row(rows[0])
    assert d["previous_mode"] == "NORMAL"
    # `trigger_reason` must mirror `justification` for legacy rows.
    assert d["trigger_reason"] == "all good"
    assert d["active_fault_ids"] == []
    assert d["detector_findings"] == []
    assert d["vote_split"] == {}


def test_step_response_exposes_causality_fields():
    """The /simulations/{id}/step endpoint must serialize the new
    causality fields so the live frontend can consume them.
    """

    import pytest
    from fastapi.testclient import TestClient

    from app.api.dependencies import reset_state_for_tests
    from app.main import create_app

    _ = pytest  # silence unused-import warning on the local pytest

    reset_state_for_tests()
    client = TestClient(create_app())
    create = client.post("/simulations", json={"seed": 42}).json()
    sid = create["simulation_id"]
    resp = client.post(f"/simulations/{sid}/step")
    assert resp.status_code == 200
    decision = resp.json()["decision"]
    assert "previous_mode" in decision
    assert "trigger_reason" in decision
    assert "active_fault_ids" in decision
    assert "detector_findings" in decision
    assert "vote_split" in decision
    assert decision["previous_mode"] == "NORMAL"
    # Original field names still present (no breaking change).
    assert "justification" in decision
    assert "system_mode" in decision
    assert "final_action" in decision


def test_decisions_endpoint_exposes_causality_fields():
    """The persisted GET /simulations/{id}/decisions response must
    carry the new fields so the read path matches the live path.
    """

    from fastapi.testclient import TestClient

    from app.api.dependencies import reset_state_for_tests
    from app.main import create_app

    reset_state_for_tests()
    client = TestClient(create_app())
    r = client.post("/scenarios/sensor_drift_recovery/run/8").json()
    sid = r["simulation_id"]
    rows = client.get(f"/simulations/{sid}/decisions").json()
    assert rows
    sample = rows[0]
    assert {
        "previous_mode",
        "trigger_reason",
        "active_fault_ids",
        "detector_findings",
        "vote_split",
    } <= set(sample.keys())
