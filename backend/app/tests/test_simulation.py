from app.domain.enums import FaultType, SystemMode
from app.simulation.orchestrator import Simulation


def test_normal_run_produces_decisions():
    sim = Simulation("sim1", seed=1)
    records = sim.run(5)
    assert len(records) == 5
    for r in records:
        assert r.decision.final_action is not None
    assert sim.state.step == 5


def test_determinism_same_seed():
    a = Simulation("a", seed=7)
    b = Simulation("b", seed=7)
    a_actions = [r.decision.final_action for r in a.run(10)]
    b_actions = [r.decision.final_action for r in b.run(10)]
    assert a_actions == b_actions


def test_data_loss_triggers_safe_mode():
    sim = Simulation("safe", seed=3)
    sim.inject_fault(FaultType.DATA_LOSS, "sensor", start_step=1, duration=5)
    records = sim.run(3)
    modes = [r.decision.system_mode for r in records]
    assert any(m in (SystemMode.SAFE_MODE, SystemMode.FAILED) for m in modes)


def test_controller_timeout_fault_excluded_in_voting():
    sim = Simulation("timeout", seed=2)
    sim.inject_fault(
        FaultType.CONTROLLER_TIMEOUT,
        "controller_b",
        start_step=1,
        duration=10,
        metadata={"delay_ms": 500.0},
    )
    record = sim.step()
    rejected = record.vote.rejected_controllers
    assert "controller_b" in rejected


def test_events_logged_at_each_step():
    sim = Simulation("ev", seed=11)
    sim.run(2)
    types = {e.type.value for e in sim.events.all()}
    assert {"SENSOR", "CONTROLLER", "VOTE", "DECISION", "STATE"}.issubset(types)


def test_full_pipeline_end_to_end_with_fault():
    sim = Simulation("e2e", seed=5)
    sim.inject_fault(FaultType.SENSOR_DRIFT, "sensor", start_step=2, duration=10, metadata={"magnitude": 5.0})
    sim.inject_fault(FaultType.CONTROLLER_BIAS, "controller_b", start_step=3, duration=10, metadata={"offset": 60.0})
    records = sim.run(10)
    assert len(records) == 10
    final_mode = records[-1].decision.system_mode
    assert final_mode in SystemMode
