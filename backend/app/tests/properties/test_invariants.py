"""Property-based tests for the safety invariants in docs/INVARIANTS.md.

Each ``test_iN_*`` matches one numbered invariant. When a property
fails, hypothesis prints the minimal scenario / step-count that
violated it, which doubles as a regression seed.

Some invariants are run-time properties of the orchestrator's
emitted record stream (I1, I2, I6, I7, I9). Some are
detector-internals properties best tested as unit tests; for those
this file contains a pointer comment to the dedicated test, rather
than a property-test that would have to re-instrument the simulation.
"""

from __future__ import annotations

from hypothesis import HealthCheck, given, settings

from app.domain.enums import (
    Action,
    EventType,
    SensorStatus,
    SystemMode,
    VoteOutcome,
)
from app.simulation.safe_mode import SAFE_ALLOWED_ACTIONS

from .strategies import scenario_runs

_FORBIDDEN_IN_SAFE_MODE = {Action.TURN_LEFT, Action.TURN_RIGHT, Action.ASCEND, Action.ACCELERATE}

_PROPERTY = settings(
    max_examples=30,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture],
)


@_PROPERTY
@given(run=scenario_runs())
def test_i1_failed_only_uses_safe_actions(run):
    sim, _ = run
    for record in sim.step_history:
        if record.decision.system_mode == SystemMode.FAILED:
            assert record.decision.final_action in SAFE_ALLOWED_ACTIONS, (
                f"I1 violated at step {record.decision.step}: "
                f"FAILED issued {record.decision.final_action}"
            )


@_PROPERTY
@given(run=scenario_runs())
def test_i2_safe_mode_never_uses_aggressive_actions(run):
    sim, _ = run
    for record in sim.step_history:
        if record.decision.system_mode == SystemMode.SAFE_MODE:
            assert record.decision.final_action not in _FORBIDDEN_IN_SAFE_MODE, (
                f"I2 violated at step {record.decision.step}: "
                f"SAFE_MODE issued {record.decision.final_action}"
            )


@_PROPERTY
@given(run=scenario_runs())
def test_i3_normal_to_failed_carries_a_justification(run):
    """When a step jumps NORMAL -> FAILED, the orchestrator must have
    logged a MODE_CHANGE event whose justification names the
    multi-cause precondition. We trust the safe-mode manager's
    evaluate() to enforce the precondition (covered by unit tests in
    test_safe_mode.py); here we confirm the audit signal exists.

    See ADR 0008 for why direct NORMAL -> FAILED is permitted.
    """

    sim, _ = run
    history = sim.step_history
    if len(history) < 2:
        return
    for prev, curr in zip(history, history[1:], strict=False):
        if not (
            prev.decision.system_mode == SystemMode.NORMAL
            and curr.decision.system_mode == SystemMode.FAILED
        ):
            continue
        mode_changes = [
            e
            for e in curr.events
            if e.type == EventType.MODE_CHANGE and e.step == curr.decision.step
        ]
        assert mode_changes, (
            f"I3 violated at step {curr.decision.step}: NORMAL -> FAILED with no MODE_CHANGE event"
        )
        justifications = [e.metadata.get("justification", "") for e in mode_changes]
        assert any("critical" in j or "invalid" in j for j in justifications), (
            f"I3 violated at step {curr.decision.step}: "
            f"NORMAL -> FAILED justifications were {justifications}"
        )


@_PROPERTY
@given(run=scenario_runs(min_steps=1, max_steps=12))
def test_i4_first_step_with_consensus_and_ok_sensor_is_normal(run):
    """At step 1, no faults have accumulated yet. If the vote is
    consensus and the sensor is OK, the mode must be NORMAL. This is
    the strongest form of I4 we can assert run-time without
    re-instrumenting the detectors."""

    sim, _ = run
    if not sim.step_history:
        return
    first = sim.step_history[0]
    if first.vote.outcome != VoteOutcome.CONSENSUS:
        return
    if first.sensor.status != SensorStatus.OK:
        return
    if any(not o.valid for o in first.outputs):
        return
    assert first.decision.system_mode == SystemMode.NORMAL, (
        f"I4 violated at step 1: consensus + OK sensor + valid controllers, "
        f"but mode is {first.decision.system_mode}"
    )


@_PROPERTY
@given(run=scenario_runs())
def test_i6_event_ids_unique_within_simulation(run):
    sim, _ = run
    seen: set[str] = set()
    for event in sim.events.all():
        assert event.event_id not in seen, f"I6 violated: event_id {event.event_id} appeared twice"
        seen.add(event.event_id)


@_PROPERTY
@given(run=scenario_runs())
def test_i7_step_monotonicity(run):
    sim, _ = run
    last = -1
    for record in sim.step_history:
        assert record.decision.step == record.state.step
        assert record.decision.step > last
        last = record.decision.step


@_PROPERTY
@given(run=scenario_runs())
def test_i9_consensus_iff_selected_action(run):
    sim, _ = run
    for record in sim.step_history:
        if record.vote.outcome == VoteOutcome.CONSENSUS:
            assert record.vote.selected_action is not None
        else:
            assert record.vote.selected_action is None


# I5 (critical controllers never appear in trusted_controllers) and
# I10 (recovery passes through RECOVERING) are detector-internal
# invariants. They are pinned by dedicated unit tests:
#
#   - I5: covered indirectly by the voting tests + safe-mode tests
#         (a CRITICAL controller's outputs are also marked invalid
#         by the controllers, which excludes them from the vote).
#   - I10: tests/test_health_detector.py::test_recovery_after_clean_streak
#         enforces the RECOVERING stage gate.
#
# Property tests for these would require step-by-step snapshots of
# detector state that the orchestrator does not currently emit. That
# instrumentation is tracked in docs/BACKLOG.md.
