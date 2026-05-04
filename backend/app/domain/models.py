from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

from .enums import (
    Action,
    SystemMode,
    SensorStatus,
    VoteOutcome,
    FaultType,
    FaultSeverity,
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
    last_action: Optional[Action]


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
    fault_flags: List[str] = field(default_factory=list)


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
    selected_action: Optional[Action]
    agreeing_controllers: List[str]
    rejected_controllers: List[str]
    reason: str


@dataclass
class FaultRecord:
    fault_id: str
    type: FaultType
    target_component: str
    severity: FaultSeverity
    active: bool
    start_step: int
    end_step: Optional[int]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SystemDecision:
    step: int
    final_action: Action
    system_mode: SystemMode
    safe_mode_active: bool
    justification: str
    trusted_controllers: List[str]
    rejected_controllers: List[str]
