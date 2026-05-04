from fastapi import APIRouter

from ..core.exceptions import NotFoundError
from . import dependencies as deps

router = APIRouter()


@router.get("/simulations")
def list_simulations() -> list[dict]:
    return deps.get_repository().list_simulations()


@router.get("/simulations/{sim_id}")
def get_simulation(sim_id: str) -> dict:
    repo = deps.get_repository()
    row = repo.get_simulation(sim_id)
    if row is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")
    latest = repo.get_latest_state(sim_id)
    faults = repo.get_faults(sim_id)
    decisions = repo.get_decisions(sim_id)
    return {
        "simulation": row,
        "latest_state": latest,
        "step_count": len(decisions),
        "faults": faults,
        "in_memory": sim_id in deps.get_registry(),
    }


@router.get("/simulations/{sim_id}/decisions")
def get_decisions(sim_id: str) -> list[dict]:
    repo = deps.get_repository()
    if repo.get_simulation(sim_id) is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")
    return repo.get_decisions(sim_id)


@router.get("/simulations/{sim_id}/faults")
def get_faults(sim_id: str) -> list[dict]:
    repo = deps.get_repository()
    if repo.get_simulation(sim_id) is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")
    return repo.get_faults(sim_id)


@router.get("/simulations/{sim_id}/timeline")
def get_timeline(sim_id: str) -> list[dict]:
    repo = deps.get_repository()
    if repo.get_simulation(sim_id) is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")
    return repo.get_timeline(sim_id)
