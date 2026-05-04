from app.domain.enums import Action, SensorStatus, SystemMode, VoteOutcome
from app.domain.models import SensorReading, VoteResult
from app.simulation.detection import FaultDetector
from app.simulation.safe_mode import SafeModeManager


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


def _vote(outcome):
    return VoteResult(
        outcome=outcome,
        selected_action=Action.HOLD if outcome == VoteOutcome.CONSENSUS else None,
        agreeing_controllers=[],
        rejected_controllers=[],
        reason="t",
    )


def test_safe_mode_on_split():
    m = SafeModeManager(FaultDetector(50.0, 3, 6, 2, 4))
    mode, _ = m.evaluate(_vote(VoteOutcome.SPLIT), _reading())
    assert mode == SystemMode.SAFE_MODE


def test_safe_mode_on_invalid_sensor():
    m = SafeModeManager(FaultDetector(50.0, 3, 6, 2, 4))
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading(SensorStatus.INVALID))
    assert mode == SystemMode.SAFE_MODE


def test_normal_when_healthy():
    m = SafeModeManager(FaultDetector(50.0, 3, 6, 2, 4))
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert mode == SystemMode.NORMAL


def test_failed_when_two_critical():
    d = FaultDetector(50.0, 3, 6, 2, 4)
    d.state.invalid_counts["controller_a"] = 5
    d.state.invalid_counts["controller_b"] = 5
    m = SafeModeManager(d)
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert mode == SystemMode.FAILED


def test_restrict_action_in_safe_mode():
    assert SafeModeManager.restrict_action(SystemMode.SAFE_MODE, Action.ASCEND) == Action.STABILIZE
    assert SafeModeManager.restrict_action(SystemMode.NORMAL, Action.ASCEND) == Action.ASCEND
