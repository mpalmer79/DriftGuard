"""Causality fields must be deterministic and replayable.

Two runs of the same scenario at the same seed must produce
byte-identical causality payloads on every decision row. This test
exists because the dashboard's "decision evidence" surface is part
of the replay-fingerprint claim — if it drifted across runs, the
operator-facing causality story would not be defensible.
"""

from __future__ import annotations

from app.simulation.orchestrator import Simulation


def _causality_blob(record):
    """Per-decision tuple of the fields the operator UI binds to.

    We deliberately drop ``active_fault_ids`` here: those are UUID-shaped
    per-run identifiers (see ADR 0004 / ``app/core/canonical.py``) and
    are scrubbed in the canonical fingerprint. The *count* of active
    faults is meaningful, but the *identity* is not, so we substitute
    a count to keep the property well-defined under replay.
    """

    d = record.decision
    return (
        d.step,
        d.system_mode.value,
        d.previous_mode.value,
        d.trigger_reason,
        len(d.active_fault_ids),
        tuple(
            (f.get("component"), f.get("severity"), f.get("message")) for f in d.detector_findings
        ),
        tuple(sorted(d.vote_split.items(), key=lambda kv: kv[0])),
    )


def test_causality_is_byte_stable_under_replay():
    sim_a = Simulation("replay_a", seed=23)
    sim_b = Simulation("replay_b", seed=23)
    records_a = sim_a.run(15)
    records_b = sim_b.run(15)
    blobs_a = [_causality_blob(r) for r in records_a]
    blobs_b = [_causality_blob(r) for r in records_b]
    assert blobs_a == blobs_b


def test_replayed_scenario_produces_identical_causality():
    """Run the same scenario twice end-to-end (registry path) and
    confirm the persisted causality is identical, not just the
    per-step blob equality of two ad-hoc Simulations.
    """

    from app.scenarios.registry import run_scenario

    sim_a, _ = run_scenario("sensor_drift_recovery", steps_override=10)
    sim_b, _ = run_scenario("sensor_drift_recovery", steps_override=10)
    blobs_a = [_causality_blob(r) for r in sim_a.step_history]
    blobs_b = [_causality_blob(r) for r in sim_b.step_history]
    assert blobs_a == blobs_b
