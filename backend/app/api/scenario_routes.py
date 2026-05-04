from dataclasses import asdict

from fastapi import APIRouter

from ..core.exceptions import ScenarioError
from ..scenarios import all_scenarios, get_scenario, run_scenario
from . import dependencies as deps

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
    return _scenario_to_dict(get_scenario(name))


@router.post("/scenarios/{name}/run")
def run_scenario_default(name: str) -> dict:
    return _execute(name, None)


@router.post("/scenarios/{name}/run/{steps}")
def run_scenario_with_steps(name: str, steps: int) -> dict:
    if steps <= 0 or steps > 500:
        raise ScenarioError("steps must be between 1 and 500")
    return _execute(name, steps)


def _execute(name: str, steps: int | None) -> dict:
    sim, result = run_scenario(name, steps)
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
