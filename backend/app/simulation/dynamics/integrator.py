"""Continuous-time integrator for the vehicle state.

The legacy ``apply_action`` in ``simulation/vehicle.py`` is a single
discrete kinematic update per simulation step. This integrator
runs the same update at a finer sub-step (default: 10 substeps of
0.1s) so the resulting trajectory is closer to a continuous-time
solution and the attitude lag is observable.

Actions are translated into commanded states (vertical rate, target
pitch, etc.); the dynamics primitives drive the state toward those
commands across the substeps.

The integrator is opt-in. ``Simulation`` can request it via a
config flag; existing scenarios keep using the legacy path so the
98 baseline tests continue to pass.
"""

from __future__ import annotations

from dataclasses import replace

from ...domain.enums import Action
from ...domain.models import VehicleState
from . import (
    MAX_FORWARD_ACCEL,
    MAX_TURN_RATE,
    MAX_VERTICAL_RATE,
    horizontal_displacement,
    step_altitude,
    step_heading,
    step_pitch,
    step_roll,
    step_velocity,
)

# Time constants for first-order lag on attitude. Smaller → faster
# response. The values are tuned so that the legacy "1-second step"
# trajectories still look reasonable when the integrator is enabled.
PITCH_LAG_S = 0.5
ROLL_LAG_S = 0.4


def command_for(action: Action) -> dict:
    """Translate an Action enum into a commanded-state dict.

    Each command has up to four entries:

    - ``vertical_rate``: m/s, positive up
    - ``forward_accel``: m/s^2
    - ``turn_rate``: deg/s, positive = right (clockwise from above)
    - ``target_pitch`` / ``target_roll``: deg, structural limits
      enforced inside the integrator
    """

    if action == Action.ASCEND:
        return {"vertical_rate": MAX_VERTICAL_RATE, "target_pitch": 10.0}
    if action == Action.DESCEND:
        return {"vertical_rate": -MAX_VERTICAL_RATE, "target_pitch": -10.0}
    if action == Action.ACCELERATE:
        return {"forward_accel": MAX_FORWARD_ACCEL}
    if action == Action.DECELERATE:
        return {"forward_accel": -MAX_FORWARD_ACCEL}
    if action == Action.TURN_LEFT:
        return {"turn_rate": -MAX_TURN_RATE, "target_roll": -15.0}
    if action == Action.TURN_RIGHT:
        return {"turn_rate": MAX_TURN_RATE, "target_roll": 15.0}
    if action == Action.STABILIZE:
        return {"target_pitch": 0.0, "target_roll": 0.0}
    if action == Action.ABORT:
        return {"forward_accel": -2 * MAX_FORWARD_ACCEL, "target_pitch": 0.0, "target_roll": 0.0}
    # HOLD or anything else: no commanded change.
    return {}


def integrate_action(
    state: VehicleState,
    action: Action,
    dt_total: float = 1.0,
    substeps: int = 10,
) -> VehicleState:
    """Advance the state under ``action`` over ``dt_total`` seconds.

    Splits the interval into ``substeps`` substeps and applies the
    command-driven dynamics on each. Returns a new VehicleState; the
    input is never mutated.
    """

    if substeps <= 0:
        raise ValueError("substeps must be positive")

    cmd = command_for(action)
    vertical_rate = float(cmd.get("vertical_rate", 0.0))
    forward_accel = float(cmd.get("forward_accel", 0.0))
    turn_rate = float(cmd.get("turn_rate", 0.0))
    target_pitch = float(cmd.get("target_pitch", 0.0))
    target_roll = float(cmd.get("target_roll", 0.0))

    dt = dt_total / substeps
    altitude = state.altitude
    velocity = state.velocity
    heading = state.heading
    pitch = state.pitch
    roll = state.roll
    pos_x = state.position_x
    pos_y = state.position_y

    for _ in range(substeps):
        altitude = step_altitude(altitude, vertical_rate, dt)
        velocity = step_velocity(velocity, forward_accel, dt)
        heading = step_heading(heading, turn_rate, dt)
        pitch = step_pitch(pitch, target_pitch, PITCH_LAG_S, dt)
        roll = step_roll(roll, target_roll, ROLL_LAG_S, dt)
        dx, dy = horizontal_displacement(velocity, heading, dt)
        pos_x += dx
        pos_y += dy

    return replace(
        state,
        step=state.step + 1,
        timestamp=state.timestamp + dt_total,
        position_x=pos_x,
        position_y=pos_y,
        altitude=altitude,
        velocity=velocity,
        heading=heading,
        pitch=pitch,
        roll=roll,
        last_action=action,
    )
