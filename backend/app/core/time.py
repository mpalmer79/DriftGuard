from dataclasses import dataclass


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
