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
    """Position-vs-time trajectory for the persisted simulation (Phase 2.7)."""

    repo = deps.get_repository()
    if repo.get_simulation(sim_id) is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")
    return repo.get_trajectory(sim_id)


@router.get("/simulations/{sim_id}/trust")
def get_trust_history(sim_id: str) -> list[dict]:
    """Per-step TrustDetector snapshots in step order.

    Each entry: ``{"step": int, "snapshot": {component_id: {...},
    "_global": {"disagreement_rate": float}}}``. Empty for runs persisted
    before the ``trust_snapshots`` table existed.
    """

    repo = deps.get_repository()
    if repo.get_simulation(sim_id) is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")
    return repo.get_trust_snapshots(sim_id)


@router.get("/simulations/{sim_id}/replay-fingerprint")
def get_replay_fingerprint(sim_id: str) -> dict:
    """SHA-256 fingerprint of the persisted timeline.

    Computed from the SQLite-backed timeline, not from any in-memory
    state, so two replays of the same scenario must agree even after
    the originating ``Simulation`` is GC'd.
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
