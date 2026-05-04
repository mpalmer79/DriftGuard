from app.persistence.database import Database
from app.persistence.repository import SimulationRepository
from app.simulation.orchestrator import Simulation


def _seed_sim(steps: int = 5):
    db = Database(":memory:")
    repo = SimulationRepository(db)
    sim = Simulation("recover_1", seed=3)
    repo.create_simulation(sim)
    for r in sim.run(steps):
        repo.save_step(sim.id, r)
    for f in sim.faults.all():
        repo.save_fault(sim.id, f)
    return repo, sim


def test_list_and_get_simulation():
    repo, sim = _seed_sim(3)
    assert any(s["id"] == sim.id for s in repo.list_simulations())
    assert repo.get_simulation(sim.id)["seed"] == 3
    assert repo.get_simulation("missing") is None


def test_get_step_records_and_decisions():
    repo, sim = _seed_sim(4)
    states = repo.get_step_records(sim.id)
    decisions = repo.get_decisions(sim.id)
    assert len(states) >= 4  # initial + per-step
    assert len(decisions) == 4
    assert all("system_mode" in d for d in decisions)


def test_timeline_reconstruction_combines_signals():
    repo, sim = _seed_sim(4)
    timeline = repo.get_timeline(sim.id)
    assert len(timeline) >= 4
    last = timeline[-1]
    assert last["state"] is not None
    assert last["sensor"] is not None
    assert last["decision"] is not None
    assert last["vote"] is not None
    assert isinstance(last["controllers"], list) and len(last["controllers"]) == 3


def test_get_events_and_faults():
    repo, sim = _seed_sim(3)
    events = repo.get_events(sim.id)
    assert any(e["type"] == "DECISION" for e in events)
    assert isinstance(repo.get_faults(sim.id), list)
