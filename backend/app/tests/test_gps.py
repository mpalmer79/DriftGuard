"""GPS sensor tests (Phase 2.4)."""

import pytest

from app.core.rng import RngService
from app.domain.enums import FaultSeverity, FaultType
from app.domain.models import FaultRecord
from app.simulation.gps import GPS, position_error
from app.simulation.vehicle import initial_state


def _gps(seed: int = 5, rate: int = 5) -> GPS:
    return GPS(
        rng=RngService(seed=seed).child("gps"),
        update_rate_steps=rate,
        position_noise_std=1.0,
        velocity_noise_std=0.2,
    )


def test_gps_only_emits_on_cadence():
    gps = _gps(rate=5)
    truth = initial_state("t")
    available_steps = []
    for step in range(20):
        truth = type(truth)(**{**truth.__dict__, "step": step})
        r = gps.read(truth, [])
        if r.available:
            available_steps.append(step)
    assert available_steps == [0, 5, 10, 15]


def test_gps_reading_is_close_to_truth_at_low_noise():
    gps = GPS(
        rng=RngService(seed=1).child("gps"),
        update_rate_steps=1,
        position_noise_std=0.0,
        velocity_noise_std=0.0,
    )
    truth = type(initial_state("t"))(**{**initial_state("t").__dict__, "step": 1})
    r = gps.read(truth, [])
    assert r.available
    assert position_error(r, truth) == 0.0


def test_gps_denied_fault_marks_unavailable():
    gps = _gps(rate=1)
    truth = type(initial_state("t"))(**{**initial_state("t").__dict__, "step": 5})
    fault = FaultRecord(
        fault_id="f",
        type=FaultType.GPS_DENIED,
        target_component="gps",
        severity=FaultSeverity.WARNING,
        active=True,
        start_step=0,
        end_step=10,
        metadata={},
    )
    r = gps.read(truth, [fault])
    assert not r.available
    assert FaultType.GPS_DENIED.value in r.fault_flags


def test_gps_other_target_does_not_affect_gps():
    gps = _gps(rate=1)
    truth = type(initial_state("t"))(**{**initial_state("t").__dict__, "step": 5})
    fault = FaultRecord(
        fault_id="f",
        type=FaultType.SENSOR_DRIFT,
        target_component="sensor",  # different target
        severity=FaultSeverity.WARNING,
        active=True,
        start_step=0,
        end_step=10,
        metadata={},
    )
    r = gps.read(truth, [fault])
    assert r.available


def test_invalid_rate_rejected():
    with pytest.raises(ValueError):
        GPS(rng=RngService(seed=0).child("gps"), update_rate_steps=0)


def test_two_gps_with_same_seed_produce_identical_streams():
    truth = type(initial_state("t"))(**{**initial_state("t").__dict__, "step": 5})
    a = _gps(seed=42, rate=1).read(truth, [])
    b = _gps(seed=42, rate=1).read(truth, [])
    assert a.position_x == b.position_x
    assert a.position_y == b.position_y
    assert a.altitude == b.altitude
