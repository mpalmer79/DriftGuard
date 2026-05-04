"""Replay-equivalence harness (Phase 1.3).

Three layers of evidence per RESEARCH.md §11 ("same seed × 10 → 10/10
identical"):

1. Direct byte-equality of two in-process runs of every built-in
   scenario.
2. Hypothesis property test over a wide seed range and step count.
3. Cross-process: spawn a Python subprocess, run the same scenario,
   collect its canonical timeline, and compare against the in-process
   one. This is the test that the SHA-256 RNG derivation (ADR 0006)
   actually buys us.
"""

from __future__ import annotations

import json
import subprocess
import sys

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from app.core.canonical import canonical_json, fingerprint
from app.scenarios import all_scenarios, run_scenario
from app.simulation.orchestrator import Simulation


def _run_simulation_history(seed: int, steps: int) -> list:
    sim = Simulation("det", seed=seed)
    sim.run(steps)
    return sim.step_history


SCENARIO_NAMES = [s.name for s in all_scenarios()]


@pytest.mark.parametrize("name", SCENARIO_NAMES)
def test_scenario_replay_byte_equality(name):
    _, _ = run_scenario(name)
    # Run twice through the registry; each run gets a fresh sim_id but
    # same seed. Compare canonical timelines.
    sim_a, _ = run_scenario(name)
    sim_b, _ = run_scenario(name)
    assert canonical_json(sim_a.step_history) == canonical_json(sim_b.step_history)


def test_ten_replays_are_identical():
    """RESEARCH §11: 'Same seed repeated 10 times → 10/10 identical'."""

    fingerprints = set()
    for _ in range(10):
        sim, _ = run_scenario("multi_fault_failure")
        fingerprints.add(fingerprint(sim.step_history))
    assert len(fingerprints) == 1, "10 replays produced more than one fingerprint"


@settings(
    max_examples=50,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow],
)
@given(seed=st.integers(min_value=0, max_value=10_000), steps=st.integers(min_value=1, max_value=10))
def test_property_same_seed_same_history(seed, steps):
    """Property: any seed in [0, 10000] reproduces across two runs."""

    a = _run_simulation_history(seed, steps)
    b = _run_simulation_history(seed, steps)
    assert canonical_json(a) == canonical_json(b)


_SUBPROCESS_SCRIPT = """
import json
import sys
sys.path.insert(0, {backend_path!r})
from app.core.canonical import canonical_json
from app.scenarios import run_scenario

sim, _ = run_scenario({scenario!r})
sys.stdout.write(canonical_json(sim.step_history))
"""


def test_cross_process_equivalence(tmp_path):
    """Spawn a subprocess, run the scenario there, compare to in-process.

    This is the load-bearing claim of ADR 0006: SHA-256 derivation
    means child seeds reproduce across Python interpreters even
    though Python's hash() is salted per process.
    """

    import os

    backend_path = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    scenario = "nominal_cruise"

    sim, _ = run_scenario(scenario)
    in_process = canonical_json(sim.step_history)

    script = _SUBPROCESS_SCRIPT.format(backend_path=backend_path, scenario=scenario)
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        timeout=60,
        check=True,
    )

    out_of_process = result.stdout

    # Sanity: both should be valid JSON of equal length.
    assert json.loads(in_process) == json.loads(out_of_process), (
        "Cross-process replay diverged from in-process replay"
    )
