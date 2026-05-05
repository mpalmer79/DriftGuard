"""Scenario YAML loader tests (Phase 5.2)."""

import pytest
from pydantic import ValidationError

from app.domain.enums import FaultType, SystemMode
from app.scenarios.loader import ScenarioFile, parse_yaml

_MINIMAL = """
name: minimal
description: ""
expected_behavior: ""
seed: 1
steps: 5
"""


_FULL = """
name: full
description: An end-to-end YAML scenario.
expected_behavior: Stays in NORMAL.
seed: 42
steps: 8
initial_state:
  altitude: 1500.0
  velocity: 110.0
faults:
  - type: SENSOR_DRIFT
    target: sensor
    start_step: 2
    duration: 3
    severity: WARNING
    metadata:
      magnitude: 4.0
  - type: GPS_DENIED
    target: gps
    start_step: 4
    duration: 4
expected_final_modes:
  - NORMAL
  - DEGRADED
"""


def test_parse_minimal_scenario():
    scenario = parse_yaml(_MINIMAL)
    assert scenario.name == "minimal"
    assert scenario.seed == 1
    assert scenario.steps == 5
    assert scenario.faults == []


def test_parse_full_scenario():
    scenario = parse_yaml(_FULL)
    assert scenario.name == "full"
    assert scenario.initial_state.altitude == 1500.0
    assert len(scenario.faults) == 2
    types = {f.type for f in scenario.faults}
    assert {FaultType.SENSOR_DRIFT, FaultType.GPS_DENIED} == types
    assert SystemMode.NORMAL in scenario.expected_final_modes


def test_invalid_target_rejected():
    bad = """
name: bad
description: ""
expected_behavior: ""
seed: 1
steps: 5
faults:
  - type: SENSOR_DRIFT
    target: not_a_real_target
    start_step: 0
"""
    with pytest.raises(ValidationError):
        parse_yaml(bad)


def test_steps_out_of_range_rejected():
    bad = """
name: too_long
description: ""
expected_behavior: ""
seed: 1
steps: 9999
"""
    with pytest.raises(ValidationError):
        parse_yaml(bad)


def test_zero_steps_rejected():
    bad = """
name: zero
description: ""
expected_behavior: ""
seed: 1
steps: 0
"""
    with pytest.raises(ValidationError):
        parse_yaml(bad)


def test_negative_seed_rejected():
    bad = """
name: neg
description: ""
expected_behavior: ""
seed: -1
steps: 5
"""
    with pytest.raises(ValidationError):
        parse_yaml(bad)


def test_unknown_fault_type_rejected():
    bad = """
name: unknown
description: ""
expected_behavior: ""
seed: 1
steps: 5
faults:
  - type: NOT_A_REAL_FAULT
    target: sensor
    start_step: 0
"""
    with pytest.raises(ValidationError):
        parse_yaml(bad)


def test_non_mapping_payload_rejected():
    with pytest.raises(ValueError):
        parse_yaml("- a\n- b\n")


def test_scenario_file_round_trips_through_to_scenario():
    sf = ScenarioFile.model_validate(
        {
            "name": "rt",
            "description": "",
            "expected_behavior": "",
            "seed": 7,
            "steps": 3,
        }
    )
    s = sf.to_scenario()
    assert s.name == "rt"
    assert s.seed == 7
