from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..domain.enums import FaultSeverity, FaultType, SystemMode


@dataclass
class ScenarioInitialState:
    altitude: Optional[float] = None
    velocity: Optional[float] = None
    heading: Optional[float] = None


@dataclass
class ScenarioFault:
    type: FaultType
    target: str
    start_step: int
    duration: Optional[int] = None
    severity: FaultSeverity = FaultSeverity.WARNING
    metadata: Dict[str, Any] = field(default_factory=dict)


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
    faults: List[ScenarioFault] = field(default_factory=list)
    expected_final_modes: List[SystemMode] = field(default_factory=list)
    notes: List[ScenarioStep] = field(default_factory=list)


@dataclass
class ScenarioResult:
    scenario: str
    simulation_id: str
    steps_run: int
    final_mode: SystemMode
    final_action: str
    fault_summary: List[Dict[str, Any]]
    decision_counts: Dict[str, int]
    event_counts: Dict[str, int]
    mode_transitions: List[Dict[str, Any]]
    trust_snapshot: Dict[str, Any]
