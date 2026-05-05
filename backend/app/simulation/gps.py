"""GPS sensor model.

A slow, noisy position/velocity source. The model is deliberately
simple: the GPS reports a noisy snapshot of truth at a fixed cadence
(default: every 5 simulation steps). When a ``GPS_DENIED`` fault is
active and targets ``"gps"``, the GPS goes dark for the duration of
the fault.

The Phase 2.5 EKF consumes these readings to bound the INS drift.
Without GPS aiding (denial scenarios), the INS-alone error grows;
the test for that lives in ``test_ins.py``.
"""

from __future__ import annotations

import math
import random
from collections.abc import Iterable
from dataclasses import dataclass

from ..domain.enums import FaultType
from ..domain.models import FaultRecord, VehicleState


@dataclass
class GpsReading:
    step: int
    available: bool
    position_x: float | None
    position_y: float | None
    altitude: float | None
    velocity: float | None  # ground speed magnitude
    fault_flags: list[str]


class GPS:
    """Slow position/velocity sensor with noise and denial support."""

    def __init__(
        self,
        rng: random.Random,
        update_rate_steps: int = 5,
        position_noise_std: float = 2.0,
        velocity_noise_std: float = 0.5,
    ) -> None:
        if update_rate_steps <= 0:
            raise ValueError("update_rate_steps must be positive")
        self._rng = rng
        self._rate = update_rate_steps
        self._pos_std = position_noise_std
        self._vel_std = velocity_noise_std

    def read(
        self,
        truth: VehicleState,
        active_faults: Iterable[FaultRecord],
    ) -> GpsReading:
        """Return a (possibly unavailable) GPS reading.

        - Off-cadence steps return an unavailable reading; the EKF
          should ignore these.
        - GPS_DENIED faults targeting ``"gps"`` mark every step in
          the window unavailable, regardless of cadence.
        """

        flags: list[str] = []
        denied = False
        for fault in active_faults:
            if fault.target_component != "gps":
                continue
            if fault.type == FaultType.GPS_DENIED:
                denied = True
                flags.append(FaultType.GPS_DENIED.value)

        if denied:
            return GpsReading(
                step=truth.step,
                available=False,
                position_x=None,
                position_y=None,
                altitude=None,
                velocity=None,
                fault_flags=flags,
            )

        if truth.step % self._rate != 0:
            return GpsReading(
                step=truth.step,
                available=False,
                position_x=None,
                position_y=None,
                altitude=None,
                velocity=None,
                fault_flags=flags,
            )

        # Available reading: noisy snapshot of truth.
        return GpsReading(
            step=truth.step,
            available=True,
            position_x=truth.position_x + self._noise(self._pos_std),
            position_y=truth.position_y + self._noise(self._pos_std),
            altitude=max(0.0, truth.altitude + self._noise(self._pos_std)),
            velocity=max(0.0, truth.velocity + self._noise(self._vel_std)),
            fault_flags=flags,
        )

    def _noise(self, std: float) -> float:
        if std <= 0.0:
            return 0.0
        return self._rng.gauss(0.0, std)


def position_error(reading: GpsReading, truth: VehicleState) -> float:
    """Convenience for tests: 2D horizontal distance."""

    if not reading.available or reading.position_x is None or reading.position_y is None:
        raise ValueError("position_error called on unavailable reading")
    return math.hypot(reading.position_x - truth.position_x, reading.position_y - truth.position_y)
