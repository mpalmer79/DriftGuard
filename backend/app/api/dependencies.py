"""Process-wide singletons for the API layer.

Phase 8.4 caps the in-memory simulation registry at MAX_REGISTRY_SIZE
entries with LRU eviction. Persisted simulations are unaffected — the
SQLite read paths still serve the timeline, decisions, etc., for any
sim that's been evicted from memory.
"""

from __future__ import annotations

from collections import OrderedDict
from collections.abc import Iterator, MutableMapping

from ..core.exceptions import NotFoundError
from ..persistence.database import Database
from ..persistence.repository import SimulationRepository
from ..simulation.orchestrator import Simulation

MAX_REGISTRY_SIZE = 100


class _LRURegistry(MutableMapping[str, Simulation]):
    """OrderedDict-backed LRU. Touch on read or write moves the entry
    to the most-recently-used end; insertion past the cap evicts the
    oldest entry. Tests can mutate ``capacity`` directly."""

    def __init__(self, capacity: int = MAX_REGISTRY_SIZE) -> None:
        self.capacity = capacity
        self._data: OrderedDict[str, Simulation] = OrderedDict()

    def __getitem__(self, key: str) -> Simulation:
        value = self._data[key]
        self._data.move_to_end(key)
        return value

    def __setitem__(self, key: str, value: Simulation) -> None:
        if key in self._data:
            self._data.move_to_end(key)
        self._data[key] = value
        while len(self._data) > self.capacity:
            self._data.popitem(last=False)

    def __delitem__(self, key: str) -> None:
        del self._data[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._data)

    def __len__(self) -> int:
        return len(self._data)

    def __contains__(self, key: object) -> bool:
        return key in self._data

    def get(self, key: str, default: Simulation | None = None) -> Simulation | None:  # type: ignore[override]
        if key in self._data:
            self._data.move_to_end(key)
            return self._data[key]
        return default

    def clear(self) -> None:
        self._data.clear()


_simulations: _LRURegistry = _LRURegistry()
_db = Database(path=":memory:")
_repo = SimulationRepository(_db)


def get_registry() -> _LRURegistry:
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
