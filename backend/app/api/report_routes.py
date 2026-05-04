from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from ..core.exceptions import NotFoundError
from ..reporting import build_report, render_markdown
from . import dependencies as deps

router = APIRouter()


def _build(sim_id: str) -> dict:
    repo = deps.get_repository()
    if repo.get_simulation(sim_id) is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")
    return build_report(repo, sim_id)


@router.get("/simulations/{sim_id}/report")
def get_report(sim_id: str) -> dict:
    return _build(sim_id)


@router.get("/simulations/{sim_id}/report/json")
def get_report_json(sim_id: str) -> dict:
    return _build(sim_id)


@router.get("/simulations/{sim_id}/report/markdown", response_class=PlainTextResponse)
def get_report_markdown(sim_id: str) -> str:
    return render_markdown(_build(sim_id))
