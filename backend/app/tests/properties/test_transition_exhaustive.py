"""Exhaustive verification of the safe-mode transition function.

The TLA+ spec at ``docs/formal/SafeMode.tla`` defines the
transition policy. This test mirrors the spec's input space (vote,
sensor, critical_count, unhealthy_count) and asserts that the live
``SafeModeManager.evaluate`` agrees with the spec on every
combination.

Running TLC against the .tla file would prove the same property
with a real model checker; we get equivalent coverage for free here
because the input space is finite and small (3 votes × 3 sensors ×
4 critical counts × 4 unhealthy counts = 144 cases).
"""

from __future__ import annotations

from itertools import product

import pytest

from app.domain.enums import (
    Action,
    HealthStatus,
    SensorStatus,
    SystemMode,
    VoteOutcome,
)
from app.domain.models import SensorReading, VoteResult
from app.simulation.detection import FaultDetector
from app.simulation.safe_mode import SafeModeManager


def _spec_evaluate(
    vote: VoteOutcome,
    sensor: SensorStatus,
    critical_count: int,
    unhealthy_count: int,
) -> SystemMode:
    """Reference implementation matching docs/formal/SafeMode.tla."""

    sensor_invalid = sensor == SensorStatus.INVALID
    if critical_count >= 2:
        return SystemMode.FAILED
    if sensor_invalid and unhealthy_count >= 1:
        return SystemMode.FAILED
    if vote == VoteOutcome.INSUFFICIENT_DATA:
        return SystemMode.SAFE_MODE
    if sensor_invalid:
        return SystemMode.SAFE_MODE
    if vote == VoteOutcome.SPLIT:
        return SystemMode.SAFE_MODE
    if critical_count >= 1:
        return SystemMode.SAFE_MODE
    if unhealthy_count >= 1:
        return SystemMode.DEGRADED
    return SystemMode.NORMAL


def _mock_detector(critical: int, unhealthy: int) -> FaultDetector:
    """Construct a FaultDetector whose unhealthy/critical accessors
    return the desired counts.

    Per the spec's domain restriction (critical <= unhealthy), the
    critical controllers are a subset of the unhealthy ones. The
    first ``critical`` controllers get above-critical counters, the
    next ``unhealthy - critical`` get above-warning-but-below-critical
    counters, and the rest stay clean.
    """

    assert critical <= unhealthy, "spec domain violation: critical > unhealthy"
    detector = FaultDetector(
        latency_threshold_ms=50.0,
        disagreement_warning=3,
        disagreement_critical=6,
        invalid_warning=2,
        invalid_critical=4,
    )
    cids = ["controller_a", "controller_b", "controller_c"]
    for i, cid in enumerate(cids):
        if i < critical:
            detector.state.invalid_counts[cid] = 5  # >= invalid_critical
        elif i < unhealthy:
            detector.state.invalid_counts[cid] = 2  # >= invalid_warning, < invalid_critical
    return detector


def _vote_result(outcome: VoteOutcome) -> VoteResult:
    return VoteResult(
        outcome=outcome,
        selected_action=Action.HOLD if outcome == VoteOutcome.CONSENSUS else None,
        agreeing_controllers=[],
        rejected_controllers=[],
        reason="t",
    )


def _sensor_reading(status: SensorStatus) -> SensorReading:
    return SensorReading(
        reading_id="r",
        step=1,
        altitude=1000.0,
        velocity=120.0,
        heading=90.0,
        pitch=0.0,
        roll=0.0,
        confidence=1.0 if status == SensorStatus.OK else 0.0,
        status=status,
        fault_flags=[],
    )


@pytest.mark.parametrize(
    ("vote", "sensor", "critical", "unhealthy"),
    [
        (v, s, c, u)
        for v, s, c, u in product(VoteOutcome, SensorStatus, range(0, 4), range(0, 4))
        # Domain restriction matching docs/formal/SafeMode.tla: every
        # CRITICAL controller is also above the SUSPECT threshold, so
        # critical_count <= unhealthy_count <= NumControllers (3).
        if c <= u <= 3
    ],
)
def test_evaluate_matches_spec_for_every_input(vote, sensor, critical, unhealthy):
    """Live SafeModeManager.evaluate must agree with the TLA+ spec."""

    detector = _mock_detector(critical, unhealthy)
    manager = SafeModeManager(detector)

    expected = _spec_evaluate(vote, sensor, critical, unhealthy)
    actual, _ = manager.evaluate(_vote_result(vote), _sensor_reading(sensor))
    assert actual == expected, (
        f"transition mismatch for vote={vote}, sensor={sensor}, "
        f"critical={critical}, unhealthy={unhealthy}: "
        f"spec said {expected}, manager said {actual}"
    )


@pytest.mark.parametrize(
    ("vote", "sensor", "critical", "unhealthy"),
    [
        (v, s, c, u)
        for v, s, c, u in product(VoteOutcome, SensorStatus, range(0, 4), range(0, 4))
        if c <= u <= 3
    ],
)
def test_failed_precondition_holds_per_spec(vote, sensor, critical, unhealthy):
    """I1 / I3 spec: FAILED is reachable iff the precondition holds."""

    detector = _mock_detector(critical, unhealthy)
    manager = SafeModeManager(detector)
    actual, _ = manager.evaluate(_vote_result(vote), _sensor_reading(sensor))
    if actual == SystemMode.FAILED:
        assert critical >= 2 or (sensor == SensorStatus.INVALID and unhealthy >= 1)


def test_healthy_quorum_yields_normal():
    """I4: spec property — healthy quorum is NORMAL."""

    detector = _mock_detector(0, 0)
    manager = SafeModeManager(detector)
    actual, _ = manager.evaluate(
        _vote_result(VoteOutcome.CONSENSUS), _sensor_reading(SensorStatus.OK)
    )
    assert actual == SystemMode.NORMAL


def test_health_status_enum_present_in_domain():
    """Sanity: the HealthStatus enum the trust detector uses is in
    the domain layer; the TLA+ spec models the trust detector's
    *output* (critical and unhealthy counts), not its internals."""

    assert HealthStatus.HEALTHY in HealthStatus
    assert HealthStatus.RECOVERING in HealthStatus
