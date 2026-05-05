"""3-DOF rigid-body dynamics primitives.

The vehicle is modeled with three coupled subsystems:

- **Position (NED-ish)** in a flat-earth frame. We use East/North/Up
  for ergonomics: ``position_x`` is east, ``position_y`` is north,
  ``altitude`` is up. The simulation stays small enough that the
  curvature of the earth is irrelevant.
- **Body velocity** as a scalar groundspeed plus a heading. This
  matches the existing ``VehicleState`` fields and is the simplest
  representation that supports waypoint following and turn dynamics.
- **Attitude (Euler)** as roll, pitch, heading. Heading wraps in
  [0, 360); roll and pitch are clamped at structural limits.

Each function below is pure, takes the current state plus a small
delta, and returns the updated values. They compose into the
integrator in ``simulation.dynamics.integrator``.

References to the rest of the system:

- ``apply_action`` in ``simulation/vehicle.py`` is the legacy
  one-step kinematic model. It still drives the existing scenarios.
  The functions here are the substrate the Phase 2.1 integrator
  uses to build a continuous-time replacement.
"""

from __future__ import annotations

import math

# Limits and rates. Centralized so the integrator and the tests share
# the same numbers. They are intentionally small: SentinelNav is not a
# flight-dynamics simulator, it is a redundancy and assurance test bed.
MAX_ROLL_DEG = 25.0
MAX_PITCH_DEG = 15.0
MAX_VERTICAL_RATE = 25.0  # m/s
MAX_FORWARD_ACCEL = 10.0  # m/s^2
MAX_TURN_RATE = 5.0  # deg/s


def wrap_heading(heading_deg: float) -> float:
    """Wrap a heading angle into [0, 360)."""

    return heading_deg % 360.0


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def step_altitude(altitude: float, vertical_rate: float, dt: float) -> float:
    """Integrate altitude under a commanded vertical rate.

    Floor at zero so the vehicle does not pass through the ground.
    """

    return max(0.0, altitude + vertical_rate * dt)


def step_velocity(velocity: float, accel: float, dt: float) -> float:
    """Integrate forward velocity. Forward velocity cannot go negative."""

    return max(0.0, velocity + accel * dt)


def step_heading(heading_deg: float, turn_rate_deg_s: float, dt: float) -> float:
    """Integrate heading under a commanded turn rate, wrapping at 360."""

    return wrap_heading(heading_deg + turn_rate_deg_s * dt)


def step_pitch(current_pitch_deg: float, target_pitch_deg: float, lag: float, dt: float) -> float:
    """First-order lag toward the target pitch, clamped to structural limits.

    ``lag`` is the time constant: smaller numbers mean faster response.
    """

    if lag <= 0.0:
        new = target_pitch_deg
    else:
        alpha = clamp(dt / lag, 0.0, 1.0)
        new = current_pitch_deg + alpha * (target_pitch_deg - current_pitch_deg)
    return clamp(new, -MAX_PITCH_DEG, MAX_PITCH_DEG)


def step_roll(current_roll_deg: float, target_roll_deg: float, lag: float, dt: float) -> float:
    """First-order lag toward the target roll, clamped to structural limits."""

    if lag <= 0.0:
        new = target_roll_deg
    else:
        alpha = clamp(dt / lag, 0.0, 1.0)
        new = current_roll_deg + alpha * (target_roll_deg - current_roll_deg)
    return clamp(new, -MAX_ROLL_DEG, MAX_ROLL_DEG)


def horizontal_displacement(
    velocity: float, heading_deg: float, dt: float
) -> tuple[float, float]:
    """Displacement in the East / North plane for the given step.

    Returns ``(dx_east, dy_north)``. Heading 0 is east; heading 90 is
    north; this matches the existing convention in
    ``simulation/vehicle.py``.
    """

    rad = math.radians(heading_deg)
    return velocity * dt * math.cos(rad), velocity * dt * math.sin(rad)
