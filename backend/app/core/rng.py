"""Deterministic seeded RNG service.

Per ADR 0004 and ADR 0006: every random source on the simulation path
is a named child of a single root seed, derived through a stable hash.
This eliminates cross-contamination between subsystems if their call
order changes, and makes the RNG taxonomy trivially auditable: the
service surface lists every consumer.

Usage:

    rng = RngService(seed=42)
    sensor_rng = rng.child("sensor")
    controller_rng = rng.child("controller_a.fault")

The derivation is deterministic and platform-independent (sha256 of
``f"{seed}:{name}"``), so the same (seed, name) pair always produces
the same RNG state regardless of the order in which children are
requested.
"""

from __future__ import annotations

import hashlib
import random


def _derive_seed(root_seed: int, name: str) -> int:
    """Stable, platform-independent derivation of a child seed.

    Python's built-in ``hash()`` salts strings differently per process
    (PYTHONHASHSEED), so we use sha256 truncated to 64 bits.
    """

    payload = f"{int(root_seed)}:{name}".encode()
    digest = hashlib.sha256(payload).digest()
    return int.from_bytes(digest[:8], "big", signed=False)


class RngService:
    """Yields named child RNGs derived from a single root seed.

    Two services with the same root seed produce identical child RNGs
    for the same name. Children are cached per name so repeated lookups
    return the same Random instance and therefore the same stream.
    """

    def __init__(self, seed: int) -> None:
        self._seed = int(seed)
        self._children: dict[str, random.Random] = {}

    @property
    def seed(self) -> int:
        return self._seed

    def child(self, name: str) -> random.Random:
        if not name:
            raise ValueError("RngService child name must be non-empty")
        existing = self._children.get(name)
        if existing is not None:
            return existing
        child_seed = _derive_seed(self._seed, name)
        rng = random.Random(child_seed)
        self._children[name] = rng
        return rng

    def names(self) -> tuple[str, ...]:
        """Return the names of children currently materialized.

        Useful for tests that want to assert which RNG consumers a
        simulation created.
        """

        return tuple(self._children.keys())
