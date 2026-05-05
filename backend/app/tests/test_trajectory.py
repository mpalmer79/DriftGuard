"""Trajectory recorder repository tests (Phase 2.7).

The endpoint tests live in test_trajectory_endpoint.py so each
commit lands with green tests.
"""

from app.persistence.database import Database
from app.persistence.repository import SimulationRepository
from app.simulation.orchestrator import Simulation


def test_get_trajectory_returns_one_entry_per_step():
    db = Database(":memory:")
    repo = SimulationRepository(db)
    sim = Simulation("traj", seed=2)
    repo.create_simulation(sim)
    for r in sim.run(5):
        repo.save_step(sim.id, r)

    points = repo.get_trajectory(sim.id)
    assert len(points) == 6  # initial + 5 steps
    assert points[0]["step"] == 0
    assert points[-1]["step"] == 5
    keys = set(points[0].keys())
    assert {"step", "timestamp", "position_x", "position_y", "altitude", "system_mode"} <= keys


def test_trajectory_is_strictly_step_ordered():
    db = Database(":memory:")
    repo = SimulationRepository(db)
    sim = Simulation("traj-order", seed=4)
    repo.create_simulation(sim)
    for r in sim.run(10):
        repo.save_step(sim.id, r)
    points = repo.get_trajectory(sim.id)
    steps = [p["step"] for p in points]
    assert steps == sorted(steps)


def test_trajectory_for_unknown_simulation_in_repo_is_empty():
    repo = SimulationRepository(Database(":memory:"))
    assert repo.get_trajectory("missing") == []
