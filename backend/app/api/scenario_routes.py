from dataclasses import asdict

import yaml
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError

from ..core.exceptions import ScenarioError
from ..scenarios import all_scenarios, get_scenario, run_scenario
from ..scenarios.loader import parse_yaml
from ..scenarios.registry import (
    is_builtin,
    register_user_scenario,
    unregister_user_scenario,
)
from . import dependencies as deps


class ScenarioRunOverrides(BaseModel):
    """Optional run-time override block (Phase 5.4).

    seed: replace the scenario's root seed for this run.
    fault_metadata: index -> {key: value} merged over each fault's
                    declared metadata.
    """

    seed: int | None = Field(default=None, ge=0)
    fault_metadata: dict[int, dict] = Field(default_factory=dict)


router = APIRouter()


def _scenario_to_dict(scenario) -> dict:
    d = asdict(scenario)
    d["faults"] = [
        {**f, "type": f["type"].value, "severity": f["severity"].value} for f in d["faults"]
    ]
    d["expected_final_modes"] = [m.value for m in scenario.expected_final_modes]
    return d


@router.get("/scenarios")
def list_scenarios() -> list[dict]:
    return [_scenario_to_dict(s) for s in all_scenarios()]


@router.get("/scenarios/{name}")
def get_scenario_detail(name: str) -> dict:
    out = _scenario_to_dict(get_scenario(name))
    out["builtin"] = is_builtin(name)
    return out


@router.post("/scenarios", status_code=201, response_model=None)
async def create_scenario(request: Request) -> dict | JSONResponse:
    """Register a new scenario from a YAML body (Phase 5.3).

    Accepts ``Content-Type: text/yaml`` (or anything that parses as
    YAML); pydantic.ValidationError surfaces as 422 with field-level
    detail. Built-in scenario names cannot be overridden.
    """

    body = await request.body()
    if not body:
        return JSONResponse(status_code=400, content={"detail": "empty request body"})
    try:
        scenario = parse_yaml(body.decode())
    except yaml.YAMLError as exc:
        return JSONResponse(status_code=422, content={"detail": f"invalid YAML: {exc}"})
    except ValidationError as exc:
        return JSONResponse(status_code=422, content={"detail": exc.errors()})
    except ValueError as exc:
        return JSONResponse(status_code=422, content={"detail": str(exc)})
    register_user_scenario(scenario)
    out = _scenario_to_dict(scenario)
    out["builtin"] = False
    return out


@router.delete("/scenarios/{name}", status_code=204, response_model=None)
def delete_scenario(name: str) -> JSONResponse:
    """Remove a user-registered scenario. Built-ins are immutable."""

    unregister_user_scenario(name)
    return JSONResponse(status_code=204, content=None)


@router.post("/scenarios/{name}/run")
def run_scenario_default(name: str, overrides: ScenarioRunOverrides | None = None) -> dict:
    return _execute(name, None, overrides)


@router.post("/scenarios/{name}/run/{steps}")
def run_scenario_with_steps(
    name: str,
    steps: int,
    overrides: ScenarioRunOverrides | None = None,
) -> dict:
    if steps <= 0 or steps > 500:
        raise ScenarioError("steps must be between 1 and 500")
    return _execute(name, steps, overrides)


def _execute(name: str, steps: int | None, overrides: ScenarioRunOverrides | None) -> dict:
    sim, result = run_scenario(
        name,
        steps,
        seed_override=overrides.seed if overrides else None,
        fault_metadata_overrides=overrides.fault_metadata if overrides else None,
    )
    deps.get_registry()[sim.id] = sim
    repo = deps.get_repository()
    repo.create_simulation(sim)
    for f in sim.faults.all():
        repo.save_fault(sim.id, f)
    for r in sim.step_history:
        repo.save_step(sim.id, r)
    out = asdict(result)
    out["final_mode"] = result.final_mode.value
    return out
