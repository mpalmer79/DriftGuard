"""Fault-application helpers for controllers.

Extracted from `controllers.py` so the controller class stays focused
on "given a sensor reading, decide an action," and the fault overlays
(bias, latency, forced action, silent failure, conflict, compound) live
in one place.
"""

import random
from collections.abc import Iterable
from dataclasses import dataclass

from ..domain.enums import Action, FaultType
from ..domain.models import FaultRecord, SensorReading

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


@dataclass
class ControllerFaultEffect:
    bias_offset: float = 0.0
    confidence_scale: float = 1.0
    forced_action: Action | None = None
    timeout: bool = False
    timeout_delay: float = 0.0
    force_invalid: bool = False
    silent: bool = False
    flip_action: bool = False
    applicable: int = 0


def fault_active_this_step(fault: FaultRecord, step: int, rng: random.Random) -> bool:
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


def aggregate_effects(
    controller_id: str,
    base_response_time_ms: float,
    reading: SensorReading,
    active_faults: Iterable[FaultRecord],
    rng: random.Random,
) -> ControllerFaultEffect:
    fx = ControllerFaultEffect(timeout_delay=base_response_time_ms)

    applicable: list[FaultRecord] = []
    for fault in active_faults:
        if fault.target_component != controller_id:
            continue
        if not fault_active_this_step(fault, reading.step, rng):
            continue
        applicable.append(fault)

    fx.applicable = len(applicable)

    for fault in applicable:
        ftype = fault.type
        meta = fault.metadata
        if ftype == FaultType.CONTROLLER_BIAS:
            fx.bias_offset += float(meta.get("offset", 40.0))
        elif ftype == FaultType.CONTROLLER_TIMEOUT:
            fx.timeout = True
            fx.timeout_delay = float(meta.get("delay_ms", 200.0))
        elif ftype == FaultType.CONTROLLER_LATENCY:
            fx.timeout_delay = max(fx.timeout_delay, float(meta.get("latency_ms", 75.0)))
        elif ftype == FaultType.CONTROLLER_INVALID_OUTPUT:
            fx.force_invalid = True
        elif ftype == FaultType.CONTROLLER_CONFIDENCE_DROP:
            fx.confidence_scale *= float(meta.get("confidence", 0.3))
        elif ftype == FaultType.CONTROLLER_ACTION_BIAS:
            forced = meta.get("forced_action")
            if forced:
                try:
                    fx.forced_action = Action(forced)
                except ValueError:
                    pass
        elif ftype == FaultType.CONTROLLER_SILENT_FAILURE:
            fx.silent = True
        elif ftype == FaultType.CONFLICTING_CONTROLLER:
            fx.flip_action = True
        elif ftype == FaultType.COMPOUND_FAULT:
            fx.bias_offset += float(meta.get("offset", 30.0))
            fx.timeout_delay = max(fx.timeout_delay, float(meta.get("latency_ms", 60.0)))
            fx.confidence_scale *= float(meta.get("confidence", 0.5))

    return fx


def overlay_action(action: Action, effect: ControllerFaultEffect) -> tuple[Action, str]:
    if effect.forced_action is not None:
        return effect.forced_action, "FORCED_ACTION"
    if effect.flip_action:
        return _ACTION_OPPOSITES.get(action, action), "CONFLICTING"
    return action, ""
