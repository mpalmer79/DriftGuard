"""Direct unit tests for the vehicle kinematics helper (Phase 10).

The orchestrator-level tests cover the nominal happy path; these tests
pin the per-Action effect of `apply_action` so a refactor of the
controller stack can't silently change vehicle dynamics.
"""

import math

from app.domain.enums import Action, SystemMode
from app.simulation.vehicle import apply_action, initial_state


def test_initial_state_defaults():
    s = initial_state("sim-x")
    assert s.simulation_id == "sim-x"
    assert s.step == 0
    assert s.altitude == 1000.0
    assert s.velocity == 120.0
    assert s.heading == 90.0
    assert s.system_mode == SystemMode.NORMAL
    assert s.last_action is None


def test_hold_only_advances_position():
    s0 = initial_state("h")
    s1 = apply_action(s0, Action.HOLD)
    assert s1.altitude == s0.altitude
    assert s1.velocity == s0.velocity
    assert s1.heading == s0.heading
    assert s1.last_action == Action.HOLD
    assert s1.step == 1
    # Heading 90deg -> position advances along +y.
    assert math.isclose(s1.position_y, 120.0, abs_tol=1e-6)
    assert math.isclose(s1.position_x, 0.0, abs_tol=1e-6)


def test_ascend_increases_altitude_and_pitch():
    s0 = initial_state("a")
    s1 = apply_action(s0, Action.ASCEND)
    assert s1.altitude == 1025.0
    assert s1.pitch == 3.0


def test_pitch_clamps_at_15_degrees():
    s = initial_state("a")
    for _ in range(10):
        s = apply_action(s, Action.ASCEND)
    assert s.pitch == 15.0


def test_descend_decreases_altitude_and_pitch():
    s0 = initial_state("d")
    s1 = apply_action(s0, Action.DESCEND)
    assert s1.altitude == 975.0
    assert s1.pitch == -3.0


def test_pitch_clamps_at_negative_15_degrees():
    s = initial_state("d")
    for _ in range(10):
        s = apply_action(s, Action.DESCEND)
    assert s.pitch == -15.0


def test_accelerate_increases_velocity():
    s = apply_action(initial_state("v"), Action.ACCELERATE)
    assert s.velocity == 130.0


def test_decelerate_clamps_at_zero():
    s = initial_state("v")
    # 12 decelerate steps would drive velocity below zero.
    for _ in range(20):
        s = apply_action(s, Action.DECELERATE)
    assert s.velocity == 0.0


def test_altitude_clamps_at_zero():
    s = initial_state("g")
    for _ in range(50):
        s = apply_action(s, Action.DESCEND)
    assert s.altitude == 0.0


def test_turn_left_wraps_heading_modulo_360():
    s = initial_state("t")
    # Heading starts at 90; 19 left turns -> 90 - 95 = -5 -> 355.
    for _ in range(19):
        s = apply_action(s, Action.TURN_LEFT)
    assert math.isclose(s.heading, 355.0, abs_tol=1e-6)
    assert s.roll == -25.0  # clamped at the floor


def test_turn_right_wraps_heading_modulo_360():
    s = initial_state("t")
    for _ in range(60):
        s = apply_action(s, Action.TURN_RIGHT)
    # Each step adds 5 degrees: (90 + 60*5) % 360 = 30
    assert math.isclose(s.heading, 30.0, abs_tol=1e-6)
    assert s.roll == 25.0  # clamped at the ceiling


def test_stabilize_halves_pitch_and_roll():
    s = initial_state("s")
    s = apply_action(s, Action.ASCEND)  # pitch=3, roll=0
    s = apply_action(s, Action.TURN_RIGHT)  # roll=4
    pitch_before = s.pitch
    roll_before = s.roll
    s = apply_action(s, Action.STABILIZE)
    assert math.isclose(s.pitch, pitch_before * 0.5)
    assert math.isclose(s.roll, roll_before * 0.5)


def test_abort_decelerates_and_dampens_attitude():
    s = initial_state("ab")
    s = apply_action(s, Action.ASCEND)  # pitch=3
    pitch_before = s.pitch
    velocity_before = s.velocity
    s = apply_action(s, Action.ABORT)
    assert s.velocity == max(0.0, velocity_before - 20.0)
    assert math.isclose(s.pitch, pitch_before * 0.25)


def test_abort_clamps_velocity_at_zero():
    s = initial_state("ab")
    for _ in range(50):
        s = apply_action(s, Action.ABORT)
    assert s.velocity == 0.0


def test_dt_scales_state_changes():
    s0 = initial_state("dt")
    s1 = apply_action(s0, Action.ASCEND, dt=2.0)
    # Altitude change is 25 * dt = 50.
    assert s1.altitude == 1050.0
    assert s1.timestamp == 2.0


def test_position_advances_with_heading_zero():
    s = initial_state("p")
    s = apply_action(s, Action.TURN_LEFT)  # heading 85
    s = apply_action(s, Action.HOLD)
    # Just sanity: position should have moved forward in the heading direction.
    assert s.position_x != 0.0 or s.position_y != 0.0
