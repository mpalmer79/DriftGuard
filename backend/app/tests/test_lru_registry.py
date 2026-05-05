"""LRU eviction on the in-memory registry (Phase 8.4)."""

from __future__ import annotations

from app.api.dependencies import _LRURegistry
from app.simulation.orchestrator import Simulation


def _sim(name: str) -> Simulation:
    return Simulation(name, seed=1)


def test_registry_evicts_oldest_when_over_capacity():
    reg = _LRURegistry(capacity=2)
    reg["a"] = _sim("a")
    reg["b"] = _sim("b")
    reg["c"] = _sim("c")
    assert "a" not in reg
    assert "b" in reg
    assert "c" in reg


def test_get_touches_lru_order():
    reg = _LRURegistry(capacity=2)
    reg["a"] = _sim("a")
    reg["b"] = _sim("b")
    # Access a; now a is most-recent and b is oldest.
    reg.get("a")
    reg["c"] = _sim("c")
    assert "a" in reg
    assert "b" not in reg
    assert "c" in reg


def test_setitem_existing_key_does_not_evict():
    reg = _LRURegistry(capacity=2)
    reg["a"] = _sim("a")
    reg["b"] = _sim("b")
    reg["a"] = _sim("a-prime")  # update, not insert
    assert len(reg) == 2
    assert "a" in reg
    assert "b" in reg


def test_clear_drops_everything():
    reg = _LRURegistry(capacity=4)
    reg["a"] = _sim("a")
    reg["b"] = _sim("b")
    reg.clear()
    assert len(reg) == 0


def test_default_capacity_matches_directive():
    from app.api.dependencies import MAX_REGISTRY_SIZE

    assert MAX_REGISTRY_SIZE == 100
