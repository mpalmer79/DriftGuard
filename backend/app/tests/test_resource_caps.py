"""Per-simulation resource caps (Phase 8.4)."""

from __future__ import annotations

import pytest

from app.core.exceptions import CapacityError
from app.domain.enums import FaultType
from app.simulation.orchestrator import Simulation


def test_step_cap_raises_capacity_error(monkeypatch):
    sim = Simulation("cap-step", seed=1)
    # Pin the cap low for the test so we don't burn 10k steps.
    monkeypatch.setattr(Simulation, "MAX_STEPS", 3)
    sim.run(3)
    with pytest.raises(CapacityError):
        sim.step()


def test_fault_cap_raises_capacity_error(monkeypatch):
    sim = Simulation("cap-fault", seed=1)
    monkeypatch.setattr(Simulation, "MAX_FAULTS", 2)
    sim.inject_fault(FaultType.SENSOR_DRIFT, "sensor", duration=5)
    sim.inject_fault(FaultType.SENSOR_DRIFT, "sensor", duration=5)
    with pytest.raises(CapacityError):
        sim.inject_fault(FaultType.SENSOR_DRIFT, "sensor", duration=5)


def test_caps_default_to_documented_values():
    assert Simulation.MAX_STEPS == 10_000
    assert Simulation.MAX_FAULTS == 100


def test_step_cap_message_mentions_value(monkeypatch):
    monkeypatch.setattr(Simulation, "MAX_STEPS", 1)
    sim = Simulation("cap-msg", seed=1)
    sim.step()
    with pytest.raises(CapacityError, match="step cap"):
        sim.step()
