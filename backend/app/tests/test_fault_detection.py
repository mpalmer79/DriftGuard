from app.domain.enums import Action, FaultSeverity, SensorStatus, VoteOutcome
from app.domain.models import ControllerOutput, SensorReading, VoteResult
from app.simulation.detection import FaultDetector


def _reading(status=SensorStatus.OK):
    return SensorReading(
        reading_id="r",
        step=1,
        altitude=1000,
        velocity=120,
        heading=0,
        pitch=0,
        roll=0,
        confidence=1.0,
        status=status,
        fault_flags=[],
    )


def _out(cid, valid=True, rt=10.0):
    return ControllerOutput(
        controller_id=cid,
        step=1,
        action=Action.HOLD,
        confidence=0.8,
        reason_code="X",
        response_time_ms=rt,
        valid=valid,
    )


def _vote(outcome=VoteOutcome.CONSENSUS):
    return VoteResult(
        outcome=outcome,
        selected_action=Action.HOLD,
        agreeing_controllers=[],
        rejected_controllers=[],
        reason="t",
    )


def test_invalid_outputs_promote_to_critical():
    d = FaultDetector(50.0, 3, 6, 2, 4)
    for _ in range(4):
        d.update([_out("controller_a", valid=False)], _vote(), _reading())
    assert "controller_a" in d.critical_controllers()


def test_disagreement_warning():
    d = FaultDetector(50.0, 3, 6, 2, 4)
    warns = []
    for _ in range(3):
        warns.extend(d.update([_out("a")], _vote(VoteOutcome.SPLIT), _reading()))
    assert any(w[0] == "voting" and w[1] == FaultSeverity.WARNING for w in warns)


def test_latency_violation_tracked():
    d = FaultDetector(50.0, 3, 6, 2, 4)
    for _ in range(2):
        d.update([_out("controller_b", rt=300.0)], _vote(), _reading())
    assert "controller_b" in d.unhealthy_controllers()


def test_latency_thresholds_decoupled_from_invalid_thresholds():
    """Phase 5.2: latency violations bucket independently from invalid
    outputs. A deployment that wants to be lenient on latency but strict
    on invalid output (or vice versa) must be able to tune them
    independently.
    """

    # Strict on invalid (warn at 2), lenient on latency (warn at 10).
    d = FaultDetector(
        latency_threshold_ms=50.0,
        disagreement_warning=3,
        disagreement_critical=6,
        invalid_warning=2,
        invalid_critical=4,
        latency_warning=10,
        latency_critical=20,
    )

    # 3 latency-violating outputs in a row — the OLD coupled logic
    # would have crossed the inv_warn=2 threshold and flagged
    # `controller_a` as unhealthy. Under the decoupled thresholds it
    # should NOT.
    for _ in range(3):
        d.update([_out("controller_a", rt=300.0)], _vote(), _reading())
    assert "controller_a" not in d.unhealthy_controllers(), (
        "latency count should bucket against lat_warn=10, not inv_warn=2"
    )

    # And invalid outputs at the strict threshold do still trip
    # unhealthy on the same detector.
    for _ in range(2):
        d.update([_out("controller_b", valid=False)], _vote(), _reading())
    assert "controller_b" in d.unhealthy_controllers()


def test_default_thresholds_preserve_legacy_behavior():
    """Sanity: when the new latency_warning/critical params are
    omitted, the detector falls back to the invalid_* thresholds, so
    every call site that hasn't been updated yet behaves exactly as
    before."""

    d = FaultDetector(
        latency_threshold_ms=50.0,
        disagreement_warning=3,
        disagreement_critical=6,
        invalid_warning=2,
        invalid_critical=4,
    )
    assert d.lat_warn == 2
    assert d.lat_crit == 4

    # 2 latency violations cross the legacy threshold.
    for _ in range(2):
        d.update([_out("controller_c", rt=300.0)], _vote(), _reading())
    assert "controller_c" in d.unhealthy_controllers()
