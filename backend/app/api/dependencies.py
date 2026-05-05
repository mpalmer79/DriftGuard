"""Process-wide singletons for the API layer.

Phase 8.4 caps the in-memory simulation registry at MAX_REGISTRY_SIZE
entries with LRU eviction. Persisted simulations are unaffected — the
SQLite read paths still serve the timeline, decisions, etc., for any
sim that's been evicted from memory.

Phase 4.1: ``SENTINEL_DB_PATH`` overrides the SQLite path. Default is
``":memory:"`` so the test suite stays hermetic; production
deployments set it to a filesystem path mounted on a persistent
volume. The Database connection is initialised lazily on first
access so a test that monkey-patches ``SENTINEL_DB_PATH`` and then
calls ``reset_state_for_tests()`` picks up the override.
"""

from __future__ import annotations

import os
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


def _resolved_db_path() -> str:
    """Read SENTINEL_DB_PATH each time so tests that monkeypatch the
    env var pick up the new value on the next reset_state_for_tests."""

    raw = os.environ.get("SENTINEL_DB_PATH", "").strip()
    return raw or ":memory:"


_simulations: _LRURegistry = _LRURegistry()
_db: Database | None = None
_repo: SimulationRepository | None = None


def get_registry() -> _LRURegistry:
    return _simulations


def get_db() -> Database:
    global _db
    if _db is None:
        _db = Database(path=_resolved_db_path())
    return _db


def get_repository() -> SimulationRepository:
    global _repo
    if _repo is None:
        _repo = SimulationRepository(get_db())
    return _repo


def get_simulation(sim_id: str) -> Simulation:
    sim = _simulations.get(sim_id)
    if sim is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")
    return sim


def reset_state_for_tests() -> None:
    global _db, _repo
    _simulations.clear()
    if _db is not None:
        _db.close()
    _db = None
    _repo = None
