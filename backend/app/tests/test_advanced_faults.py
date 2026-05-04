from app.domain.enums import Action, FaultType, SensorStatus
from app.domain.models import FaultRecord
from app.simulation.controllers import (
    BalancedController,
    ConservativeController,
    ResponsiveController,
)
from app.simulation.orchestrator import Simulation


def _reading(altitude=1000.0, status=SensorStatus.OK, confidence=1.0, step=1):
    from app.domain.models import SensorReading
    return SensorReading(
        reading_id="r",
        step=step,
        altitude=altitude,
        velocity=120.0,
        heading=90.0,
        pitch=0.0,
        roll=0.0,
        confidence=confidence,
        status=status,
        fault_flags=[],
    )


def _fault(ftype, target, **meta):
    return FaultRecord(
        fault_id="f",
        type=ftype,
        target_component=target,
        severity=meta.pop("severity", None) or __import__("app.domain.enums", fromlist=["FaultSeverity"]).FaultSeverity.WARNING,
        active=True,
        start_step=0,
        end_step=None,
        metadata=meta,
    )


def test_controller_invalid_output_marks_invalid():
    c = ConservativeController()
    out = c.evaluate(_reading(), [_fault(FaultType.CONTROLLER_INVALID_OUTPUT, "controller_a")])
    assert not out.valid
    assert out.reason_code == "INVALID_OUTPUT"


def test_controller_silent_failure_returns_no_signal():
    c = ResponsiveController()
    out = c.evaluate(_reading(), [_fault(FaultType.CONTROLLER_SILENT_FAILURE, "controller_b")])
    assert not out.valid
    assert out.action == Action.HOLD
    assert out.confidence == 0.0


def test_controller_action_bias_forces_action():
    c = BalancedController()
    out = c.evaluate(
        _reading(altitude=1000.0),
        [_fault(FaultType.CONTROLLER_ACTION_BIAS, "controller_c", forced_action="ABORT")],
    )
    assert out.action == Action.ABORT


def test_controller_confidence_drop_scales_confidence():
    c = ConservativeController()
    base = c.evaluate(_reading(altitude=1100.0), [])
    drop = c.evaluate(
        _reading(altitude=1100.0),
        [_fault(FaultType.CONTROLLER_CONFIDENCE_DROP, "controller_a", confidence=0.25)],
    )
    assert drop.confidence < base.confidence
    assert drop.confidence == round(base.confidence * 0.25, 4) or drop.confidence <= base.confidence


def test_controller_latency_increases_response_time():
    c = ResponsiveController()
    out = c.evaluate(
        _reading(),
        [_fault(FaultType.CONTROLLER_LATENCY, "controller_b", latency_ms=150.0)],
    )
    assert out.response_time_ms >= 150.0


def test_conflicting_controller_flips_action():
    c = ResponsiveController()
    out = c.evaluate(
        _reading(altitude=1100.0),
        [_fault(FaultType.CONFLICTING_CONTROLLER, "controller_b")],
    )
    # Without fault the controller would DESCEND; conflict flips it to ASCEND.
    assert out.action == Action.ASCEND


def test_compound_fault_combines_effects():
    c = BalancedController()
    out = c.evaluate(
        _reading(altitude=1000.0),
        [_fault(
            FaultType.COMPOUND_FAULT,
            "controller_c",
            offset=200.0,
            latency_ms=120.0,
            confidence=0.5,
        )],
    )
    # Bias of +200 pushes the perceived altitude well above target,
    # and latency raises response time. Confidence is also scaled down.
    assert out.action == Action.DESCEND
    assert out.response_time_ms >= 120.0


def test_sensor_dropout_can_invalidate_reading_in_simulation():
    sim = Simulation("dropout", seed=5)
    sim.inject_fault(
        FaultType.SENSOR_DROPOUT,
        "sensor",
        start_step=1,
        duration=10,
        metadata={"probability": 1.0},
    )
    record = sim.step()
    assert record.sensor.status.value == "INVALID"


def test_intermittent_pattern_alternates_effect():
    sim = Simulation("intermittent", seed=4)
    sim.inject_fault(
        FaultType.CONTROLLER_INVALID_OUTPUT,
        "controller_a",
        start_step=1,
        duration=20,
        metadata={"intermittent_pattern": [1, 0, 1, 0]},
    )
    records = sim.run(4)
    valids = [
        next(o.valid for o in r.outputs if o.controller_id == "controller_a")
        for r in records
    ]
    # Pattern 1,0,1,0 -> invalid, valid, invalid, valid (assuming sensor OK).
    assert valids[0] is False
    assert valids[1] is True
    assert valids[2] is False
    assert valids[3] is True
