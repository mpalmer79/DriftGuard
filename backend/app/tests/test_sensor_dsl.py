"""Sensor + fault DSL integration tests (Phase 5.5)."""

from app.domain.enums import FaultType
from app.simulation.orchestrator import Simulation


def test_sensor_drift_with_ramp_metadata_grows_over_time():
    """A SENSOR_DRIFT magnitude with a {ramp} term should yield a
    drift accumulator whose growth rate increases as the ramp
    progresses. We compare two simulations: one with a constant
    magnitude, one with a ramp from 0 to that magnitude."""

    constant = Simulation("c", seed=1)
    constant.inject_fault(
        FaultType.SENSOR_DRIFT,
        "sensor",
        start_step=1,
        duration=8,
        metadata={"magnitude": 5.0},
    )
    records_constant = constant.run(8)

    ramped = Simulation("r", seed=1)
    ramped.inject_fault(
        FaultType.SENSOR_DRIFT,
        "sensor",
        start_step=1,
        duration=8,
        metadata={"magnitude": {"ramp": [0, 5.0, 8]}},
    )
    records_ramped = ramped.run(8)

    # Constant drift accumulates 5.0 per step, ramped drift starts at
    # 0 and grows. After the same number of steps the ramped sensor
    # has a *smaller* total drift accumulation, hence a smaller
    # absolute deviation between truth altitude and reading altitude.
    constant_alt_err = abs(records_constant[-1].sensor.altitude - records_constant[-1].state.altitude)
    ramped_alt_err = abs(records_ramped[-1].sensor.altitude - records_ramped[-1].state.altitude)
    assert ramped_alt_err < constant_alt_err


def test_sensor_drift_ramp_at_zero_offset_uses_ramp_start():
    """First step after the fault becomes active should see the ramp
    starting value. Constant magnitude=5 vs ramp [10, 0, 5]: the
    ramp's first step gives ~10 while the constant gives 5."""

    a = Simulation("a", seed=2)
    a.inject_fault(
        FaultType.SENSOR_DRIFT,
        "sensor",
        start_step=1,
        duration=5,
        metadata={"magnitude": 5.0},
    )
    a_first = a.step()

    b = Simulation("b", seed=2)
    b.inject_fault(
        FaultType.SENSOR_DRIFT,
        "sensor",
        start_step=1,
        duration=5,
        metadata={"magnitude": {"ramp": [10.0, 0.0, 5]}},
    )
    b_first = b.step()

    # The constant=5 simulation accumulates +5 in its drift; the
    # ramp=[10,0,5] starts at +10.
    a_drift = a_first.sensor.altitude - a_first.state.altitude
    b_drift = b_first.sensor.altitude - b_first.state.altitude
    assert b_drift > a_drift
