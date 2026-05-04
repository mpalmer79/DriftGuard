from dataclasses import dataclass, field
from typing import Any

from ..domain.enums import FaultSeverity, FaultType, SystemMode


@dataclass
class ScenarioInitialState:
    altitude: float | None = None
    velocity: float | None = None
    heading: float | None = None


@dataclass
class ScenarioFault:
    type: FaultType
    target: str
    start_step: int
    duration: int | None = None
    severity: FaultSeverity = FaultSeverity.WARNING
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ScenarioStep:
    step: int
    note: str = ""


@dataclass
class Scenario:
    name: str
    description: str
    expected_behavior: str
    seed: int
    steps: int
    initial_state: ScenarioInitialState = field(default_factory=ScenarioInitialState)
    faults: list[ScenarioFault] = field(default_factory=list)
    expected_final_modes: list[SystemMode] = field(default_factory=list)
    notes: list[ScenarioStep] = field(default_factory=list)


@dataclass
class ScenarioResult:
    scenario: str
    simulation_id: str
    steps_run: int
    final_mode: SystemMode
    final_action: str
    fault_summary: list[dict[str, Any]]
    decision_counts: dict[str, int]
    event_counts: dict[str, int]
    mode_transitions: list[dict[str, Any]]
    trust_snapshot: dict[str, Any]
