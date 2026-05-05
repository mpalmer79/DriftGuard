"""EKF tests (Phase 2.5).

The two acceptance criteria:

1. Under nominal conditions the estimate converges to truth within
   five steps. We verify this by running a no-fault scenario and
   asserting the EKF position error after the first GPS update is
   inside the measurement noise band.
2. With GPS denied, INS-alone position error grows monotonically;
   once GPS returns, the EKF snaps back. We verify this with an
   explicit denial window.
"""

import math

import pytest

from app.core.rng import RngService
from app.domain.enums import Action, FaultSeverity, FaultType
from app.domain.models import FaultRecord
from app.simulation.dynamics.integrator import integrate_action
from app.simulation.filtering import EKF
from app.simulation.gps import GPS
from app.simulation.ins import INS
from app.simulation.vehicle import initial_state


def _stack(seed: int = 21) -> tuple[INS, GPS, EKF]:
    rng = RngService(seed=seed)
    ins = INS(
        rng=rng.child("ins"),
        position_noise_std=0.5,
        velocity_noise_std=0.1,
        attitude_noise_std=0.1,
    )
    gps = GPS(
        rng=rng.child("gps"),
        update_rate_steps=5,
        position_noise_std=2.0,
        velocity_noise_std=0.5,
    )
    ekf = EKF(process_var=1.0, measurement_var=4.0)
    return ins, gps, ekf


def _truth_step(state, action: Action):
    return integrate_action(state, action)


def test_initialize_seeds_filter():
    ekf = EKF()
    assert not ekf.initialized
    ekf.initialize(1.0, 2.0, 3.0)
    assert ekf.initialized


def test_invalid_construction_rejected():
    with pytest.raises(ValueError):
        EKF(process_var=-1.0)
    with pytest.raises(ValueError):
        EKF(measurement_var=0.0)


def test_ekf_converges_within_five_steps_under_nominal():
    """Acceptance: the EKF tracks truth tightly once GPS contributes."""

    truth = initial_state("e")
    ins, gps, ekf = _stack(seed=33)
    ins.initialize(truth)
    ekf.initialize(truth.position_x, truth.position_y, truth.altitude)

    # Run five steps; first GPS update lands at step 5 (rate=5).
    for _ in range(5):
        truth = _truth_step(truth, Action.HOLD)
        ins_reading = ins.update(truth)
        ekf.predict(ins_reading)
        gps_reading = gps.read(truth, [])
        estimate = ekf.update(gps_reading)

    err = math.hypot(estimate.position_x - truth.position_x, estimate.position_y - truth.position_y)
    # Measurement noise std is 2.0 per axis; converged estimate should
    # land inside ~3 sigma. Generous bound for CI stability.
    assert err < 8.0


def test_gps_denial_grows_error_then_recovery_snaps_back():
    """Acceptance: under GPS_DENIED the INS-alone error grows, and a
    single post-denial GPS update brings the EKF back inside the
    measurement noise band."""

    truth = initial_state("d")
    ins, gps, ekf = _stack(seed=44)
    ins.initialize(truth)
    ekf.initialize(truth.position_x, truth.position_y, truth.altitude)

    denied = FaultRecord(
        fault_id="f",
        type=FaultType.GPS_DENIED,
        target_component="gps",
        severity=FaultSeverity.WARNING,
        active=True,
        start_step=2,
        end_step=20,
        metadata={},
    )

    errors_during_denial: list[float] = []
    for step in range(20):
        truth = _truth_step(truth, Action.HOLD)
        ins_reading = ins.update(truth)
        ekf.predict(ins_reading)
        active = [denied] if denied.start_step <= step < (denied.end_step or 0) else []
        gps_reading = gps.read(truth, active)
        est = ekf.update(gps_reading)
        if active:
            errors_during_denial.append(
                math.hypot(est.position_x - truth.position_x, est.position_y - truth.position_y)
            )

    # Error in the second half of denial > error in the first half.
    half = len(errors_during_denial) // 2
    front = sum(errors_during_denial[:half]) / max(1, half)
    back = sum(errors_during_denial[half:]) / max(1, len(errors_during_denial) - half)
    assert back > front

    # Recovery: take a few more steps with GPS available.
    for _ in range(5):
        truth = _truth_step(truth, Action.HOLD)
        ins_reading = ins.update(truth)
        ekf.predict(ins_reading)
        est = ekf.update(gps.read(truth, []))

    err_after_recovery = math.hypot(
        est.position_x - truth.position_x, est.position_y - truth.position_y
    )
    # Recovered estimate is within ~3 sigma of truth.
    assert err_after_recovery < 8.0


def test_ekf_ignores_unavailable_gps_readings():
    """An off-cadence read should not change the estimate."""

    truth = initial_state("u")
    ins, gps, ekf = _stack(seed=11)
    ins.initialize(truth)
    ekf.initialize(truth.position_x, truth.position_y, truth.altitude)

    truth = _truth_step(truth, Action.HOLD)
    ins_reading = ins.update(truth)
    predicted = ekf.predict(ins_reading)

    # Step 1 is off-cadence (rate = 5).
    unavailable = gps.read(truth, [])
    assert not unavailable.available

    after_update = ekf.update(unavailable)
    assert after_update.position_x == predicted.position_x
    assert after_update.position_y == predicted.position_y


def test_two_runs_with_same_seed_produce_identical_estimates():
    """Determinism still holds for the full INS/GPS/EKF stack."""

    def run() -> list[tuple[float, float]]:
        truth = initial_state("d")
        ins, gps, ekf = _stack(seed=77)
        ins.initialize(truth)
        ekf.initialize(truth.position_x, truth.position_y, truth.altitude)
        out: list[tuple[float, float]] = []
        for _ in range(10):
            truth = _truth_step(truth, Action.HOLD)
            ekf.predict(ins.update(truth))
            est = ekf.update(gps.read(truth, []))
            out.append((est.position_x, est.position_y))
        return out

    assert run() == run()
