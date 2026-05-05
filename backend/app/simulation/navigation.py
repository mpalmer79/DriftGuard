"""Navigation pipeline that fuses INS, GPS, and an EKF.

This module wires the previously-side-module navigation stack into a
single object the orchestrator can drop in place of the bare
`SensorModel` feed. See ADR 0010 for the policy decisions, in
particular: sensor-target faults are applied to the **inputs** of
the pipeline (the INS measurement), not the EKF output, so existing
sensor-fault tests retain their meaning.

The pipeline is opt-in behind `SimulationConfig.navigation_pipeline_enabled`
(default `False` in PR 1.2; flipped on in PR 1.3 with explicit
loosening on the affected orchestrator-level tolerances).
"""

from __future__ import annotations

import random
from collections.abc import Iterable
from dataclasses import dataclass, field, replace

from ..core.ids import reading_id as _new_reading_id
from ..domain.enums import SensorStatus
from ..domain.models import FaultRecord, SensorReading, VehicleState
from .filtering import EKF
from .gps import GPS
from .ins import INS
from .sensors import SensorModel


@dataclass
class NavigationOutput:
    """Pipeline output, controller-facing.

    Mirrors `SensorReading` so the orchestrator can pass it straight
    to controllers, plus a small set of pipeline-specific extras
    (position estimate + EKF variances) for observability and the
    mission report.
    """

    reading_id: str
    step: int
    altitude: float
    velocity: float
    heading: float
    pitch: float
    roll: float
    confidence: float
    status: SensorStatus
    fault_flags: list[str] = field(default_factory=list)
    position_x: float = 0.0
    position_y: float = 0.0
    variance_x: float = 0.0
    variance_y: float = 0.0
    variance_z: float = 0.0

    def to_sensor_reading(self) -> SensorReading:
        """Lossy projection back to the legacy `SensorReading` shape."""

        return SensorReading(
            reading_id=self.reading_id,
            step=self.step,
            altitude=self.altitude,
            velocity=self.velocity,
            heading=self.heading,
            pitch=self.pitch,
            roll=self.roll,
            confidence=self.confidence,
            status=self.status,
            fault_flags=list(self.fault_flags),
        )


class NavigationPipeline:
    """INS + GPS + EKF fusion stack.

    Per-step contract: given the truth `VehicleState` and the set of
    active faults, return a `NavigationOutput` whose attitude /
    velocity / heading come from the (fault-perturbed) INS estimate
    and whose altitude + position come from the EKF.
    """

    def __init__(
        self,
        sensor_rng: random.Random,
        ins_rng: random.Random,
        gps_rng: random.Random,
        sensor_noise_std: float = 0.5,
    ) -> None:
        self._sensor = SensorModel(rng=sensor_rng, noise_std=sensor_noise_std)
        self._ins = INS(rng=ins_rng)
        self._gps = GPS(rng=gps_rng)
        self._ekf = EKF()
        self._initialized = False

    def step(
        self,
        truth: VehicleState,
        active_faults: Iterable[FaultRecord],
    ) -> NavigationOutput:
        faults = list(active_faults)

        if not self._initialized:
            self._ins.initialize(truth)
            self._ekf.initialize(truth.position_x, truth.position_y, truth.altitude)
            self._initialized = True

        # Apply sensor-target faults to the truth-derived measurement
        # *before* it reaches the INS. This is the policy from ADR 0010:
        # faults inject onto the raw measurement, not onto the filtered
        # output, so a SENSOR_DRIFT still drifts what the INS observes.
        raw = self._sensor.read(truth, faults)
        perturbed_truth = replace(
            truth,
            altitude=raw.altitude,
            velocity=raw.velocity,
            heading=raw.heading,
            pitch=raw.pitch,
            roll=raw.roll,
        )

        ins_est = self._ins.update(perturbed_truth)
        gps_read = self._gps.read(truth, faults)

        ekf_est = self._ekf.predict(ins_est)
        if gps_read.available:
            ekf_est = self._ekf.update(gps_read)
            # Snap the INS back toward the GPS-anchored estimate so its
            # drift doesn't compound across steps.
            self._ins.correct(ekf_est.position_x, ekf_est.position_y, ekf_est.altitude)

        # Status / confidence derive from the worst of (sensor, GPS).
        status = raw.status
        confidence = raw.confidence
        if not gps_read.available and gps_read.fault_flags:
            # Active GPS denial: degrade unless the sensor channel has
            # already gone INVALID (in which case the worst wins).
            if status == SensorStatus.OK:
                status = SensorStatus.DEGRADED
            confidence = min(confidence, 0.6)

        flags = list(raw.fault_flags)
        for f in gps_read.fault_flags:
            if f not in flags:
                flags.append(f)

        return NavigationOutput(
            reading_id=_new_reading_id(),
            step=truth.step,
            altitude=ekf_est.altitude,
            velocity=ins_est.velocity,
            heading=ins_est.heading,
            pitch=ins_est.pitch,
            roll=ins_est.roll,
            confidence=round(confidence, 4),
            status=status,
            fault_flags=flags,
            position_x=ekf_est.position_x,
            position_y=ekf_est.position_y,
            variance_x=ekf_est.variance_x,
            variance_y=ekf_est.variance_y,
            variance_z=ekf_est.variance_z,
        )
