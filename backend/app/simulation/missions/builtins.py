"""Built-in waypoint missions.

Each function returns a fresh Mission instance so callers can mutate
the waypoint list (e.g. for parameter overrides in scenarios)
without affecting other consumers.
"""

from __future__ import annotations

from .models import Mission, Waypoint


def short_hop() -> Mission:
    return Mission(
        name="short_hop",
        description="A 500-meter dogleg with a single altitude change.",
        waypoints=[
            Waypoint(x=500.0, y=0.0, altitude=1000.0, velocity=120.0),
            Waypoint(x=500.0, y=500.0, altitude=1100.0, velocity=120.0),
        ],
    )


def racetrack() -> Mission:
    return Mission(
        name="racetrack",
        description="Closed-loop racetrack circuit with four corners.",
        waypoints=[
            Waypoint(x=1000.0, y=0.0, altitude=1000.0, velocity=120.0),
            Waypoint(x=1000.0, y=1000.0, altitude=1000.0, velocity=120.0),
            Waypoint(x=0.0, y=1000.0, altitude=1000.0, velocity=120.0),
            Waypoint(x=0.0, y=0.0, altitude=1000.0, velocity=120.0),
        ],
        closed_loop=True,
    )


def switchback() -> Mission:
    return Mission(
        name="switchback",
        description="Aggressive zig-zag exercising turn dynamics.",
        waypoints=[
            Waypoint(x=300.0, y=200.0, altitude=1000.0, velocity=110.0),
            Waypoint(x=600.0, y=-200.0, altitude=1100.0, velocity=110.0),
            Waypoint(x=900.0, y=200.0, altitude=1000.0, velocity=110.0),
            Waypoint(x=1200.0, y=-200.0, altitude=1100.0, velocity=110.0),
            Waypoint(x=1500.0, y=0.0, altitude=1000.0, velocity=110.0),
        ],
    )


ALL_MISSIONS = (short_hop, racetrack, switchback)
