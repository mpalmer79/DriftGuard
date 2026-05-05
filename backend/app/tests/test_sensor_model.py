"""Direct unit tests for the SensorModel (Phase 10).

The orchestrator-level tests cover the happy path; these tests pin the
sensor's per-fault output shape so a reader can see, in one place,
exactly what each FaultType does to a reading.
"""

import random

from app.domain.enums import FaultSeverity, FaultType, SensorStatus
from app.domain.models import FaultRecord, VehicleState
from app.simulation.sensors import SensorModel, _intermittent_active


def _state(step: int = 1) -> VehicleState:
    from app.domain.enums import SystemMode

    return VehicleState(
        simulation_id="t",
        step=step,
        timestamp=float(step),
        position_x=0.0,
        position_y=0.0,
        altitude=1000.0,
        velocity=120.0,
        heading=90.0,
        pitch=0.0,
        roll=0.0,
        system_mode=SystemMode.NORMAL,
        last_action=None,
    )


def _fault(ftype: FaultType, **metadata) -> FaultRecord:
    return FaultRecord(
        fault_id="f",
        type=ftype,
        target_component="sensor",
        severity=FaultSeverity.WARNING,
        active=True,
        start_step=0,
        end_step=None,
        metadata=metadata,
    )


def test_no_faults_returns_clean_reading():
    sm = SensorModel(random.Random(0), noise_std=0.0)
    reading = sm.read(_state(), [])
    assert reading.status == SensorStatus.OK
    assert reading.confidence == 1.0
    assert reading.fault_flags == []
    assert reading.altitude == 1000.0


def test_data_loss_invalidates_reading():
    sm = SensorModel(random.Random(0), noise_std=0.0)
    reading = sm.read(_state(), [_fault(FaultType.DATA_LOSS)])
    assert reading.status == SensorStatus.INVALID
    assert reading.confidence == 0.0
    assert "DATA_LOSS" in reading.fault_flags


def test_sensor_drift_accumulates_over_steps():
    sm = SensorModel(random.Random(0), noise_std=0.0)
    f = _fault(FaultType.SENSOR_DRIFT, magnitude=2.0)
    r1 = sm.read(_state(step=1), [f])
    r2 = sm.read(_state(step=2), [f])
    # Accumulator grows each step the fault fires.
    assert r2.altitude > r1.altitude
    assert r1.status == SensorStatus.DEGRADED


def test_sensor_spike_shifts_altitude_by_magnitude():
    sm = SensorModel(random.Random(0), noise_std=0.0)
    reading = sm.read(_state(), [_fault(FaultType.SENSOR_SPIKE, magnitude=80.0)])
    assert reading.altitude == 1080.0
    assert reading.status == SensorStatus.DEGRADED
    assert "SENSOR_SPIKE" in reading.fault_flags


def test_sensor_noise_spike_marks_degraded():
    sm = SensorModel(random.Random(0), noise_std=0.0)
    reading = sm.read(_state(), [_fault(FaultType.SENSOR_NOISE_SPIKE, magnitude=50.0)])
    assert reading.status == SensorStatus.DEGRADED
    assert "SENSOR_NOISE_SPIKE" in reading.fault_flags
    # With a fixed seed and zero base noise the perturbation is non-zero.
    assert reading.altitude != 1000.0


def test_sensor_dropout_with_probability_one_invalidates():
    sm = SensorModel(random.Random(0), noise_std=0.0)
    reading = sm.read(_state(), [_fault(FaultType.SENSOR_DROPOUT, probability=1.0)])
    assert reading.status == SensorStatus.INVALID
    assert reading.confidence == 0.0


def test_sensor_dropout_with_no_probability_metadata_invalidates():
    """Without probability metadata, dropout always fires and invalidates."""
    sm = SensorModel(random.Random(0), noise_std=0.0)
    reading = sm.read(_state(), [_fault(FaultType.SENSOR_DROPOUT)])
    assert reading.status == SensorStatus.INVALID


def test_drift_affected_fields_includes_velocity():
    sm = SensorModel(random.Random(0), noise_std=0.0)
    f = _fault(FaultType.SENSOR_DRIFT, magnitude=4.0, affected_fields=["velocity"])
    reading = sm.read(_state(), [f])
    # When velocity is in affected_fields the drift accumulator shifts it.
    assert reading.velocity != 120.0


def test_non_sensor_target_is_ignored():
    sm = SensorModel(random.Random(0), noise_std=0.0)
    f = FaultRecord(
        fault_id="f",
        type=FaultType.SENSOR_DRIFT,
        target_component="controller_a",  # wrong target
        severity=FaultSeverity.WARNING,
        active=True,
        start_step=0,
        end_step=None,
        metadata={"magnitude": 10.0},
    )
    reading = sm.read(_state(), [f])
    assert reading.status == SensorStatus.OK
    assert reading.fault_flags == []


def test_intermittent_pattern_skips_off_steps():
    f = _fault(FaultType.SENSOR_SPIKE, intermittent_pattern=[0, 1])
    rng = random.Random(0)
    state_step1 = _state(step=0)  # offset 0 -> pattern[0] == 0 -> off
    state_step2 = _state(step=1)  # offset 1 -> pattern[1] == 1 -> on
    assert _intermittent_active(f, state_step1.step, rng) is False
    assert _intermittent_active(f, state_step2.step, rng) is True


def test_intermittent_probability_uses_rng():
    f = _fault(FaultType.SENSOR_SPIKE, probability=0.0)
    assert _intermittent_active(f, 1, random.Random(0)) is False
    f2 = _fault(FaultType.SENSOR_SPIKE, probability=1.0)
    assert _intermittent_active(f2, 1, random.Random(0)) is True


def test_intermittent_default_is_always_on():
    f = _fault(FaultType.SENSOR_SPIKE)  # no metadata
    assert _intermittent_active(f, 0, random.Random(0)) is True
    assert _intermittent_active(f, 999, random.Random(0)) is True


def test_intermittent_invalid_probability_treated_as_active():
    f = _fault(FaultType.SENSOR_SPIKE, probability="not-a-number")
    assert _intermittent_active(f, 0, random.Random(0)) is True


def test_reading_id_is_unique_across_calls():
    sm = SensorModel(random.Random(0), noise_std=0.0)
    a = sm.read(_state(step=1), [])
    b = sm.read(_state(step=2), [])
    assert a.reading_id != b.reading_id
