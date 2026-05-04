from collections import Counter
from typing import Dict, List

from ..core.exceptions import ScenarioError
from ..core.ids import simulation_id as new_simulation_id
from ..domain.enums import FaultSeverity, FaultType, SystemMode
from ..simulation.orchestrator import Simulation
from .models import (
    Scenario,
    ScenarioFault,
    ScenarioInitialState,
    ScenarioResult,
)


_SCENARIOS: Dict[str, Scenario] = {}


def _register(scenario: Scenario) -> None:
    _SCENARIOS[scenario.name] = scenario


_register(
    Scenario(
        name="nominal_cruise",
        description="Steady-state cruise with no faults injected.",
        expected_behavior="System remains in NORMAL mode for the full run.",
        seed=42,
        steps=20,
        expected_final_modes=[SystemMode.NORMAL],
    )
)


_register(
    Scenario(
        name="single_controller_latency",
        description="Controller B exceeds the latency budget for several steps.",
        expected_behavior="System rejects controller_b and may degrade as latency persists.",
        seed=11,
        steps=15,
        faults=[
            ScenarioFault(
                type=FaultType.CONTROLLER_LATENCY,
                target="controller_b",
                start_step=2,
                duration=10,
                metadata={"latency_ms": 250.0},
            )
        ],
        expected_final_modes=[SystemMode.NORMAL, SystemMode.DEGRADED, SystemMode.SAFE_MODE],
    )
)


_register(
    Scenario(
        name="sensor_drift_recovery",
        description="Sensor altitude drifts upward, then the fault clears.",
        expected_behavior="Sensor health degrades, system restricts unsafe actions, then recovers.",
        seed=23,
        steps=25,
        faults=[
            ScenarioFault(
                type=FaultType.SENSOR_DRIFT,
                target="sensor",
                start_step=3,
                duration=8,
                metadata={"magnitude": 4.0},
            )
        ],
        expected_final_modes=[SystemMode.NORMAL, SystemMode.DEGRADED, SystemMode.SAFE_MODE],
    )
)


_register(
    Scenario(
        name="split_vote_escalation",
        description="Controllers repeatedly disagree because controller_b is action-biased.",
        expected_behavior="Vote splits frequently and the system enters SAFE_MODE.",
        seed=8,
        steps=15,
        faults=[
            ScenarioFault(
                type=FaultType.CONTROLLER_ACTION_BIAS,
                target="controller_b",
                start_step=1,
                duration=15,
                metadata={"forced_action": "ABORT"},
            ),
            ScenarioFault(
                type=FaultType.CONTROLLER_ACTION_BIAS,
                target="controller_c",
                start_step=2,
                duration=15,
                metadata={"forced_action": "TURN_RIGHT"},
            ),
        ],
        expected_final_modes=[SystemMode.SAFE_MODE, SystemMode.FAILED, SystemMode.DEGRADED],
    )
)


_register(
    Scenario(
        name="multi_fault_failure",
        description="Sensor drift plus two controller failures.",
        expected_behavior="System escalates through DEGRADED and SAFE_MODE into FAILED.",
        seed=5,
        steps=20,
        faults=[
            ScenarioFault(
                type=FaultType.SENSOR_DROPOUT,
                target="sensor",
                start_step=3,
                duration=20,
                metadata={"probability": 0.6},
            ),
            ScenarioFault(
                type=FaultType.CONTROLLER_INVALID_OUTPUT,
                target="controller_a",
                start_step=4,
                duration=20,
            ),
            ScenarioFault(
                type=FaultType.CONTROLLER_SILENT_FAILURE,
                target="controller_b",
                start_step=6,
                duration=20,
            ),
        ],
        expected_final_modes=[SystemMode.SAFE_MODE, SystemMode.FAILED],
    )
)


_register(
    Scenario(
        name="intermittent_fault",
        description="Controller_a flickers between healthy and faulty across the run.",
        expected_behavior="Health bounces between SUSPECT and RECOVERING; mode transitions visible.",
        seed=17,
        steps=24,
        faults=[
            ScenarioFault(
                type=FaultType.CONTROLLER_INVALID_OUTPUT,
                target="controller_a",
                start_step=2,
                duration=22,
                metadata={"intermittent_pattern": [1, 1, 0, 0, 1, 0]},
            )
        ],
        expected_final_modes=[
            SystemMode.NORMAL,
            SystemMode.DEGRADED,
            SystemMode.SAFE_MODE,
        ],
    )
)


def all_scenarios() -> List[Scenario]:
    return list(_SCENARIOS.values())


def get_scenario(name: str) -> Scenario:
    if name not in _SCENARIOS:
        raise ScenarioError(f"unknown scenario '{name}'")
    return _SCENARIOS[name]


def run_scenario(name: str, steps_override: int | None = None) -> tuple[Simulation, ScenarioResult]:
    scenario = get_scenario(name)
    sim_id = f"{scenario.name}_{new_simulation_id()}"
    sim = Simulation(simulation_id=sim_id, seed=scenario.seed)

    if scenario.initial_state.altitude is not None:
        sim.state.altitude = scenario.initial_state.altitude
    if scenario.initial_state.velocity is not None:
        sim.state.velocity = scenario.initial_state.velocity
    if scenario.initial_state.heading is not None:
        sim.state.heading = scenario.initial_state.heading

    for fault in scenario.faults:
        sim.inject_fault(
            fault_type=fault.type,
            target=fault.target,
            start_step=fault.start_step,
            duration=fault.duration,
            severity=fault.severity,
            metadata=dict(fault.metadata),
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
