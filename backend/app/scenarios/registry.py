from collections import Counter

from ..core.exceptions import ScenarioError
from ..core.ids import simulation_id as new_simulation_id
from ..domain.enums import SystemMode
from ..simulation.orchestrator import Simulation
from .builtins import ALL_BUILTINS
from .models import (
    Scenario,
    ScenarioResult,
)

_SCENARIOS: dict[str, Scenario] = {}
_BUILTIN_NAMES: frozenset[str] = frozenset()


def _register(scenario: Scenario) -> None:
    _SCENARIOS[scenario.name] = scenario


for _factory in ALL_BUILTINS:
    _register(_factory())

# Snapshot the built-in names once at import time. Anything the user
# registers later through the API (Phase 5.3) lives outside this set
# and is therefore deletable.
_BUILTIN_NAMES = frozenset(_SCENARIOS)


def all_scenarios() -> list[Scenario]:
    return list(_SCENARIOS.values())


def get_scenario(name: str) -> Scenario:
    if name not in _SCENARIOS:
        raise ScenarioError(f"unknown scenario '{name}'")
    return _SCENARIOS[name]


def is_builtin(name: str) -> bool:
    return name in _BUILTIN_NAMES


def register_user_scenario(scenario: Scenario) -> None:
    """Register a user-supplied scenario (Phase 5.3).

    Raises ScenarioError if the name collides with a built-in or
    with another user-registered scenario.
    """

    if scenario.name in _BUILTIN_NAMES:
        raise ScenarioError(f"'{scenario.name}' is a built-in and cannot be overridden")
    if scenario.name in _SCENARIOS:
        raise ScenarioError(f"scenario '{scenario.name}' already exists")
    _SCENARIOS[scenario.name] = scenario


def unregister_user_scenario(name: str) -> None:
    """Remove a user-registered scenario. Built-ins are immutable."""

    if name in _BUILTIN_NAMES:
        raise ScenarioError(f"'{name}' is a built-in and cannot be deleted")
    if name not in _SCENARIOS:
        raise ScenarioError(f"unknown scenario '{name}'")
    del _SCENARIOS[name]


def run_scenario(
    name: str,
    steps_override: int | None = None,
    *,
    seed_override: int | None = None,
    fault_metadata_overrides: dict[int, dict] | None = None,
) -> tuple[Simulation, ScenarioResult]:
    """Run a scenario, optionally overriding seed and per-fault metadata.

    ``fault_metadata_overrides`` maps a fault index (zero-based, in
    the scenario's declared order) to a metadata dict that is merged
    over the scenario's metadata for that fault. Unknown indices
    raise ScenarioError so a typo at the API layer surfaces as 400.
    """

    scenario = get_scenario(name)
    sim_id = f"{scenario.name}_{new_simulation_id()}"
    seed = seed_override if seed_override is not None else scenario.seed
    sim = Simulation(simulation_id=sim_id, seed=seed)

    if scenario.initial_state.altitude is not None:
        sim.state.altitude = scenario.initial_state.altitude
    if scenario.initial_state.velocity is not None:
        sim.state.velocity = scenario.initial_state.velocity
    if scenario.initial_state.heading is not None:
        sim.state.heading = scenario.initial_state.heading

    overrides = fault_metadata_overrides or {}
    for idx in overrides:
        if idx < 0 or idx >= len(scenario.faults):
            raise ScenarioError(f"fault override index {idx} out of range")

    for i, fault in enumerate(scenario.faults):
        metadata = dict(fault.metadata)
        if i in overrides:
            metadata.update(overrides[i])
        sim.inject_fault(
            fault_type=fault.type,
            target=fault.target,
            start_step=fault.start_step,
            duration=fault.duration,
            severity=fault.severity,
            metadata=metadata,
        )

    steps = steps_override or scenario.steps
    records = sim.run(steps)

    decision_counts = Counter(r.decision.system_mode.value for r in records)
    event_counts = Counter(e.type.value for e in sim.events.all())

    mode_transitions = []
    prev = None
    for r in records:
        m = r.decision.system_mode
        if m != prev:
            mode_transitions.append({"step": r.decision.step, "mode": m.value})
            prev = m

    fault_summary = [
        {
            "fault_id": f.fault_id,
            "type": f.type.value,
            "target": f.target_component,
            "severity": f.severity.value,
            "start_step": f.start_step,
            "end_step": f.end_step,
            "metadata": f.metadata,
        }
        for f in sim.faults.all()
    ]

    final = records[-1].decision if records else None
    result = ScenarioResult(
        scenario=scenario.name,
        simulation_id=sim_id,
        steps_run=len(records),
        final_mode=final.system_mode if final else SystemMode.NORMAL,
        final_action=final.final_action.value if final else "HOLD",
        fault_summary=fault_summary,
        decision_counts=dict(decision_counts),
        event_counts=dict(event_counts),
        mode_transitions=mode_transitions,
        trust_snapshot=sim.trust.snapshot(),
    )
    return sim, result
