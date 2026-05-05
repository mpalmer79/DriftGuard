import random
from abc import ABC, abstractmethod
from collections.abc import Iterable

from ..core.rng import RngService
from ..domain.enums import Action, SensorStatus
from ..domain.models import ControllerOutput, FaultRecord, SensorReading
from .controller_fault_application import aggregate_effects, overlay_action

TARGET_ALTITUDE = 1000.0
TARGET_VELOCITY = 120.0


class Controller(ABC):
    id: str
    base_response_time_ms: float

    def __init__(self, fault_rng: random.Random | None = None) -> None:
        # Per ADR 0006, controllers should be fed by RngService.child(...).
        # The fallback preserves the legacy in-process behavior for unit
        # tests that construct controllers directly without a service.
        if fault_rng is None:
            fault_rng = random.Random(hash(self.id) & 0xFFFFFFFF)
        self._fault_rng = fault_rng

    @abstractmethod
    def _decide(self, reading: SensorReading) -> tuple[Action, float, str]: ...

    def evaluate(
        self,
        reading: SensorReading,
        active_faults: Iterable[FaultRecord],
    ) -> ControllerOutput:
        invalid_input = reading.status == SensorStatus.INVALID
        fx = aggregate_effects(
            self.id,
            self.base_response_time_ms,
            reading,
            active_faults,
            self._fault_rng,
        )

        response_time = (
            fx.timeout_delay if fx.timeout or fx.applicable else self.base_response_time_ms
        )

        if fx.silent:
            return ControllerOutput(
                controller_id=self.id,
                step=reading.step,
                action=Action.HOLD,
                confidence=0.0,
                reason_code="SILENT_FAILURE",
                response_time_ms=response_time,
                valid=False,
            )

        if fx.force_invalid or invalid_input:
            return ControllerOutput(
                controller_id=self.id,
                step=reading.step,
                action=Action.HOLD,
                confidence=0.0,
                reason_code="INVALID_OUTPUT" if fx.force_invalid else "INVALID_INPUT",
                response_time_ms=response_time,
                valid=False,
            )

        biased = SensorReading(
            reading_id=reading.reading_id,
            step=reading.step,
            altitude=reading.altitude + fx.bias_offset,
            velocity=reading.velocity,
            heading=reading.heading,
            pitch=reading.pitch,
            roll=reading.roll,
            confidence=reading.confidence,
            status=reading.status,
            fault_flags=list(reading.fault_flags),
        )

        action, confidence, reason = self._decide(biased)
        action, overlay_reason = overlay_action(action, fx)
        if overlay_reason == "FORCED_ACTION":
            reason = overlay_reason
        elif overlay_reason == "CONFLICTING":
            reason = f"CONFLICTING({reason})"

        confidence = max(0.0, min(1.0, confidence * fx.confidence_scale))
        valid = reading.confidence > 0.0
        return ControllerOutput(
            controller_id=self.id,
            step=reading.step,
            action=action,
            confidence=confidence,
            reason_code=reason,
            response_time_ms=response_time,
            valid=valid,
        )


class ConservativeController(Controller):
    id = "controller_a"
    base_response_time_ms = 18.0

    def _decide(self, r: SensorReading) -> tuple[Action, float, str]:
        alt_err = r.altitude - TARGET_ALTITUDE
        if abs(r.roll) > 8.0 or abs(r.pitch) > 8.0:
            return Action.STABILIZE, 0.85, "ATTITUDE_OUT_OF_BAND"
        if alt_err > 30.0:
            return Action.DESCEND, 0.8, "ALT_HIGH"
        if alt_err < -30.0:
            return Action.ASCEND, 0.8, "ALT_LOW"
        return Action.HOLD, 0.9, "STEADY"


class ResponsiveController(Controller):
    id = "controller_b"
    base_response_time_ms = 12.0

    def _decide(self, r: SensorReading) -> tuple[Action, float, str]:
        alt_err = r.altitude - TARGET_ALTITUDE
        vel_err = r.velocity - TARGET_VELOCITY
        if alt_err > 5.0:
            return Action.DESCEND, 0.7, "ALT_DRIFT_HIGH"
        if alt_err < -5.0:
            return Action.ASCEND, 0.7, "ALT_DRIFT_LOW"
        if vel_err > 5.0:
            return Action.DECELERATE, 0.65, "VEL_HIGH"
        if vel_err < -5.0:
            return Action.ACCELERATE, 0.65, "VEL_LOW"
        return Action.HOLD, 0.6, "TRIM"


class BalancedController(Controller):
    id = "controller_c"
    base_response_time_ms = 15.0

    def _decide(self, r: SensorReading) -> tuple[Action, float, str]:
        alt_err = r.altitude - TARGET_ALTITUDE
        vel_err = r.velocity - TARGET_VELOCITY
        if abs(r.roll) > 15.0:
            return Action.STABILIZE, 0.9, "ROLL_EXCEED"
        if alt_err > 15.0:
            return Action.DESCEND, 0.75, "ALT_HIGH"
        if alt_err < -15.0:
            return Action.ASCEND, 0.75, "ALT_LOW"
        if vel_err > 10.0:
            return Action.DECELERATE, 0.7, "VEL_HIGH"
        if vel_err < -10.0:
            return Action.ACCELERATE, 0.7, "VEL_LOW"
        return Action.HOLD, 0.8, "NOMINAL"


def default_controllers(rng: RngService | None = None) -> list[Controller]:
    """Build the standard A/B/C controller set.

    When given an RngService, each controller's fault-activation RNG
    is sourced from a named child (`{controller_id}.fault`), so the
    full simulation reproduces across processes (ADR 0006).
    """

    def fault_rng_for(cid: str) -> random.Random | None:
        return rng.child(f"{cid}.fault") if rng is not None else None

    return [
        ConservativeController(fault_rng=fault_rng_for(ConservativeController.id)),
        ResponsiveController(fault_rng=fault_rng_for(ResponsiveController.id)),
        BalancedController(fault_rng=fault_rng_for(BalancedController.id)),
    ]
