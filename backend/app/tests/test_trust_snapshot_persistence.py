"""TrustDetector per-step snapshot persistence and API exposure.

Pins:

* ``StepRecord.trust_snapshot`` is populated every step.
* The snapshot is deterministic for a fixed seed.
* The snapshot is excluded from the replay fingerprint.
* The ``trust_snapshots`` table round-trips it.
* ``/simulations/{id}/step`` returns it; ``/simulations/{id}/trust``
  returns one entry per persisted step.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.core.canonical import fingerprint
from app.domain.enums import FaultSeverity, FaultType
from app.main import create_app
from app.persistence.database import Database
from app.persistence.repository import SimulationRepository
from app.simulation.orchestrator import Simulation


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


def _new_sim(seed: int = 42, sim_id: str = "trust_snap") -> Simulation:
    return Simulation(simulation_id=sim_id, seed=seed)


# --- shape -----------------------------------------------------------------


def test_step_record_carries_trust_snapshot():
    sim = _new_sim()
    record = sim.step()
    snap = record.trust_snapshot
    assert snap, "step record must carry a non-empty trust snapshot"
    for cid in ("controller_a", "controller_b", "controller_c", "sensor"):
        assert cid in snap
        entry = snap[cid]
        assert {"status", "trust", "fault_streak", "clean_streak", "repeat_count"} <= entry.keys()
    assert "_global" in snap
    assert "disagreement_rate" in snap["_global"]


def test_trust_snapshot_evolves_with_faults():
    """Sustained invalid-controller fault drives HEALTHY → SUSPECT → DEGRADED."""

    sim = _new_sim()
    sim.inject_fault(
        fault_type=FaultType.CONTROLLER_INVALID_OUTPUT,
        target="controller_a",
        start_step=1,
        duration=20,
        severity=FaultSeverity.WARNING,
    )
    records = sim.run(8)
    statuses = [r.trust_snapshot["controller_a"]["status"] for r in records]
    assert "HEALTHY" not in statuses[-3:], (
        f"controller_a must have escalated under sustained fault: {statuses}"
    )
    # Trust must weakly decrease while the fault is uninterrupted.
    trusts = [r.trust_snapshot["controller_a"]["trust"] for r in records]
    assert trusts[0] >= trusts[-1]


# --- determinism -----------------------------------------------------------


def test_trust_snapshots_are_deterministic_under_replay():
    sim_a = _new_sim(seed=7, sim_id="trust_a")
    sim_b = _new_sim(seed=7, sim_id="trust_b")
    sim_a.inject_fault(
        fault_type=FaultType.CONTROLLER_INVALID_OUTPUT,
        target="controller_a",
        start_step=1,
        duration=12,
    )
    sim_b.inject_fault(
        fault_type=FaultType.CONTROLLER_INVALID_OUTPUT,
        target="controller_a",
        start_step=1,
        duration=12,
    )
    records_a = sim_a.run(10)
    records_b = sim_b.run(10)
    snaps_a = [r.trust_snapshot for r in records_a]
    snaps_b = [r.trust_snapshot for r in records_b]
    assert snaps_a == snaps_b


def test_trust_snapshot_does_not_change_replay_fingerprint():
    """The canonicaliser strips ``trust_snapshot``, so the fingerprint
    must be unchanged when the field is zeroed out.
    """

    sim = _new_sim(seed=11, sim_id="fp_a")
    sim.run(6)
    fp_with_snapshot = fingerprint(sim.step_history)

    cleared = []
    for r in sim.step_history:
        from copy import copy

        clone = copy(r)
        clone.trust_snapshot = {}
        cleared.append(clone)
    fp_cleared = fingerprint(cleared)
    assert fp_with_snapshot == fp_cleared


# --- persistence -----------------------------------------------------------


def test_trust_snapshots_round_trip_through_repository():
    db = Database(":memory:")
    repo = SimulationRepository(db)
    sim = _new_sim(seed=23, sim_id="persist_round_trip")
    sim.inject_fault(
        fault_type=FaultType.CONTROLLER_INVALID_OUTPUT,
        target="controller_b",
        start_step=1,
        duration=10,
    )
    repo.create_simulation(sim)
    records = sim.run(5)
    for r in records:
        repo.save_step(sim.id, r)

    rows = repo.get_trust_snapshots(sim.id)
    assert len(rows) == len(records)
    for record, row in zip(records, rows, strict=True):
        assert row["step"] == record.state.step
        assert row["snapshot"] == record.trust_snapshot


def test_get_trust_snapshots_empty_when_nothing_persisted():
    db = Database(":memory:")
    repo = SimulationRepository(db)
    sim = _new_sim(sim_id="empty_persist")
    repo.create_simulation(sim)
    assert repo.get_trust_snapshots(sim.id) == []


# --- API -------------------------------------------------------------------


def test_step_endpoint_exposes_trust_snapshot(client):
    create = client.post("/simulations", json={"seed": 42}).json()
    sid = create["simulation_id"]
    resp = client.post(f"/simulations/{sid}/step")
    assert resp.status_code == 200
    body = resp.json()
    assert "trust_snapshot" in body
    snap = body["trust_snapshot"]
    assert "controller_a" in snap
    assert "_global" in snap
    assert {"status", "trust", "fault_streak"} <= set(snap["controller_a"].keys())


def test_trust_history_endpoint_returns_one_entry_per_step(client):
    r = client.post("/scenarios/sensor_drift_recovery/run/8").json()
    sid = r["simulation_id"]
    rows = client.get(f"/simulations/{sid}/trust").json()
    assert isinstance(rows, list)
    assert len(rows) == 8
    for entry in rows:
        assert {"step", "snapshot"} <= set(entry.keys())
        assert "_global" in entry["snapshot"]
        assert "controller_a" in entry["snapshot"]


def test_trust_history_endpoint_404_for_unknown(client):
    assert client.get("/simulations/unknown_id/trust").status_code == 404


def test_trust_history_is_replay_stable(client):
    """Two runs of the same scenario yield identical trust trajectories."""

    a = client.post("/scenarios/multi_fault_failure/run/10").json()
    b = client.post("/scenarios/multi_fault_failure/run/10").json()
    rows_a = client.get(f"/simulations/{a['simulation_id']}/trust").json()
    rows_b = client.get(f"/simulations/{b['simulation_id']}/trust").json()
    assert [(r["step"], r["snapshot"]) for r in rows_a] == [
        (r["step"], r["snapshot"]) for r in rows_b
    ]
