"""Unit tests for NavigationPipeline (Phase 1.2).

Covers the three properties ADR 0010 commits to:
- pipeline-converges-without-faults
- gps-dropout-still-produces-estimate
- sensor-fault-flag-propagates

Plus a few nuts-and-bolts checks (initialisation, output shape,
to_sensor_reading projection).

The pipeline-on-orchestrator integration tests live in PR 1.3, when
`navigation_pipeline_enabled` flips to True. Today the flag is off
and these tests exercise the module directly.
"""

import random

from app.core.rng import RngService
from app.domain.enums import FaultSeverity, FaultType, SensorStatus, SystemMode
from app.domain.models import FaultRecord, VehicleState
from app.simulation.navigation import NavigationOutput, NavigationPipeline


def _state(step: int = 1) -> VehicleState:
    return VehicleState(
        simulation_id="t",
        step=step,
        timestamp=float(step),
        position_x=float(step) * 10.0,
        position_y=float(step) * 5.0,
        altitude=1000.0,
        velocity=120.0,
        heading=90.0,
        pitch=0.0,
        roll=0.0,
        system_mode=SystemMode.NORMAL,
        last_action=None,
    )


def _fault(ftype: FaultType, target: str, **metadata) -> FaultRecord:
    return FaultRecord(
        fault_id="f",
        type=ftype,
        target_component=target,
        severity=FaultSeverity.WARNING,
        active=True,
        start_step=0,
        end_step=None,
        metadata=metadata,
    )


def _pipeline(seed: int = 7) -> NavigationPipeline:
    rng = RngService(seed)
    return NavigationPipeline(
        sensor_rng=rng.child("sensor"),
        ins_rng=rng.child("ins"),
        gps_rng=rng.child("gps"),
        sensor_noise_std=0.1,
    )


def test_first_step_initialises_and_returns_output():
    pipeline = _pipeline()
    out = pipeline.step(_state(step=0), [])
    assert isinstance(out, NavigationOutput)
    assert out.step == 0
    # Initialisation seeds INS and EKF from truth, so step-0 estimate
    # should be very close to truth even before any GPS update.
    assert abs(out.altitude - 1000.0) < 1.0


def test_pipeline_converges_to_truth_without_faults():
    """Acceptance #1 from ADR 0010 — clean run converges quickly."""

    pipeline = _pipeline()
    # Run 12 steps with no faults; let the EKF pick up GPS updates.
    last = None
    for step in range(12):
        last = pipeline.step(_state(step=step), [])
    assert last is not None
    # After convergence the EKF altitude should track truth (1000) to
    # within a metre even with INS noise integrated in.
    assert abs(last.altitude - 1000.0) < 2.0
    # Variances should be bounded (EKF gain shrinks them).
    assert last.variance_z < 5.0
    assert last.status == SensorStatus.OK


def test_gps_denial_produces_output_with_degraded_status():
    """Acceptance #2 from ADR 0010 — GPS-denied still yields an estimate."""

    pipeline = _pipeline()
    # Warm up with a couple of clean steps so the filter is initialised.
    pipeline.step(_state(step=0), [])
    pipeline.step(_state(step=1), [])

    gps_denied = _fault(FaultType.GPS_DENIED, "gps")
    out = pipeline.step(_state(step=2), [gps_denied])

    # Pipeline still produces output (no exception, finite values).
    assert out.altitude == out.altitude  # not NaN
    # Status degraded by GPS denial, fault flag carried through.
    assert out.status == SensorStatus.DEGRADED
    assert "GPS_DENIED" in out.fault_flags
    # Confidence pulled down by the GPS denial.
    assert out.confidence <= 0.6


def test_sensor_drift_fault_flag_propagates():
    """Acceptance #3 from ADR 0010 — sensor faults surface in the output."""

    pipeline = _pipeline()
    pipeline.step(_state(step=0), [])  # warmup
    drift = _fault(FaultType.SENSOR_DRIFT, "sensor", magnitude=5.0)
    out = pipeline.step(_state(step=1), [drift])
    assert "SENSOR_DRIFT" in out.fault_flags
    assert out.status == SensorStatus.DEGRADED


def test_sensor_dropout_invalidates_through_pipeline():
    pipeline = _pipeline()
    pipeline.step(_state(step=0), [])  # warmup
    dropout = _fault(FaultType.DATA_LOSS, "sensor")
    out = pipeline.step(_state(step=1), [dropout])
    # DATA_LOSS goes INVALID at the SensorModel boundary; the pipeline
    # carries that through without "upgrading" it.
    assert out.status == SensorStatus.INVALID
    assert out.confidence == 0.0


def test_to_sensor_reading_projection_drops_pipeline_extras():
    pipeline = _pipeline()
    out = pipeline.step(_state(step=0), [])
    reading = out.to_sensor_reading()
    # Same shape as a SensorReading; pipeline-specific fields are
    # not present on the projection.
    assert reading.altitude == out.altitude
    assert reading.confidence == out.confidence
    assert reading.fault_flags == out.fault_flags
    assert not hasattr(reading, "variance_x")


def test_pipeline_is_deterministic_under_same_seed():
    a = _pipeline(seed=11)
    b = _pipeline(seed=11)
    out_a = [a.step(_state(step=s), []) for s in range(5)]
    out_b = [b.step(_state(step=s), []) for s in range(5)]
    for x, y in zip(out_a, out_b, strict=True):
        assert x.altitude == y.altitude
        assert x.position_x == y.position_x
        assert x.variance_z == y.variance_z


def test_default_config_keeps_pipeline_disabled():
    """Sanity: PR 1.2 keeps the flag off; PR 1.3 flips it."""

    from app.core.config import DEFAULT_CONFIG

    assert DEFAULT_CONFIG.navigation_pipeline_enabled is False


def test_pipeline_constructible_with_plain_random():
    """The orchestrator wires this with RngService.child(); verify a
    plain random.Random also works for ad-hoc construction."""

    pipeline = NavigationPipeline(
        sensor_rng=random.Random(0),
        ins_rng=random.Random(1),
        gps_rng=random.Random(2),
    )
    out = pipeline.step(_state(step=0), [])
    assert out.step == 0
