import math
from dataclasses import replace

from ..domain.enums import Action, SystemMode
from ..domain.models import VehicleState


def initial_state(simulation_id: str) -> VehicleState:
    return VehicleState(
        simulation_id=simulation_id,
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


def apply_action(state: VehicleState, action: Action, dt: float = 1.0) -> VehicleState:
    altitude = state.altitude
    velocity = state.velocity
    heading = state.heading
    pitch = state.pitch
    roll = state.roll

    if action == Action.ASCEND:
        altitude += 25.0 * dt
        pitch = min(15.0, pitch + 3.0)
    elif action == Action.DESCEND:
        altitude -= 25.0 * dt
        pitch = max(-15.0, pitch - 3.0)
    elif action == Action.ACCELERATE:
        velocity += 10.0 * dt
    elif action == Action.DECELERATE:
        velocity -= 10.0 * dt
    elif action == Action.TURN_LEFT:
        heading = (heading - 5.0 * dt) % 360.0
        roll = max(-25.0, roll - 4.0)
    elif action == Action.TURN_RIGHT:
        heading = (heading + 5.0 * dt) % 360.0
        roll = min(25.0, roll + 4.0)
    elif action == Action.STABILIZE:
        pitch *= 0.5
        roll *= 0.5
    elif action == Action.ABORT:
        velocity = max(0.0, velocity - 20.0 * dt)
        pitch *= 0.25
        roll *= 0.25
    # HOLD: no change

    velocity = max(0.0, velocity)
    altitude = max(0.0, altitude)

    rad = math.radians(heading)
    px = state.position_x + velocity * dt * math.cos(rad)
    py = state.position_y + velocity * dt * math.sin(rad)

    return replace(
        state,
        step=state.step + 1,
        timestamp=state.timestamp + dt,
        position_x=px,
        position_y=py,
        altitude=altitude,
        velocity=velocity,
        heading=heading,
        pitch=pitch,
        roll=roll,
        last_action=action,
    )
