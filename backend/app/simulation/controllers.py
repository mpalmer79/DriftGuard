from abc import ABC, abstractmethod
from typing import Iterable, List

from ..domain.enums import Action, FaultType, SensorStatus
from ..domain.models import ControllerOutput, FaultRecord, SensorReading


TARGET_ALTITUDE = 1000.0
TARGET_VELOCITY = 120.0


class Controller(ABC):
    id: str
    base_response_time_ms: float

    @abstractmethod
    def _decide(self, reading: SensorReading) -> tuple[Action, float, str]:
        ...

    def evaluate(
        self,
        reading: SensorReading,
        active_faults: Iterable[FaultRecord],
    ) -> ControllerOutput:
        bias_offset = 0.0
        timeout = False
        invalid_input = reading.status == SensorStatus.INVALID

        for fault in active_faults:
            if fault.target_component != self.id:
                continue
            if fault.type == FaultType.CONTROLLER_BIAS:
                bias_offset = float(fault.metadata.get("offset", 40.0))
            elif fault.type == FaultType.CONTROLLER_TIMEOUT:
                timeout = True

        response_time = self.base_response_time_ms
        if timeout:
            response_time = float(fault.metadata.get("delay_ms", 200.0)) if fault.metadata else 200.0

        if invalid_input:
            return ControllerOutput(
                controller_id=self.id,
                step=reading.step,
                action=Action.HOLD,
                confidence=0.0,
                reason_code="INVALID_INPUT",
                response_time_ms=response_time,
                valid=False,
            )

        biased = SensorReading(
            reading_id=reading.reading_id,
            step=reading.step,
            altitude=reading.altitude + bias_offset,
            velocity=reading.velocity,
            heading=reading.heading,
            pitch=reading.pitch,
            roll=reading.roll,
            confidence=reading.confidence,
            status=reading.status,
            fault_flags=list(reading.fault_flags),
        )

        action, confidence, reason = self._decide(biased)
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


def default_controllers() -> List[Controller]:
    return [ConservativeController(), ResponsiveController(), BalancedController()]
