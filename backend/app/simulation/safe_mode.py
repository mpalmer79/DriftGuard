from ..domain.enums import Action, SensorStatus, SystemMode, VoteOutcome
from ..domain.models import SensorReading, VoteResult
from .detection import FaultDetector

SAFE_ALLOWED_ACTIONS = {Action.HOLD, Action.STABILIZE, Action.DECELERATE, Action.ABORT}


class SafeModeManager:
    def __init__(self, detector: FaultDetector) -> None:
        self.detector = detector
        self.current_mode = SystemMode.NORMAL

    def evaluate(
        self,
        vote_result: VoteResult,
        sensor: SensorReading,
    ) -> tuple[SystemMode, str]:
        critical = self.detector.critical_controllers()
        unhealthy = self.detector.unhealthy_controllers()
        sensor_invalid = sensor.status == SensorStatus.INVALID

        if len(critical) >= 2 or (sensor_invalid and len(unhealthy) >= 1):
            return SystemMode.FAILED, "multiple critical failures"

        if vote_result.outcome == VoteOutcome.INSUFFICIENT_DATA:
            return SystemMode.SAFE_MODE, "insufficient valid controllers"

        if sensor_invalid:
            return SystemMode.SAFE_MODE, "sensor invalid"

        if vote_result.outcome == VoteOutcome.SPLIT:
            return SystemMode.SAFE_MODE, "no consensus"

        if len(critical) >= 1:
            return SystemMode.SAFE_MODE, "controller critical"

        if len(unhealthy) >= 1:
            return SystemMode.DEGRADED, "controller unreliable"

        return SystemMode.NORMAL, "all components healthy"

    def transition(self, new_mode: SystemMode) -> bool:
        changed = new_mode != self.current_mode
        self.current_mode = new_mode
        return changed

    @staticmethod
    def restrict_action(mode: SystemMode, action: Action) -> Action:
        if mode in (SystemMode.SAFE_MODE, SystemMode.FAILED):
            if action not in SAFE_ALLOWED_ACTIONS:
                return Action.STABILIZE
        return action

    @staticmethod
    def fallback_action(mode: SystemMode) -> Action:
        if mode == SystemMode.FAILED:
            return Action.ABORT
        if mode == SystemMode.SAFE_MODE:
            return Action.STABILIZE
        return Action.HOLD
