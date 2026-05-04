from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from ..domain.enums import FaultSeverity, FaultType


class CreateSimulationRequest(BaseModel):
    simulation_id: Optional[str] = None
    seed: Optional[int] = None


class CreateSimulationResponse(BaseModel):
    simulation_id: str
    seed: int


class StepResponse(BaseModel):
    step: int
    sensor: Dict[str, Any]
    controllers: List[Dict[str, Any]]
    vote: Dict[str, Any]
    decision: Dict[str, Any]
    state: Dict[str, Any]


class FaultRequest(BaseModel):
    type: FaultType
    target: str = Field(..., description="sensor | controller_a | controller_b | controller_c")
    start_step: Optional[int] = None
    duration: Optional[int] = None
    severity: FaultSeverity = FaultSeverity.WARNING
    metadata: Optional[Dict[str, Any]] = None


class FaultResponse(BaseModel):
    fault_id: str
    type: FaultType
    target: str
    start_step: int
    end_step: Optional[int]
    severity: FaultSeverity
    metadata: Dict[str, Any]


class StateResponse(BaseModel):
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
    system_mode: str
    last_action: Optional[str]


class EventResponse(BaseModel):
    event_id: str
    step: int
    timestamp: float
    component: str
    type: str
    severity: str
    message: str
    metadata: Dict[str, Any]
