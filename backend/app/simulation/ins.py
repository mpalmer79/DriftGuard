"""INS sensor model.

A simplified inertial navigation system. Each step it observes the
"true" delta in position/velocity/attitude and integrates a noisy
version into its own state estimate. Without GPS corrections, the
noise integrates, so the estimate drifts away from truth — the
property an EKF (Phase 2.5) corrects against a slower GPS update.

The model is intentionally low-fidelity: a real INS measures
specific force and angular rate from accelerometers and gyros, with
biases that are themselves random walks. We collapse all of that
into per-step Gaussian noise on the integrated quantities. The
result still demonstrates the qualitative behavior — error grows
without bound under GPS denial — which is what Phase 2's acceptance
criteria require.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from ..domain.models import VehicleState


@dataclass
class INSReading:
    step: int
    position_x: float
    position_y: float
    altitude: float
    velocity: float
    heading: float
    pitch: float
    roll: float


class INS:
    """Simplified inertial navigator.

    Holds its own integrated state. Pass an RNG (per ADR 0006:
    `RngService.child("ins")`) and small per-axis noise standard
    deviations.
    """

    def __init__(
        self,
        rng: random.Random,
        position_noise_std: float = 0.05,
        velocity_noise_std: float = 0.02,
        attitude_noise_std: float = 0.05,
    ) -> None:
        self._rng = rng
        self._pos_std = position_noise_std
        self._vel_std = velocity_noise_std
        self._att_std = attitude_noise_std
        self._initialized = False
        self._prev_truth: VehicleState | None = None
        self.estimate: INSReading | None = None

    def initialize(self, truth: VehicleState) -> None:
        """Seed the INS estimate from a known truth state.

        In a real system this corresponds to a GPS-aided alignment
        before the mission starts.
        """

        self.estimate = INSReading(
            step=truth.step,
            position_x=truth.position_x,
            position_y=truth.position_y,
            altitude=truth.altitude,
            velocity=truth.velocity,
            heading=truth.heading,
            pitch=truth.pitch,
            roll=truth.roll,
        )
        self._prev_truth = truth
        self._initialized = True

    def update(self, truth: VehicleState) -> INSReading:
        """Advance the INS estimate using noisy increments from truth.

        The deltas come from the ground-truth integrator; noise is
        added to each, then accumulated into the internal estimate.
        Calling ``update`` before ``initialize`` raises.
        """

        if not self._initialized or self.estimate is None or self._prev_truth is None:
            raise RuntimeError("INS.update called before initialize")

        prev = self._prev_truth
        d_x = truth.position_x - prev.position_x + self._noise(self._pos_std)
        d_y = truth.position_y - prev.position_y + self._noise(self._pos_std)
        d_alt = truth.altitude - prev.altitude + self._noise(self._pos_std)
        d_vel = truth.velocity - prev.velocity + self._noise(self._vel_std)
        d_hdg = truth.heading - prev.heading + self._noise(self._att_std)
        d_pit = truth.pitch - prev.pitch + self._noise(self._att_std)
        d_rol = truth.roll - prev.roll + self._noise(self._att_std)

        e = self.estimate
        self.estimate = INSReading(
            step=truth.step,
            position_x=e.position_x + d_x,
            position_y=e.position_y + d_y,
            altitude=max(0.0, e.altitude + d_alt),
            velocity=max(0.0, e.velocity + d_vel),
            heading=(e.heading + d_hdg) % 360.0,
            pitch=e.pitch + d_pit,
            roll=e.roll + d_rol,
        )
        self._prev_truth = truth
        return self.estimate

    def correct(self, position_x: float, position_y: float, altitude: float) -> None:
        """Inject a position correction (e.g. from GPS or an EKF).

        The INS estimate is shifted to the supplied position; velocity
        and attitude are not modified. This keeps the model simple
        but still demonstrates the GPS-aided drift reset.
        """

        if self.estimate is None:
            return
        self.estimate = INSReading(
            step=self.estimate.step,
            position_x=position_x,
            position_y=position_y,
            altitude=altitude,
            velocity=self.estimate.velocity,
            heading=self.estimate.heading,
            pitch=self.estimate.pitch,
            roll=self.estimate.roll,
        )

    def _noise(self, std: float) -> float:
        if std <= 0.0:
            return 0.0
        return self._rng.gauss(0.0, std)
