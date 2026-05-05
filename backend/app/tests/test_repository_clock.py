"""Repository clock-injection test (Phase 1.2).

Asserts that FrozenClock-injected created_at values land in SQLite,
and that the default constructor still uses a wall clock.
"""

from app.core.time import FrozenClock, SystemClock
from app.persistence.database import Database
from app.persistence.repository import SimulationRepository
from app.simulation.orchestrator import Simulation


def test_create_simulation_uses_injected_clock():
    db = Database(":memory:")
    repo = SimulationRepository(db, clock=FrozenClock(1234567890.5))
    sim = Simulation("clock-test", seed=1)
    repo.create_simulation(sim)

    row = repo.get_simulation("clock-test")
    assert row is not None
    assert row["created_at"] == 1234567890.5


def test_default_clock_is_system_clock():
    repo = SimulationRepository(Database(":memory:"))
    assert isinstance(repo.clock, SystemClock)


def test_frozen_clock_sequence_persists_distinct_timestamps():
    db = Database(":memory:")
    repo = SimulationRepository(db, clock=FrozenClock([100.0, 200.0]))
    repo.create_simulation(Simulation("a", seed=1))
    repo.create_simulation(Simulation("b", seed=2))

    a = repo.get_simulation("a")
    b = repo.get_simulation("b")
    assert a is not None
    assert b is not None
    assert a["created_at"] == 100.0
    assert b["created_at"] == 200.0
