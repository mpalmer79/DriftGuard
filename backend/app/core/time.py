"""Clock abstractions.

The simulation must not call ``time.time()`` directly on its hot path —
RESEARCH.md §5.3 ("deterministic logical-time scheduler") and §6
("clock skew → false disagreement → logical-time scheduler") make wall
clocks a non-determinism hazard.

Two clocks live here:

- ``SimulationClock`` — fixed-step logical time used by the orchestrator
  to advance the simulation. Already used.
- ``Clock`` protocol with ``SystemClock`` and ``FrozenClock``
  implementations — used by the persistence layer to stamp
  ``simulations.created_at``. Tests get the FrozenClock so persisted
  rows are reproducible.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Protocol


@dataclass
class SimulationClock:
    """Deterministic simulation clock.

    Time advances in fixed-size ticks, independent of wall clock, so the
    same seed and scenario produce the same timestamps.
    """

    dt: float = 1.0
    now: float = 0.0

    def tick(self) -> float:
        self.now += self.dt
        return self.now

    def reset(self) -> None:
        self.now = 0.0


class Clock(Protocol):
    """Wall-clock-style timestamp source.

    Used at boundaries that record real time (e.g. when a simulation row
    was created). The simulation step loop uses SimulationClock instead.
    """

    def now(self) -> float: ...


class SystemClock:
    """Production clock backed by ``time.time()``."""

    def now(self) -> float:
        return time.time()


class FrozenClock:
    """Test clock that returns a fixed value (or a programmable sequence).

    Pass a single float for a constant clock, or an iterable of floats
    to advance the clock on each call. Useful for asserting persisted
    rows have stable ``created_at`` values.
    """

    def __init__(self, value: float | list[float] = 0.0) -> None:
        if isinstance(value, list):
            self._values: list[float] | None = list(value)
            self._fixed: float | None = None
        else:
            self._values = None
            self._fixed = float(value)

    def now(self) -> float:
        if self._fixed is not None:
            return self._fixed
        assert self._values is not None
        if not self._values:
            raise RuntimeError("FrozenClock sequence exhausted")
        return self._values.pop(0)
