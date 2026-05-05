"""Mission and tracker tests (Phase 2.6)."""

from dataclasses import replace

import pytest

from app.simulation.missions import (
    Mission,
    MissionTracker,
    Waypoint,
    racetrack,
    short_hop,
    switchback,
)
from app.simulation.vehicle import initial_state


def test_three_built_in_missions_exist():
    names = {short_hop().name, racetrack().name, switchback().name}
    assert names == {"short_hop", "racetrack", "switchback"}


def test_mission_requires_at_least_one_waypoint():
    with pytest.raises(ValueError):
        Mission(name="empty", description="", waypoints=[])


def test_short_hop_completes_after_two_captures():
    mission = short_hop()
    tracker = MissionTracker(mission=mission)
    state = initial_state("m")

    assert tracker.active_waypoint is mission.waypoints[0]
    assert not tracker.complete

    # Place the vehicle exactly at the first waypoint.
    state = replace(state, position_x=500.0, position_y=0.0, altitude=1000.0)
    tracker.advance(state)
    assert tracker.index == 1

    state = replace(state, position_x=500.0, position_y=500.0, altitude=1100.0)
    tracker.advance(state)
    assert tracker.complete


def test_racetrack_loops_back_to_start():
    mission = racetrack()
    tracker = MissionTracker(mission=mission)
    state = initial_state("r")
    for wp in mission.waypoints:
        state = replace(state, position_x=wp.x, position_y=wp.y, altitude=wp.altitude)
        tracker.advance(state)
    assert tracker.laps == 1
    assert tracker.index == 0  # wrapped to the start


def test_capture_respects_radius():
    mission = short_hop()
    tracker = MissionTracker(mission=mission)
    wp = mission.waypoints[0]
    state = initial_state("c")

    # Outside the capture radius — no advance.
    state = replace(state, position_x=wp.x + wp.capture_radius * 2, position_y=wp.y)
    tracker.advance(state)
    assert tracker.index == 0


def test_progress_increases_monotonically():
    mission = switchback()
    tracker = MissionTracker(mission=mission)
    state = initial_state("p")
    progresses: list[float] = []
    for wp in mission.waypoints:
        state = replace(state, position_x=wp.x, position_y=wp.y, altitude=wp.altitude)
        tracker.advance(state)
        progresses.append(tracker.progress())
    assert progresses == sorted(progresses)
    assert tracker.progress() == 1.0


def test_advance_after_completion_returns_none():
    mission = short_hop()
    tracker = MissionTracker(mission=mission)
    for wp in mission.waypoints:
        state = replace(initial_state("c"), position_x=wp.x, position_y=wp.y, altitude=wp.altitude)
        tracker.advance(state)
    assert tracker.complete
    state = replace(initial_state("c"), position_x=999.0, position_y=999.0)
    assert tracker.advance(state) is None


def test_capture_radius_propagates_through_waypoint():
    wp = Waypoint(x=0.0, y=0.0, altitude=0.0, velocity=0.0, capture_radius=10.0)
    assert wp.capture_radius == 10.0
