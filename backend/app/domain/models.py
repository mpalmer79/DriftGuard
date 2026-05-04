from dataclasses import dataclass, field
from typing import Any

from .enums import (
    Action,
    FaultSeverity,
    FaultType,
    SensorStatus,
    SystemMode,
    VoteOutcome,
)


@dataclass
class VehicleState:
    simulation_id: str
    step: int
    timestamp: float
    position_x: float
    position_y: float
    altitude: float
    velocity: float
    heading: float
    pitch: float
    roll: float
    system_mode: SystemMode
    last_action: Action | None


@dataclass
class SensorReading:
    reading_id: str
    step: int
    altitude: float
    velocity: float
    heading: float
    pitch: float
    roll: float
    confidence: float
    status: SensorStatus
    fault_flags: list[str] = field(default_factory=list)


@dataclass
class ControllerOutput:
    controller_id: str
    step: int
    action: Action
    confidence: float
    reason_code: str
    response_time_ms: float
    valid: bool


@dataclass
class VoteResult:
    outcome: VoteOutcome
    selected_action: Action | None
    agreeing_controllers: list[str]
    rejected_controllers: list[str]
    reason: str


@dataclass
class FaultRecord:
    fault_id: str
    type: FaultType
    target_component: str
    severity: FaultSeverity
    active: bool
    start_step: int
    end_step: int | None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class SystemDecision:
    step: int
    final_action: Action
    system_mode: SystemMode
    safe_mode_active: bool
    justification: str
    trusted_controllers: list[str]
    rejected_controllers: list[str]
