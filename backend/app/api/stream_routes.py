"""Server-Sent Events stream endpoint (Phase 7.5).

`GET /simulations/{id}/stream` runs the in-memory simulation forward
on demand and emits one SSE message per step. The client controls
the run with the ``steps`` query parameter (default: until step
limit) and ``speed`` (events per second, capped server-side).

The endpoint depends on the simulation being in the in-memory
registry (i.e. created via POST /simulations or one of the scenario
run endpoints). Persisted-only simulations don't have a live
orchestrator to step.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..core.exceptions import NotFoundError
from . import dependencies as deps

router = APIRouter()

_MAX_STEPS = 500
_MIN_DELAY_S = 0.005  # 200 events/s ceiling


def _step_event(record) -> str:
    """Serialize a StepRecord into an SSE message payload."""

    payload = {
        "step": record.state.step,
        "system_mode": record.state.system_mode.value,
        "final_action": record.decision.final_action.value,
        "altitude": record.state.altitude,
        "velocity": record.state.velocity,
        "heading": record.state.heading,
        "position_x": record.state.position_x,
        "position_y": record.state.position_y,
    }
    return f"event: step\ndata: {json.dumps(payload)}\n\n"


@router.get("/simulations/{sim_id}/stream")
async def stream_simulation(
    sim_id: str,
    steps: int = 50,
    speed: float = 5.0,
) -> StreamingResponse:
    """Run the simulation forward and stream one SSE message per step.

    - ``steps`` clamped to [1, 500].
    - ``speed`` is events per second; clamped to [1, 200].
    """

    sim = deps.get_registry().get(sim_id)
    if sim is None:
        raise NotFoundError(f"simulation '{sim_id}' not found")

    steps = max(1, min(_MAX_STEPS, int(steps)))
    speed = max(1.0, min(200.0, float(speed)))
    delay = max(_MIN_DELAY_S, 1.0 / speed)

    repo = deps.get_repository()

    async def gen() -> AsyncIterator[str]:
        for _ in range(steps):
            record = sim.step()
            repo.save_step(sim_id, record)
            yield _step_event(record)
            if delay > 0.0:
                await asyncio.sleep(delay)
        yield "event: end\ndata: {}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
