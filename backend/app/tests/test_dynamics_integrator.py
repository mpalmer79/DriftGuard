"""Tests for the continuous-time integrator (Phase 2.1)."""

import pytest

from app.domain.enums import Action, SystemMode
from app.domain.models import VehicleState
from app.simulation.dynamics import integrator
from app.simulation.dynamics.integrator import command_for, integrate_action


def _state(**overrides) -> VehicleState:
    base = VehicleState(
        simulation_id="t",
        step=0,
        timestamp=0.0,
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
    return base.__class__(**{**base.__dict__, **overrides})


def test_command_for_known_actions():
    assert command_for(Action.ASCEND)["vertical_rate"] > 0
    assert command_for(Action.DESCEND)["vertical_rate"] < 0
    assert command_for(Action.ACCELERATE)["forward_accel"] > 0
    assert command_for(Action.TURN_RIGHT)["turn_rate"] > 0
    assert command_for(Action.TURN_LEFT)["turn_rate"] < 0
    assert command_for(Action.HOLD) == {}


def test_integrate_action_advances_step_and_time():
    s = _state()
    out = integrate_action(s, Action.HOLD, dt_total=1.0, substeps=10)
    assert out.step == 1
    assert out.timestamp == pytest.approx(1.0)
    assert out.last_action == Action.HOLD


def test_integrate_action_ascend_increases_altitude():
    s = _state(altitude=1000.0)
    out = integrate_action(s, Action.ASCEND)
    assert out.altitude > s.altitude


def test_integrate_action_descend_decreases_altitude():
    s = _state(altitude=1000.0)
    out = integrate_action(s, Action.DESCEND)
    assert out.altitude < s.altitude


def test_integrate_pitch_lags_to_command():
    """First-order lag means a single 1-second step does not reach
    the commanded pitch instantly."""

    s = _state(pitch=0.0)
    out = integrate_action(s, Action.ASCEND)
    assert 0.0 < out.pitch < 10.0


def test_integrate_pitch_converges_over_many_steps():
    s = _state(pitch=0.0)
    for _ in range(20):
        s = integrate_action(s, Action.ASCEND)
    # Pitch is clamped at MAX_PITCH_DEG (15); ascend command is +10
    assert s.pitch == pytest.approx(10.0, abs=0.5)


def test_integrate_action_holds_position_when_velocity_zero():
    s = _state(velocity=0.0)
    out = integrate_action(s, Action.HOLD)
    assert out.position_x == s.position_x
    assert out.position_y == s.position_y


def test_integrate_action_substep_count_affects_smoothness_not_endpoint():
    """Endpoint is approximately the same regardless of substep count
    for a HOLD command (no nonlinear dynamics in this case)."""

    s = _state()
    a = integrate_action(s, Action.HOLD, dt_total=1.0, substeps=1)
    b = integrate_action(s, Action.HOLD, dt_total=1.0, substeps=10)
    assert a.position_x == pytest.approx(b.position_x, abs=1e-6)
    assert a.altitude == pytest.approx(b.altitude, abs=1e-6)


def test_integrate_action_invalid_substeps_raises():
    with pytest.raises(ValueError):
        integrate_action(_state(), Action.HOLD, substeps=0)


def test_integrate_action_does_not_mutate_input():
    s = _state(altitude=1000.0)
    integrate_action(s, Action.ASCEND)
    assert s.altitude == 1000.0
    assert s.step == 0


def test_pitch_lag_constant_is_documented():
    """Sanity: the lag constant exists and is positive."""

    assert integrator.PITCH_LAG_S > 0.0
    assert integrator.ROLL_LAG_S > 0.0
