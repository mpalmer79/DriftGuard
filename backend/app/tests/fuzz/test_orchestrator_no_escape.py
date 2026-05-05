"""Fuzz harness: no exception escapes the orchestrator.

For SENTINEL_FUZZ_SECONDS (default 30) the test injects random
faults at random steps with random metadata into a fresh
simulation, then advances. Any uncaught exception fails the test;
the test does not assert anything about *what* the simulation does
under the fault — only that it stays alive.

This complements the property tests, which describe the system's
positive contract. Fuzz catches the case where the contract holds
in nominal scenarios but a hostile metadata blob crashes the
orchestrator.

Marked ``@pytest.mark.slow`` so the default test run stays fast;
the GitHub Actions ``fuzz`` workflow runs it nightly.
"""

from __future__ import annotations

import os
import random
import time

import pytest

from app.domain.enums import FaultSeverity, FaultType
from app.simulation.orchestrator import Simulation

_DEFAULT_BUDGET_S = float(os.environ.get("SENTINEL_FUZZ_SECONDS", "30"))

_TARGETS = ("sensor", "controller_a", "controller_b", "controller_c", "gps")
_FAULT_TYPES = list(FaultType)


def _random_metadata(rng: random.Random) -> dict:
    """Generate plausible-but-noisy metadata blobs.

    Includes intermittent patterns and probability fields so we cover
    every branch of the fault-active gating. Also throws in occasional
    nonsense to surface defensive-coding gaps."""

    meta: dict = {}
    if rng.random() < 0.3:
        meta["magnitude"] = rng.uniform(0.1, 50.0)
    if rng.random() < 0.3:
        meta["offset"] = rng.uniform(-100.0, 100.0)
    if rng.random() < 0.3:
        meta["latency_ms"] = rng.uniform(0.0, 500.0)
    if rng.random() < 0.3:
        meta["probability"] = rng.uniform(0.0, 1.0)
    if rng.random() < 0.2:
        meta["intermittent_pattern"] = [rng.randint(0, 1) for _ in range(rng.randint(2, 8))]
    if rng.random() < 0.2:
        meta["confidence"] = rng.uniform(0.0, 1.0)
    if rng.random() < 0.1:
        meta["forced_action"] = rng.choice(
            ["HOLD", "ASCEND", "DESCEND", "ABORT", "STABILIZE", "WAT"]
        )  # WAT is on purpose; the orchestrator must tolerate junk
    if rng.random() < 0.1:
        meta["affected_fields"] = rng.sample(["altitude", "velocity", "heading"], k=rng.randint(1, 3))
    return meta


@pytest.mark.slow
def test_no_uncaught_exception_under_random_faults():
    seed = int(os.environ.get("SENTINEL_FUZZ_SEED", "0"))
    rng = random.Random(seed)
    deadline = time.monotonic() + _DEFAULT_BUDGET_S

    iterations = 0
    while time.monotonic() < deadline:
        sim_seed = rng.randint(0, 1_000_000)
        sim = Simulation(simulation_id=f"fuzz_{iterations}", seed=sim_seed)

        # Inject 0-5 random faults.
        for _ in range(rng.randint(0, 5)):
            fault_type = rng.choice(_FAULT_TYPES)
            target = rng.choice(_TARGETS)
            sim.inject_fault(
                fault_type=fault_type,
                target=target,
                start_step=rng.randint(0, 5),
                duration=rng.randint(1, 20),
                severity=rng.choice([FaultSeverity.WARNING, FaultSeverity.CRITICAL]),
                metadata=_random_metadata(rng),
            )

        # Advance the simulation a random number of steps.
        for _ in range(rng.randint(1, 30)):
            sim.step()
        iterations += 1

    assert iterations > 0, "fuzz harness did no iterations within budget"
