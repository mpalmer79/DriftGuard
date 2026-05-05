"""Tests for the Clock abstraction (Phase 1.2)."""

import pytest

from app.core.time import FrozenClock, SimulationClock, SystemClock


def test_simulation_clock_advances_deterministically():
    c = SimulationClock(dt=0.1)
    assert c.now == 0.0
    assert c.tick() == pytest.approx(0.1)
    assert c.tick() == pytest.approx(0.2)


def test_simulation_clock_reset():
    c = SimulationClock(dt=1.0, now=5.0)
    c.reset()
    assert c.now == 0.0


def test_system_clock_returns_a_float():
    value = SystemClock().now()
    assert isinstance(value, float)
    assert value > 0.0


def test_frozen_clock_constant():
    c = FrozenClock(42.0)
    assert c.now() == 42.0
    assert c.now() == 42.0  # repeatable


def test_frozen_clock_sequence_advances():
    c = FrozenClock([1.0, 2.0, 3.0])
    assert c.now() == 1.0
    assert c.now() == 2.0
    assert c.now() == 3.0


def test_frozen_clock_sequence_exhaustion_raises():
    c = FrozenClock([1.0])
    c.now()
    with pytest.raises(RuntimeError):
        c.now()
