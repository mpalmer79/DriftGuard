"""Unit tests for the 3-DOF dynamics primitives (Phase 2.2).

The functions in ``simulation/dynamics`` are pure, so each gets a
narrow unit test. The Phase 2.1 integrator and the Phase 2.6
mission tests are the integration-level coverage.
"""

import math

import pytest

from app.simulation import dynamics as dyn


def test_wrap_heading_returns_in_range():
    for value, expected in [(0.0, 0.0), (360.0, 0.0), (361.0, 1.0), (-5.0, 355.0), (720.5, 0.5)]:
        assert dyn.wrap_heading(value) == pytest.approx(expected)


def test_step_altitude_respects_ground():
    assert dyn.step_altitude(altitude=10.0, vertical_rate=-100.0, dt=1.0) == 0.0
    assert dyn.step_altitude(altitude=10.0, vertical_rate=5.0, dt=2.0) == pytest.approx(20.0)


def test_step_velocity_floors_at_zero():
    assert dyn.step_velocity(velocity=5.0, accel=-100.0, dt=1.0) == 0.0
    assert dyn.step_velocity(velocity=10.0, accel=2.0, dt=0.5) == pytest.approx(11.0)


def test_step_heading_wraps_through_360():
    assert dyn.step_heading(heading_deg=350.0, turn_rate_deg_s=20.0, dt=1.0) == pytest.approx(10.0)
    assert dyn.step_heading(heading_deg=10.0, turn_rate_deg_s=-20.0, dt=1.0) == pytest.approx(350.0)


def test_step_pitch_first_order_lag_converges():
    pitch = 0.0
    for _ in range(50):
        pitch = dyn.step_pitch(pitch, target_pitch_deg=10.0, lag=0.5, dt=0.1)
    assert pitch == pytest.approx(10.0, abs=0.01)


def test_step_pitch_clamped_to_structural_limits():
    pitch = dyn.step_pitch(0.0, target_pitch_deg=999.0, lag=0.0, dt=0.1)
    assert pitch == pytest.approx(dyn.MAX_PITCH_DEG)
    pitch = dyn.step_pitch(0.0, target_pitch_deg=-999.0, lag=0.0, dt=0.1)
    assert pitch == pytest.approx(-dyn.MAX_PITCH_DEG)


def test_step_roll_clamped_to_structural_limits():
    roll = dyn.step_roll(0.0, target_roll_deg=999.0, lag=0.0, dt=0.1)
    assert roll == pytest.approx(dyn.MAX_ROLL_DEG)


def test_horizontal_displacement_east_and_north():
    # heading 0 is east; heading 90 is north.
    dx, dy = dyn.horizontal_displacement(velocity=10.0, heading_deg=0.0, dt=1.0)
    assert dx == pytest.approx(10.0)
    assert dy == pytest.approx(0.0, abs=1e-9)

    dx, dy = dyn.horizontal_displacement(velocity=10.0, heading_deg=90.0, dt=1.0)
    assert dx == pytest.approx(0.0, abs=1e-9)
    assert dy == pytest.approx(10.0)


def test_horizontal_displacement_north_east_diagonal():
    dx, dy = dyn.horizontal_displacement(velocity=10.0, heading_deg=45.0, dt=1.0)
    assert dx == pytest.approx(10.0 * math.cos(math.pi / 4))
    assert dy == pytest.approx(10.0 * math.sin(math.pi / 4))


def test_clamp_helper():
    assert dyn.clamp(5.0, 0.0, 10.0) == 5.0
    assert dyn.clamp(-1.0, 0.0, 10.0) == 0.0
    assert dyn.clamp(99.0, 0.0, 10.0) == 10.0
