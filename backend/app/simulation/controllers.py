import random
from abc import ABC, abstractmethod
from typing import Iterable, List

from ..domain.enums import Action, FaultType, SensorStatus
from ..domain.models import ControllerOutput, FaultRecord, SensorReading


TARGET_ALTITUDE = 1000.0
TARGET_VELOCITY = 120.0


_ACTION_OPPOSITES = {
    Action.ASCEND: Action.DESCEND,
    Action.DESCEND: Action.ASCEND,
    Action.ACCELERATE: Action.DECELERATE,
    Action.DECELERATE: Action.ACCELERATE,
    Action.TURN_LEFT: Action.TURN_RIGHT,
    Action.TURN_RIGHT: Action.TURN_LEFT,
    Action.HOLD: Action.HOLD,
    Action.STABILIZE: Action.STABILIZE,
    Action.ABORT: Action.ABORT,
}


class Controller(ABC):
    id: str
    base_response_time_ms: float

    def __init__(self) -> None:
        self._fault_rng = random.Random(hash(self.id) & 0xFFFFFFFF)

    @abstractmethod
    def _decide(self, reading: SensorReading) -> tuple[Action, float, str]:
        ...

    def evaluate(
        self,
        reading: SensorReading,
        active_faults: Iterable[FaultRecord],
    ) -> ControllerOutput:
        bias_offset = 0.0
        confidence_scale = 1.0
        forced_action = None
        timeout = False
        timeout_delay = self.base_response_time_ms
        invalid_input = reading.status == SensorStatus.INVALID
        force_invalid = False
        silent = False
        flip_action = False

        applicable: List[FaultRecord] = []
        for fault in active_faults:
            if fault.target_component != self.id:
                continue
            if not _fault_active_this_step(fault, reading.step, self._fault_rng):
                continue
            applicable.append(fault)

        for fault in applicable:
            ftype = fault.type
            if ftype == FaultType.CONTROLLER_BIAS:
                bias_offset += float(fault.metadata.get("offset", 40.0))
            elif ftype == FaultType.CONTROLLER_TIMEOUT:
                timeout = True
                timeout_delay = float(fault.metadata.get("delay_ms", 200.0))
            elif ftype == FaultType.CONTROLLER_LATENCY:
                # additive latency
                timeout_delay = max(timeout_delay, float(fault.metadata.get("latency_ms", 75.0)))
            elif ftype == FaultType.CONTROLLER_INVALID_OUTPUT:
                force_invalid = True
            elif ftype == FaultType.CONTROLLER_CONFIDENCE_DROP:
                confidence_scale *= float(fault.metadata.get("confidence", 0.3))
            elif ftype == FaultType.CONTROLLER_ACTION_BIAS:
                forced = fault.metadata.get("forced_action")
                if forced:
                    try:
                        forced_action = Action(forced)
                    except ValueError:
                        pass
            elif ftype == FaultType.CONTROLLER_SILENT_FAILURE:
                silent = True
            elif ftype == FaultType.CONFLICTING_CONTROLLER:
                flip_action = True
            elif ftype == FaultType.COMPOUND_FAULT:
                # union of bias + latency + confidence drop
                bias_offset += float(fault.metadata.get("offset", 30.0))
                timeout_delay = max(timeout_delay, float(fault.metadata.get("latency_ms", 60.0)))
                confidence_scale *= float(fault.metadata.get("confidence", 0.5))

        response_time = timeout_delay if timeout or applicable else self.base_response_time_ms

        if silent:
            return ControllerOutput(
                controller_id=self.id,
                step=reading.step,
                action=Action.HOLD,
                confidence=0.0,
                reason_code="SILENT_FAILURE",
                response_time_ms=response_time,
                valid=False,
            )

        if force_invalid or invalid_input:
            return ControllerOutput(
                controller_id=self.id,
                step=reading.step,
                action=Action.HOLD,
                confidence=0.0,
                reason_code="INVALID_OUTPUT" if force_invalid else "INVALID_INPUT",
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

        if forced_action is not None:
            action = forced_action
            reason = "FORCED_ACTION"
        elif flip_action:
            action = _ACTION_OPPOSITES.get(action, action)
            reason = f"CONFLICTING({reason})"

        confidence = max(0.0, min(1.0, confidence * confidence_scale))
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


def _fault_active_this_step(fault: FaultRecord, step: int, rng: random.Random) -> bool:
    pattern = fault.metadata.get("intermittent_pattern")
    if pattern:
        idx = (step - fault.start_step) % len(pattern)
        return bool(pattern[idx])
    p = fault.metadata.get("probability")
    if p is not None:
        try:
            return rng.random() < float(p)
        except (TypeError, ValueError):
            return True
    return True


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
