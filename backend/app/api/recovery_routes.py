from fastapi import APIRouter

from ..core.canonical import fingerprint
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


@router.get("/simulations/{sim_id}/trajectory")
def get_trajectory(sim_id: str) -> list[dict]:
    """Position-vs-time trajectory for the persisted simulation.

    Frontend trajectory map consumes this directly. See Phase 2.7.
    """

    repo = deps.get_repository()
    if repo.get_simulation(sim_id) is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")
    return repo.get_trajectory(sim_id)


@router.get("/simulations/{sim_id}/replay-fingerprint")
def get_replay_fingerprint(sim_id: str) -> dict:
    """Return the canonical SHA-256 fingerprint of the persisted timeline.

    Per RESEARCH.md §7 the kernel produces evidence and the UI reads
    it. The fingerprint is computed from the SQLite-backed timeline,
    not from any in-memory state, so two replays of the same scenario
    must agree even if the originating Simulation has been GC'd.
    """

    repo = deps.get_repository()
    if repo.get_simulation(sim_id) is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")
    timeline = repo.get_timeline(sim_id)
    return {
        "simulation_id": sim_id,
        "step_count": len(timeline),
        "fingerprint": fingerprint(timeline),
        "algorithm": "sha256",
    }
