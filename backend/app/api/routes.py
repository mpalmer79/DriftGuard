from dataclasses import asdict

from fastapi import APIRouter, HTTPException

from ..core.ids import simulation_id as new_simulation_id
from ..simulation.orchestrator import Simulation
from . import dependencies as deps
from .schemas import (
    CreateSimulationRequest,
    CreateSimulationResponse,
    EventResponse,
    FaultRequest,
    FaultResponse,
    StateResponse,
    StepResponse,
)

router = APIRouter()


def _get_sim(sim_id: str) -> Simulation:
    sim = deps.get_registry().get(sim_id)
    if sim is None:
        raise HTTPException(status_code=404, detail="simulation not found")
    return sim


def _serialize_step(record) -> StepResponse:
    sensor = asdict(record.sensor)
    sensor["status"] = record.sensor.status.value

    controllers = []
    for o in record.outputs:
        d = asdict(o)
        d["action"] = o.action.value
        controllers.append(d)

    vote = asdict(record.vote)
    vote["outcome"] = record.vote.outcome.value
    vote["selected_action"] = (
        record.vote.selected_action.value if record.vote.selected_action else None
    )

    decision = asdict(record.decision)
    decision["final_action"] = record.decision.final_action.value
    decision["system_mode"] = record.decision.system_mode.value

    state = asdict(record.state)
    state["system_mode"] = record.state.system_mode.value
    state["last_action"] = record.state.last_action.value if record.state.last_action else None

    return StepResponse(
        step=record.state.step,
        sensor=sensor,
        controllers=controllers,
        vote=vote,
        decision=decision,
        state=state,
    )


@router.post("/simulations", response_model=CreateSimulationResponse, status_code=201)
def create_simulation(req: CreateSimulationRequest) -> CreateSimulationResponse:
    sim_id = req.simulation_id or new_simulation_id()
    if sim_id in deps.get_registry():
        raise HTTPException(status_code=409, detail="simulation already exists")
    sim = Simulation(simulation_id=sim_id, seed=req.seed)
    deps.get_registry()[sim_id] = sim
    deps.get_repository().create_simulation(sim)
    return CreateSimulationResponse(simulation_id=sim.id, seed=sim.seed)


@router.post("/simulations/{sim_id}/step", response_model=StepResponse)
def step_simulation(sim_id: str) -> StepResponse:
    sim = _get_sim(sim_id)
    record = sim.step()
    deps.get_repository().save_step(sim_id, record)
    return _serialize_step(record)


@router.post("/simulations/{sim_id}/faults", response_model=FaultResponse, status_code=201)
def inject_fault(sim_id: str, req: FaultRequest) -> FaultResponse:
    sim = _get_sim(sim_id)
    valid_targets = {"sensor", "controller_a", "controller_b", "controller_c"}
    if req.target not in valid_targets:
        raise HTTPException(
            status_code=400, detail=f"invalid target; must be one of {sorted(valid_targets)}"
        )
    record = sim.inject_fault(
        fault_type=req.type,
        target=req.target,
        start_step=req.start_step,
        duration=req.duration,
        severity=req.severity,
        metadata=req.metadata,
    )
    deps.get_repository().save_fault(sim_id, record)
    return FaultResponse(
        fault_id=record.fault_id,
        type=record.type,
        target=record.target_component,
        start_step=record.start_step,
        end_step=record.end_step,
        severity=record.severity,
        metadata=record.metadata,
    )


@router.get("/simulations/{sim_id}/state", response_model=StateResponse)
def get_state(sim_id: str) -> StateResponse:
    sim = _get_sim(sim_id)
    s = sim.state
    return StateResponse(
        simulation_id=sim.id,
        step=s.step,
        timestamp=s.timestamp,
        position_x=s.position_x,
        position_y=s.position_y,
        altitude=s.altitude,
        velocity=s.velocity,
        heading=s.heading,
        pitch=s.pitch,
        roll=s.roll,
        system_mode=s.system_mode.value,
        last_action=s.last_action.value if s.last_action else None,
    )


@router.get("/simulations/{sim_id}/events", response_model=list[EventResponse])
def get_events(sim_id: str) -> list[EventResponse]:
    sim = _get_sim(sim_id)
    return [
        EventResponse(
            event_id=e.event_id,
            step=e.step,
            timestamp=e.timestamp,
            component=e.component,
            type=e.type.value,
            severity=e.severity.value,
            message=e.message,
            metadata=e.metadata,
        )
        for e in sim.events.all()
    ]


def reset_state_for_tests() -> None:
    deps.reset_state_for_tests()
