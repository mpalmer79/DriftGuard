from ..domain.enums import Action, SensorStatus, SystemMode, VoteOutcome
from ..domain.models import SensorReading, VoteResult
from .detection import FaultDetector

SAFE_ALLOWED_ACTIONS = {Action.HOLD, Action.STABILIZE, Action.DECELERATE, Action.ABORT}

# Phase 3.2: severity ordering for the hysteresis policy.
# `evaluate` returns a less-severe mode immediately on escalation
# but only after `recovery_steps` consecutive proposals on
# de-escalation (ADR 0011 / I11).
_MODE_SEVERITY = {
    SystemMode.NORMAL: 0,
    SystemMode.DEGRADED: 1,
    SystemMode.SAFE_MODE: 2,
    SystemMode.FAILED: 3,
}


class SafeModeManager:
    """System-mode arbitrator with recovery hysteresis (ADR 0011).

    Escalations are immediate. De-escalations require
    `recovery_steps` consecutive evaluations that propose the same
    or even-less-severe mode before the manager publishes the
    de-escalation. A glitch back to (or above) `current_mode` resets
    the streak, so brief excursions don't poison the recovery
    window — they restart it.

    The pure clause body (the same one the TLA+ spec models, see
    `docs/formal/SafeMode.tla`) lives in `_evaluate_proposed`.
    `evaluate` is the hysteresis wrapper around that.
    """

    def __init__(self, detector: FaultDetector, recovery_steps: int = 5) -> None:
        self.detector = detector
        self.current_mode = SystemMode.NORMAL
        self.recovery_steps = max(1, int(recovery_steps))
        # Number of consecutive evaluations that have proposed a
        # strictly-less-severe mode than `current_mode`. Reset on
        # any proposal at or above the current mode, and on
        # publication of a de-escalation.
        self._recovery_streak = 0

    def _evaluate_proposed(
        self,
        vote_result: VoteResult,
        sensor: SensorReading,
    ) -> tuple[SystemMode, str]:
        """Pure proposed-mode policy. Mirrors `EvaluateMode` in
        `docs/formal/SafeMode.tla` exactly. Hysteresis is layered on
        in `evaluate` — see ADR 0011 for why this split exists."""

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

    def evaluate(
        self,
        vote_result: VoteResult,
        sensor: SensorReading,
    ) -> tuple[SystemMode, str]:
        """Apply recovery hysteresis on top of `_evaluate_proposed`.

        Policy (ADR 0011 / I11):
        - Escalation (proposed > current): publish proposed mode
          immediately. Reset the recovery streak.
        - Same mode: nothing to do; reset the recovery streak.
        - De-escalation (proposed < current): increment the streak.
          Publish only when the streak has reached
          `recovery_steps`; otherwise hold `current_mode`.
        """

        proposed_mode, justification = self._evaluate_proposed(vote_result, sensor)
        proposed_sev = _MODE_SEVERITY[proposed_mode]
        current_sev = _MODE_SEVERITY[self.current_mode]

        if proposed_sev >= current_sev:
            # Escalation or hold — immediate.
            self._recovery_streak = 0
            return proposed_mode, justification

        # De-escalation candidate.
        self._recovery_streak += 1
        if self._recovery_streak >= self.recovery_steps:
            self._recovery_streak = 0
            return proposed_mode, justification

        # Hold the current (more severe) mode and explain why.
        return (
            self.current_mode,
            f"{justification} (recovery {self._recovery_streak}/{self.recovery_steps})",
        )

    def transition(self, new_mode: SystemMode) -> bool:
        changed = new_mode != self.current_mode
        self.current_mode = new_mode
        return changed

    @staticmethod
    def restrict_action(mode: SystemMode, action: Action) -> Action:
        if mode in (SystemMode.SAFE_MODE, SystemMode.FAILED) and action not in SAFE_ALLOWED_ACTIONS:
            return Action.STABILIZE
        return action

    @staticmethod
    def fallback_action(mode: SystemMode) -> Action:
        if mode == SystemMode.FAILED:
            return Action.ABORT
        if mode == SystemMode.SAFE_MODE:
            return Action.STABILIZE
        return Action.HOLD
