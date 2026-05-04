"""Persisted-event ordering test (Phase 1.4 prereq).

Pins the property that events come back in insertion order. This is
load-bearing for the replay fingerprint: if SQLite returned events in
random-UUID order, the canonical timeline would shuffle and the
fingerprint would be useless.
"""

from app.persistence.database import Database
from app.persistence.repository import SimulationRepository
from app.simulation.orchestrator import Simulation


def test_events_in_step_have_stable_relative_order():
    db = Database(":memory:")
    repo = SimulationRepository(db)
    sim = Simulation("evt-order", seed=4)
    repo.create_simulation(sim)
    for r in sim.run(2):
        repo.save_step(sim.id, r)

    events = repo.get_events(sim.id)
    # The orchestrator emits sensor first, then one event per
    # controller, then vote, then decision, then state. Without
    # explicit ordering, the per-step sub-sequence would be random.
    step1 = [e for e in events if e["step"] == 1]
    types_in_step1 = [e["type"] for e in step1]

    # Sensor is the very first event of every step.
    assert types_in_step1[0] == "SENSOR"
    # State is the last event the orchestrator emits in a step.
    assert types_in_step1[-1] == "STATE"
    # Decision precedes state.
    assert types_in_step1.index("DECISION") < types_in_step1.index("STATE")
    # Vote precedes decision.
    assert types_in_step1.index("VOTE") < types_in_step1.index("DECISION")


def test_event_order_is_identical_across_two_runs():
    """Two simulations with the same seed must return events in the
    same relative order. Ordering by ROWID preserves insertion order
    within each simulation, which is the orchestrator's deterministic
    sequence."""

    def order(seed: int) -> list[tuple[int, str, str]]:
        db = Database(":memory:")
        repo = SimulationRepository(db)
        sim = Simulation("evt", seed=seed)
        repo.create_simulation(sim)
        for r in sim.run(3):
            repo.save_step(sim.id, r)
        return [(e["step"], e["component"], e["type"]) for e in repo.get_events(sim.id)]

    assert order(seed=9) == order(seed=9)
