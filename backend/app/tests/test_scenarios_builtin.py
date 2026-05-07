"""Built-in scenario coverage.

Asserts that each built-in scenario:
- resolves through the registry,
- produces a final SystemMode that lies in its declared
  ``expected_final_modes`` set,
- runs deterministically: two runs with the same seed produce
  identical event sequences (compared by a hash of the
  deterministic fields of every emitted event).
"""

from __future__ import annotations

import hashlib
import json

import pytest

from app.scenarios import all_scenarios, get_scenario, run_scenario
from app.scenarios.models import Scenario

NEW_BUILTIN_NAMES = [
    "sensor_spike_transient",
    "gps_denied_navigation",
    "byzantine_low_confidence",
    "compound_cascading_recovery",
]

ALL_BUILTIN_NAMES = [
    "nominal_cruise",
    "single_controller_latency",
    "sensor_drift_recovery",
    "split_vote_escalation",
    "multi_fault_failure",
    "intermittent_fault",
    *NEW_BUILTIN_NAMES,
]


_NONDETERMINISTIC_KEYS = {"fault_id", "event_id", "simulation_id"}


def _scrub(value):
    if isinstance(value, dict):
        return {k: _scrub(v) for k, v in value.items() if k not in _NONDETERMINISTIC_KEYS}
    if isinstance(value, list):
        return [_scrub(v) for v in value]
    return value


def _event_hash(simulation) -> str:
    """Hash the deterministic fields of every emitted event.

    ``event_id``, ``simulation_id`` and any embedded ``fault_id``
    are uuid-based and therefore stripped before hashing.
    """

    payload = [
        {
            "step": e.step,
            "component": e.component,
            "type": e.type.value,
            "severity": e.severity.value,
            "message": e.message,
            "metadata": _scrub(e.metadata),
        }
        for e in simulation.events.all()
    ]
    blob = json.dumps(payload, sort_keys=True, default=str).encode()
    return hashlib.sha256(blob).hexdigest()


def test_registry_lists_all_ten_builtins():
    names = {s.name for s in all_scenarios()}
    assert set(ALL_BUILTIN_NAMES).issubset(names)


@pytest.mark.parametrize("name", ALL_BUILTIN_NAMES)
def test_builtin_resolves_to_scenario(name):
    scenario = get_scenario(name)
    assert isinstance(scenario, Scenario)
    assert scenario.name == name
    assert scenario.expected_final_modes, f"{name} declares no expected_final_modes"


@pytest.mark.parametrize("name", ALL_BUILTIN_NAMES)
def test_builtin_final_mode_matches_expectation(name):
    scenario = get_scenario(name)
    _, result = run_scenario(name)
    assert result.final_mode in scenario.expected_final_modes, (
        f"{name}: final_mode={result.final_mode.value} not in "
        f"{[m.value for m in scenario.expected_final_modes]}"
    )


@pytest.mark.parametrize("name", ALL_BUILTIN_NAMES)
def test_builtin_is_reproducible(name):
    sim_a, _ = run_scenario(name)
    sim_b, _ = run_scenario(name)
    assert _event_hash(sim_a) == _event_hash(sim_b)
