from app.scenarios import all_scenarios, get_scenario, run_scenario


SCENARIO_NAMES = {s.name for s in all_scenarios()}


def test_six_scenarios_exist():
    expected = {
        "nominal_cruise",
        "single_controller_latency",
        "sensor_drift_recovery",
        "split_vote_escalation",
        "multi_fault_failure",
        "intermittent_fault",
    }
    assert expected.issubset(SCENARIO_NAMES)


def test_get_unknown_scenario_raises():
    import pytest
    from app.core.exceptions import ScenarioError

    with pytest.raises(ScenarioError):
        get_scenario("does_not_exist")


def test_nominal_cruise_stays_normal():
    _, result = run_scenario("nominal_cruise")
    assert result.final_mode.value == "NORMAL"
    assert result.steps_run > 0
    assert result.decision_counts.get("NORMAL", 0) == result.steps_run


def test_split_vote_scenario_enters_safe_mode_or_failed():
    _, result = run_scenario("split_vote_escalation")
    assert result.final_mode.value in {"SAFE_MODE", "FAILED", "DEGRADED"}


def test_multi_fault_scenario_escalates():
    _, result = run_scenario("multi_fault_failure")
    assert result.final_mode.value in {"SAFE_MODE", "FAILED"}


def test_scenarios_are_deterministic():
    _, a = run_scenario("sensor_drift_recovery")
    _, b = run_scenario("sensor_drift_recovery")
    # Same scenario must produce the same decision-mode timeline.
    assert a.decision_counts == b.decision_counts
    assert [t["mode"] for t in a.mode_transitions] == [t["mode"] for t in b.mode_transitions]


def test_run_scenario_with_step_override():
    _, result = run_scenario("nominal_cruise", steps_override=3)
    assert result.steps_run == 3
