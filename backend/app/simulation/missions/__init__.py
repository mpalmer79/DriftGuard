"""Waypoint missions for the simulation.

A ``Mission`` is an ordered list of waypoints with an associated
capture tolerance. ``MissionTracker`` advances through the list as
the vehicle reaches each waypoint, exposing the current target so a
controller (today: legacy + truth-sensor; future: EKF + waypoint
error) can drive toward it.

Three built-ins ship out of the box:

- ``short_hop``: A → B → done.
- ``racetrack``: closed loop with four waypoints.
- ``switchback``: zig-zag pattern that exercises turn dynamics.

Wiring missions into the controller decision logic is intentionally
not part of this commit — that change would cross multiple modules
and cannot be made atomic. The controller integration is tracked in
``docs/BACKLOG.md``.
"""

from .builtins import racetrack, short_hop, switchback
from .models import Mission, MissionTracker, Waypoint

__all__ = [
    "Mission",
    "MissionTracker",
    "Waypoint",
    "racetrack",
    "short_hop",
    "switchback",
]
