"""INS sensor tests (Phase 2.3).

Pins the qualitative property that matters most for the EKF story:
without GPS corrections, INS-alone position error grows over time.
Phase 2.5 will add a test that the EKF bounds that growth back down.
"""

import math

import pytest

from app.core.rng import RngService
from app.domain.enums import Action
from app.domain.models import VehicleState
from app.simulation.dynamics.integrator import integrate_action
from app.simulation.ins import INS
from app.simulation.vehicle import initial_state


def _ins(seed: int = 7) -> INS:
    return INS(
        rng=RngService(seed=seed).child("ins"),
        position_noise_std=0.5,
        velocity_noise_std=0.1,
        attitude_noise_std=0.2,
    )


def _step_truth(state: VehicleState, action: Action) -> VehicleState:
    return integrate_action(state, action)


def test_initialize_copies_truth():
    truth = initial_state("t")
    ins = _ins()
    ins.initialize(truth)
    e = ins.estimate
    assert e is not None
    assert e.position_x == truth.position_x
    assert e.altitude == truth.altitude
    assert e.velocity == truth.velocity


def test_update_before_initialize_raises():
    ins = _ins()
    with pytest.raises(RuntimeError):
        ins.update(initial_state("t"))


def test_estimate_stays_close_to_truth_at_low_noise():
    """Near-zero noise: estimate tracks truth tightly."""

    truth = initial_state("t")
    ins = INS(
        rng=RngService(seed=3).child("ins"),
        position_noise_std=0.0,
        velocity_noise_std=0.0,
        attitude_noise_std=0.0,
    )
    ins.initialize(truth)
    for _ in range(10):
        truth = _step_truth(truth, Action.HOLD)
        ins.update(truth)
    e = ins.estimate
    assert e is not None
    assert abs(e.position_x - truth.position_x) < 1e-6
    assert abs(e.altitude - truth.altitude) < 1e-6


def test_position_error_grows_under_gps_denial():
    """Acceptance criterion of Phase 2.4: with GPS denied, INS-alone
    position error grows monotonically (in trend, not strictly
    every step) and stays bounded by something like noise * sqrt(N)
    rather than diverging to infinity in finite steps."""

    truth = initial_state("t")
    ins = _ins(seed=13)
    ins.initialize(truth)

    errors = []
    for _ in range(40):
        truth = _step_truth(truth, Action.HOLD)
        ins.update(truth)
        e = ins.estimate
        assert e is not None
        err = math.hypot(e.position_x - truth.position_x, e.position_y - truth.position_y)
        errors.append(err)

    # Mean error in the back half should exceed the front half: drift,
    # not a tracking estimator.
    front = sum(errors[:20]) / 20
    back = sum(errors[20:]) / 20
    assert back > front

    # And error should not run away: this is bounded random walk, so
    # a generous upper bound holds.
    assert max(errors) < 50.0


def test_correct_resets_position_to_supplied_value():
    truth = initial_state("t")
    ins = _ins()
    ins.initialize(truth)
    for _ in range(5):
        truth = _step_truth(truth, Action.ASCEND)
        ins.update(truth)
    ins.correct(position_x=42.0, position_y=-7.0, altitude=999.0)
    e = ins.estimate
    assert e is not None
    assert e.position_x == 42.0
    assert e.position_y == -7.0
    assert e.altitude == 999.0


def test_two_ins_with_same_seed_produce_identical_estimates():
    """RngService child("ins") + same root seed reproduces."""

    truth = initial_state("t")
    sequences = []
    for _ in range(2):
        ins = _ins(seed=99)
        ins.initialize(truth)
        s = truth
        seq = []
        for _ in range(15):
            s = _step_truth(s, Action.HOLD)
            ins.update(s)
            e = ins.estimate
            assert e is not None
            seq.append((e.position_x, e.position_y, e.altitude))
        sequences.append(seq)
    assert sequences[0] == sequences[1]
