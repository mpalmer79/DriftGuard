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


def test_default_config_enables_pipeline():
    """Phase 1.3: the navigation pipeline is the live data path.

    Flipping the flag to False reverts to the legacy direct-
    `SensorModel` feed, which remains supported for the unit-test
    baseline that pins `SensorModel` behaviour directly.
    """

    from app.core.config import DEFAULT_CONFIG

    assert DEFAULT_CONFIG.navigation_pipeline_enabled is True


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


# --- Phase 1.3 integration tests (ADR 0010 acceptance criteria) ---


def test_orchestrator_uses_pipeline_by_default():
    """The orchestrator's `sensor` field on every StepRecord now comes
    from the EKF-smoothed pipeline output, not the bare SensorModel."""

    from app.simulation.orchestrator import Simulation

    sim = Simulation("default-pipeline", seed=11)
    record = sim.step()
    # `sensor` is a SensorReading projected from NavigationOutput; the
    # legacy field shape is preserved.
    assert record.sensor.altitude > 0
    # NavigationPipeline is initialised on construction.
    assert sim.navigation is not None


def test_gps_denial_recovery_through_orchestrator():
    """ADR 0010 acceptance #2 — INS-only drift visible in EKF variance,
    recovery on GPS return.

    Inject GPS_DENIED for a window in the middle of a run. The EKF
    altitude variance should grow during the denial (no measurement
    correction) and shrink again once GPS is back online.
    """

    from app.domain.enums import FaultType
    from app.simulation.orchestrator import Simulation

    sim = Simulation("gps-denial", seed=7)
    sim.inject_fault(
        FaultType.GPS_DENIED,
        "gps",
        start_step=6,
        duration=8,
    )
    # Warm up before denial
    for _ in range(5):
        sim.step()
    var_before = sim.navigation._ekf._p[2]
    # During denial
    for _ in range(8):
        sim.step()
    var_during = sim.navigation._ekf._p[2]
    # After GPS returns
    for _ in range(8):
        sim.step()
    var_after = sim.navigation._ekf._p[2]

    # Variance grows with no GPS aiding...
    assert var_during > var_before, (
        f"EKF altitude variance should grow under GPS denial; "
        f"before={var_before:.3f} during={var_during:.3f}"
    )
    # ...and shrinks again once GPS returns.
    assert var_after < var_during, (
        f"EKF altitude variance should shrink after GPS recovery; "
        f"during={var_during:.3f} after={var_after:.3f}"
    )


def test_sensor_spike_attenuated_by_ekf_across_window():
    """ADR 0010 acceptance #2 — a multi-step sensor spike is attenuated
    by the EKF before it reaches the controller, on the GPS-update
    steps that fall inside the spike window.

    Note: the EKF's `predict()` snaps to the INS estimate (no
    process-only smoothing) — so a single-step spike between GPS
    updates passes through. The Kalman pull-back happens on
    GPS-update steps. We span the GPS cadence (every 5 steps) so
    the window contains at least one GPS-aided step.
    """

    from dataclasses import replace

    from app.core.config import DEFAULT_CONFIG
    from app.domain.enums import FaultType
    from app.simulation.orchestrator import Simulation

    legacy_cfg = replace(DEFAULT_CONFIG, navigation_pipeline_enabled=False)

    def _altitudes_during_spike(config) -> list[float]:
        sim = Simulation("spike", seed=17, config=config)
        # Warm up so the EKF / TrustDetector are out of cold-start.
        for _ in range(8):
            sim.step()
        sim.inject_fault(
            FaultType.SENSOR_SPIKE,
            "sensor",
            start_step=sim.state.step + 1,
            duration=6,
            metadata={"magnitude": 100.0},
        )
        return [sim.step().sensor.altitude for _ in range(6)]

    legacy_alts = _altitudes_during_spike(legacy_cfg)
    smoothed_alts = _altitudes_during_spike(DEFAULT_CONFIG)

    # Mean controller-facing altitude excess across the spike window.
    legacy_mean = sum(abs(a - 1000.0) for a in legacy_alts) / len(legacy_alts)
    smoothed_mean = sum(abs(a - 1000.0) for a in smoothed_alts) / len(smoothed_alts)
    assert smoothed_mean < legacy_mean, (
        f"EKF should attenuate the spike on average across the window; "
        f"legacy={legacy_mean:.2f} smoothed={smoothed_mean:.2f}"
    )
    # On at least one step in the middle of the window (where a GPS
    # measurement has had a chance to pull the EKF estimate back),
    # the pipeline's altitude must be visibly closer to truth than
    # the legacy path's altitude on the same step. We compare per-step
    # rather than overall min because the legacy path also converges
    # near the end of the window via safe-mode action restriction —
    # that is not the EKF property we care about pinning here.
    middle = list(zip(legacy_alts[2:5], smoothed_alts[2:5], strict=True))
    assert any(
        abs(smoothed - 1000.0) < abs(legacy - 1000.0) * 0.7 for legacy, smoothed in middle
    ), f"EKF did not pull the spike back on any GPS-aided step: middle={middle}"
