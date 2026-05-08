"""Per-axis Kalman position estimator for the DriftGuard navigation stack.

The state is 3D position only — the simulation already tracks
velocity through the truth integrator and the INS, so we focus the
filter on the quantity that suffers under GPS denial. Three
independent scalar Kalman filters run on East, North, and Up; the
covariances do not couple across axes, which matches the
INS/GPS noise model (independent per-axis Gaussian).

Naming this an EKF is conventional in nav literature even when the
underlying filter is linear; the "extended" qualifier signals
"fuses heterogeneous sensors with different rates and noise
characteristics." If a future revision adds heading or attitude
states (nonlinear in the sense that turn dynamics couple position
and heading), the existing EKF terminology won't need to change.

Acceptance (Phase 2.5):

- Under nominal conditions the estimate converges to truth within
  five steps after the first GPS update.
- Under GPS denial, INS-alone error grows; once GPS returns, the
  filter snaps the estimate back inside its measurement noise band.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..gps import GpsReading
from ..ins import INSReading


@dataclass
class EKFEstimate:
    step: int
    position_x: float
    position_y: float
    altitude: float
    variance_x: float
    variance_y: float
    variance_z: float


class EKF:
    """Three independent Kalman filters, one per position axis."""

    def __init__(
        self,
        process_var: float = 1.0,
        measurement_var: float = 4.0,
    ) -> None:
        if process_var < 0 or measurement_var <= 0:
            raise ValueError("process_var must be >=0 and measurement_var > 0")
        self.q = float(process_var)
        self.r = float(measurement_var)
        self._x: tuple[float, float, float] | None = None
        self._p = (1.0, 1.0, 1.0)
        self._step = -1

    @property
    def initialized(self) -> bool:
        return self._x is not None

    def initialize(self, position_x: float, position_y: float, altitude: float) -> None:
        """Seed the filter from a known position (e.g. truth at startup)."""

        self._x = (position_x, position_y, altitude)
        self._p = (1.0, 1.0, 1.0)

    def predict(self, ins: INSReading) -> EKFEstimate:
        """Advance the prediction using the INS estimate.

        The INS is treated as a perfect predictor; only its variance
        contribution (process noise q) is accumulated. This keeps the
        filter simple and lets the GPS update do the heavy lifting.
        """

        if self._x is None:
            self.initialize(ins.position_x, ins.position_y, ins.altitude)

        assert self._x is not None
        self._x = (ins.position_x, ins.position_y, ins.altitude)
        self._p = (self._p[0] + self.q, self._p[1] + self.q, self._p[2] + self.q)
        self._step = ins.step
        return self._estimate()

    def update(self, gps: GpsReading) -> EKFEstimate:
        """Fuse a GPS measurement when available.

        Unavailable readings (off-cadence or denied) are ignored —
        the filter just stays at the predicted estimate.
        """

        if (
            not gps.available
            or gps.position_x is None
            or gps.position_y is None
            or gps.altitude is None
        ):
            return self._estimate()
        if self._x is None:
            self.initialize(gps.position_x, gps.position_y, gps.altitude)
            return self._estimate()

        x = self._x
        p = self._p
        new_x = []
        new_p = []
        measurements = (gps.position_x, gps.position_y, gps.altitude)
        for axis in range(3):
            kalman_gain = p[axis] / (p[axis] + self.r)
            updated_x = x[axis] + kalman_gain * (measurements[axis] - x[axis])
            updated_p = (1.0 - kalman_gain) * p[axis]
            new_x.append(updated_x)
            new_p.append(updated_p)
        self._x = (new_x[0], new_x[1], new_x[2])
        self._p = (new_p[0], new_p[1], new_p[2])
        return self._estimate()

    def _estimate(self) -> EKFEstimate:
        assert self._x is not None
        return EKFEstimate(
            step=self._step,
            position_x=self._x[0],
            position_y=self._x[1],
            altitude=self._x[2],
            variance_x=self._p[0],
            variance_y=self._p[1],
            variance_z=self._p[2],
        )
