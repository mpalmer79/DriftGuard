import random
import uuid
from typing import List, Iterable

from ..domain.enums import FaultType, SensorStatus
from ..domain.models import FaultRecord, SensorReading, VehicleState


class SensorModel:
    def __init__(self, seed: int, noise_std: float):
        self._rng = random.Random(seed)
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
        flags: List[str] = []

        for fault in active_faults:
            if fault.target_component != "sensor":
                continue
            if fault.type == FaultType.SENSOR_DRIFT:
                magnitude = float(fault.metadata.get("magnitude", 1.5))
                self._drift_acc += magnitude
                altitude += self._drift_acc
                confidence *= 0.7
                status = SensorStatus.DEGRADED
                flags.append(FaultType.SENSOR_DRIFT.value)
            elif fault.type == FaultType.SENSOR_SPIKE:
                magnitude = float(fault.metadata.get("magnitude", 50.0))
                altitude += magnitude
                velocity += magnitude / 5.0
                confidence *= 0.4
                status = SensorStatus.DEGRADED
                flags.append(FaultType.SENSOR_SPIKE.value)
            elif fault.type == FaultType.DATA_LOSS:
                confidence = 0.0
                status = SensorStatus.INVALID
                flags.append(FaultType.DATA_LOSS.value)

        return SensorReading(
            reading_id=str(uuid.uuid4()),
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
