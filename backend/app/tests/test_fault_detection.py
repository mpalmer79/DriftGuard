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
