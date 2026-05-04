from app.domain.enums import Action, SensorStatus
from app.domain.models import SensorReading
from app.simulation.controllers import (
    BalancedController,
    ConservativeController,
    ResponsiveController,
)


def _reading(altitude=1000.0, velocity=120.0, status=SensorStatus.OK, confidence=1.0):
    return SensorReading(
        reading_id="r1",
        step=1,
        altitude=altitude,
        velocity=velocity,
        heading=90.0,
        pitch=0.0,
        roll=0.0,
        confidence=confidence,
        status=status,
        fault_flags=[],
    )


def test_conservative_holds_at_target():
    c = ConservativeController()
    out = c.evaluate(_reading(), [])
    assert out.action == Action.HOLD
    assert out.valid


def test_responsive_reacts_quickly():
    c = ResponsiveController()
    out = c.evaluate(_reading(altitude=1010.0), [])
    assert out.action == Action.DESCEND


def test_conservative_ignores_small_drift():
    c = ConservativeController()
    out = c.evaluate(_reading(altitude=1010.0), [])
    assert out.action == Action.HOLD


def test_balanced_descends_on_significant_drift():
    c = BalancedController()
    out = c.evaluate(_reading(altitude=1030.0), [])
    assert out.action == Action.DESCEND


def test_invalid_sensor_yields_invalid_output():
    c = ConservativeController()
    out = c.evaluate(_reading(status=SensorStatus.INVALID, confidence=0.0), [])
    assert not out.valid
    assert out.action == Action.HOLD


def test_determinism():
    c = BalancedController()
    a = c.evaluate(_reading(altitude=1050.0), [])
    b = c.evaluate(_reading(altitude=1050.0), [])
    assert a.action == b.action
    assert a.confidence == b.confidence
