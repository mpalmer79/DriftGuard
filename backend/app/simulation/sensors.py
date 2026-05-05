import random
from collections.abc import Iterable

from ..core.ids import reading_id as _new_reading_id
from ..domain.enums import FaultType, SensorStatus
from ..domain.models import FaultRecord, SensorReading, VehicleState


class SensorModel:
    """Per-step sensor reader.

    The RNG is injected so that the simulation can route every random
    consumer through `core.rng.RngService.child("sensor")`. See ADR 0006.
    """

    def __init__(self, rng: random.Random, noise_std: float):
        self._rng = rng
        self._noise = noise_std
        self._drift_acc = 0.0

    def read(self, state: VehicleState, active_faults: Iterable[FaultRecord]) -> SensorReading:
        altitude = state.altitude + self._gauss()
        velocity = state.velocity + self._gauss()
        heading = state.heading + self._gauss()
        pitch = state.pitch + self._gauss()
        roll = state.roll + self._gauss()

        confidence = 1.0
        status = SensorStatus.OK
        flags: list[str] = []

        for fault in active_faults:
            if fault.target_component != "sensor":
                continue
            if not _intermittent_active(fault, state.step, self._rng):
                continue

            ftype = fault.type
            if ftype == FaultType.SENSOR_DRIFT:
                magnitude = float(fault.metadata.get("magnitude", 1.5))
                self._drift_acc += magnitude
                fields = fault.metadata.get("affected_fields") or ["altitude"]
                if "altitude" in fields:
                    altitude += self._drift_acc
                if "velocity" in fields:
                    velocity += self._drift_acc / 2.0
                confidence *= 0.7
                status = SensorStatus.DEGRADED
                flags.append(ftype.value)
            elif ftype == FaultType.SENSOR_SPIKE:
                magnitude = float(fault.metadata.get("magnitude", 50.0))
                altitude += magnitude
                velocity += magnitude / 5.0
                confidence *= 0.4
                status = SensorStatus.DEGRADED
                flags.append(ftype.value)
            elif ftype == FaultType.SENSOR_NOISE_SPIKE:
                amp = float(fault.metadata.get("magnitude", 15.0))
                altitude += self._rng.gauss(0.0, amp)
                velocity += self._rng.gauss(0.0, amp / 3.0)
                confidence *= 0.5
                status = SensorStatus.DEGRADED
                flags.append(ftype.value)
            elif ftype == FaultType.SENSOR_DROPOUT:
                # like data loss but only intermittently / with metadata probability
                p = float(fault.metadata.get("probability", 1.0))
                if self._rng.random() < p:
                    confidence = 0.0
                    status = SensorStatus.INVALID
                    flags.append(ftype.value)
                else:
                    confidence *= 0.6
                    status = SensorStatus.DEGRADED
                    flags.append(ftype.value)
            elif ftype == FaultType.DATA_LOSS:
                confidence = 0.0
                status = SensorStatus.INVALID
                flags.append(ftype.value)

        return SensorReading(
            reading_id=_new_reading_id(),
            step=state.step,
            altitude=altitude,
            velocity=velocity,
            heading=heading,
            pitch=pitch,
            roll=roll,
            confidence=round(confidence, 4),
            status=status,
            fault_flags=flags,
        )

    def _gauss(self) -> float:
        if self._noise <= 0.0:
            return 0.0
        return self._rng.gauss(0.0, self._noise)


def _intermittent_active(fault: FaultRecord, step: int, rng: random.Random) -> bool:
    """Decide whether an active fault fires this step.

    Defaults to always-on. Supports two metadata keys:
      - intermittent_pattern: list of 0/1 (or bool) values, indexed by
        steps since fault.start_step (modular).
      - probability: probability per step (independent draws).
    """

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
