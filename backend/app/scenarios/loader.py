"""YAML scenario loader (Phase 5.2).

Reads a YAML document, validates it against a pydantic model that
mirrors ``schema.yaml``, and converts it into the existing
``Scenario`` dataclass that the registry already understands.

The pydantic model is the source of truth for validation. Errors
surface through ``pydantic.ValidationError`` and the API layer
(Phase 5.3) renders them as 422 with field-level detail.
"""

from __future__ import annotations

from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator

from ..domain.enums import FaultSeverity, FaultType, SystemMode
from .models import Scenario, ScenarioFault, ScenarioInitialState

_VALID_TARGETS = {"sensor", "controller_a", "controller_b", "controller_c", "gps"}


class _InitialStateModel(BaseModel):
    altitude: float | None = None
    velocity: float | None = None
    heading: float | None = None


class _WaypointModel(BaseModel):
    x: float
    y: float
    altitude: float
    velocity: float
    capture_radius: float = 25.0


class _FaultModel(BaseModel):
    type: FaultType
    target: str
    start_step: int = Field(ge=0)
    duration: int | None = Field(default=None, ge=1)
    severity: FaultSeverity = FaultSeverity.WARNING
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("target")
    @classmethod
    def _check_target(cls, v: str) -> str:
        if v not in _VALID_TARGETS:
            raise ValueError(f"invalid target {v!r}; must be one of {sorted(_VALID_TARGETS)}")
        return v


class ScenarioFile(BaseModel):
    """The YAML scenario contract."""

    name: str = Field(min_length=1, max_length=64)
    description: str = ""
    expected_behavior: str = ""
    seed: int = Field(ge=0)
    steps: int = Field(ge=1, le=1000)
    initial_state: _InitialStateModel = Field(default_factory=_InitialStateModel)
    faults: list[_FaultModel] = Field(default_factory=list)
    waypoints: list[_WaypointModel] = Field(default_factory=list)
    expected_final_modes: list[SystemMode] = Field(default_factory=list)

    def to_scenario(self) -> Scenario:
        return Scenario(
            name=self.name,
            description=self.description,
            expected_behavior=self.expected_behavior,
            seed=self.seed,
            steps=self.steps,
            initial_state=ScenarioInitialState(
                altitude=self.initial_state.altitude,
                velocity=self.initial_state.velocity,
                heading=self.initial_state.heading,
            ),
            faults=[
                ScenarioFault(
                    type=f.type,
                    target=f.target,
                    start_step=f.start_step,
                    duration=f.duration,
                    severity=f.severity,
                    metadata=dict(f.metadata),
                )
                for f in self.faults
            ],
            expected_final_modes=list(self.expected_final_modes),
        )


def parse_yaml(payload: str) -> Scenario:
    """Parse a YAML document into a Scenario.

    Raises:
        yaml.YAMLError: payload is not valid YAML.
        pydantic.ValidationError: payload does not match the schema.
    """

    data = yaml.safe_load(payload)
    if not isinstance(data, dict):
        raise ValueError("scenario document must be a YAML mapping")
    return ScenarioFile.model_validate(data).to_scenario()
