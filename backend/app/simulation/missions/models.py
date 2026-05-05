"""Mission and waypoint domain models with a tracker.

Waypoints carry an explicit capture tolerance so different mission
profiles can declare looser or tighter tolerances without baking a
single threshold into the tracker.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from ...domain.models import VehicleState


@dataclass
class Waypoint:
    x: float
    y: float
    altitude: float
    velocity: float
    capture_radius: float = 25.0


@dataclass
class Mission:
    name: str
    description: str
    waypoints: list[Waypoint]
    closed_loop: bool = False

    def __post_init__(self) -> None:
        if not self.waypoints:
            raise ValueError("Mission must have at least one waypoint")


@dataclass
class MissionTracker:
    """Tracks progress through a mission's waypoint list.

    ``advance`` is called each step with the current vehicle state.
    It returns the active waypoint after any captures have been
    processed, or ``None`` if the mission is complete.
    """

    mission: Mission
    index: int = 0
    laps: int = 0
    history: list[int] = field(default_factory=list)

    @property
    def complete(self) -> bool:
        return self.index >= len(self.mission.waypoints)

    @property
    def active_waypoint(self) -> Waypoint | None:
        if self.complete:
            return None
        return self.mission.waypoints[self.index]

    def advance(self, state: VehicleState) -> Waypoint | None:
        if self.complete:
            return None

        target = self.mission.waypoints[self.index]
        # 3D-ish distance: horizontal Euclidean + altitude error treated
        # as a fourth axis with the same units. A real flight controller
        # would use separate horizontal and vertical tolerances; we
        # collapse them because the simulation does not need that
        # fidelity yet.
        d_h = math.hypot(state.position_x - target.x, state.position_y - target.y)
        d_v = abs(state.altitude - target.altitude)
        distance = math.hypot(d_h, d_v)
        if distance <= target.capture_radius:
            self.history.append(self.index)
            self.index += 1
            if self.complete and self.mission.closed_loop:
                self.index = 0
                self.laps += 1
        return self.active_waypoint

    def progress(self) -> float:
        """Fraction of the mission completed in [0, 1]."""

        total = len(self.mission.waypoints)
        if total == 0:
            return 1.0
        return min(1.0, self.index / total)
