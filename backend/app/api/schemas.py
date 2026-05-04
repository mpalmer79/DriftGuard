from typing import Any

from pydantic import BaseModel, Field

from ..domain.enums import FaultSeverity, FaultType


class CreateSimulationRequest(BaseModel):
    simulation_id: str | None = None
    seed: int | None = None


class CreateSimulationResponse(BaseModel):
    simulation_id: str
    seed: int


class StepResponse(BaseModel):
    step: int
    sensor: dict[str, Any]
    controllers: list[dict[str, Any]]
    vote: dict[str, Any]
    decision: dict[str, Any]
    state: dict[str, Any]


class FaultRequest(BaseModel):
    type: FaultType
    target: str = Field(..., description="sensor | controller_a | controller_b | controller_c")
    start_step: int | None = None
    duration: int | None = None
    severity: FaultSeverity = FaultSeverity.WARNING
    metadata: dict[str, Any] | None = None


class FaultResponse(BaseModel):
    fault_id: str
    type: FaultType
    target: str
    start_step: int
    end_step: int | None
    severity: FaultSeverity
    metadata: dict[str, Any]


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
    last_action: str | None


class EventResponse(BaseModel):
    event_id: str
    step: int
    timestamp: float
    component: str
    type: str
    severity: str
    message: str
    metadata: dict[str, Any]
