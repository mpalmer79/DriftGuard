from typing import Dict

from ..core.exceptions import NotFoundError
from ..persistence.database import Database
from ..persistence.repository import SimulationRepository
from ..simulation.orchestrator import Simulation


_simulations: Dict[str, Simulation] = {}
_db = Database(path=":memory:")
_repo = SimulationRepository(_db)


def get_registry() -> Dict[str, Simulation]:
    return _simulations


def get_db() -> Database:
    return _db


def get_repository() -> SimulationRepository:
    return _repo


def get_simulation(sim_id: str) -> Simulation:
    sim = _simulations.get(sim_id)
    if sim is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")
    return sim


def reset_state_for_tests() -> None:
    global _db, _repo
    _simulations.clear()
    _db.close()
    _db = Database(path=":memory:")
    _repo = SimulationRepository(_db)
