"""Unit tests for the mission-report risk assessor (Phase 10).

`assess_risk` is the small heuristic that turns a persisted timeline into
a single risk band. Every branch should be reachable from a hand-built
input so the report stays predictable across refactors.
"""

from app.reporting.risk import assess_risk


def _decision(step: int, mode: str = "NORMAL") -> dict:
    return {"step": step, "system_mode": mode, "final_action": "HOLD"}


def _event(severity: str = "INFO") -> dict:
    return {"severity": severity, "type": "VOTE", "step": 0}


def test_empty_decisions_returns_unknown():
    out = assess_risk([], [], [])
    assert out["level"] == "UNKNOWN"
    assert "no decisions" in out["summary"]


def test_final_failed_is_high_risk():
    decisions = [_decision(0, "NORMAL"), _decision(1, "FAILED")]
    out = assess_risk(decisions, [], [])
    assert out["level"] == "HIGH"
    assert "FAILED" in out["summary"]


def test_any_failed_step_is_high_even_if_final_recovered():
    decisions = [
        _decision(0, "NORMAL"),
        _decision(1, "FAILED"),
        _decision(2, "DEGRADED"),
    ]
    out = assess_risk(decisions, [], [])
    assert out["level"] == "HIGH"


def test_final_safe_mode_is_elevated():
    decisions = [_decision(0, "NORMAL"), _decision(1, "SAFE_MODE")]
    out = assess_risk(decisions, [], [])
    assert out["level"] == "ELEVATED"


def test_long_safe_mode_dwell_is_elevated_even_if_recovered():
    # 4 SAFE_MODE steps out of 12 trips the dwell threshold (max(3, 12//4) == 3).
    decisions = (
        [_decision(i, "NORMAL") for i in range(8)]
        + [_decision(8 + i, "SAFE_MODE") for i in range(4)]
    )
    decisions[-1] = _decision(decisions[-1]["step"], "NORMAL")  # final mode is back to NORMAL
    out = assess_risk(decisions, [], [])
    assert out["level"] == "ELEVATED"


def test_critical_events_only_is_moderate():
    decisions = [_decision(0, "NORMAL"), _decision(1, "DEGRADED")]
    out = assess_risk(decisions, [], [_event("CRITICAL"), _event("INFO")])
    assert out["level"] == "MODERATE"
    assert "1 critical events" in out["summary"]


def test_contained_faults_are_low():
    decisions = [_decision(0, "NORMAL"), _decision(1, "DEGRADED")]
    faults = [{"type": "SENSOR_DRIFT", "target_component": "sensor"}]
    out = assess_risk(decisions, faults, [])
    assert out["level"] == "LOW"
    assert "DEGRADED" in out["summary"]


def test_no_faults_no_critical_is_nominal():
    decisions = [_decision(i, "NORMAL") for i in range(5)]
    out = assess_risk(decisions, [], [])
    assert out["level"] == "NOMINAL"
    assert "NORMAL" in out["summary"]


def test_high_outranks_elevated():
    """A single FAILED step beats any amount of SAFE_MODE dwell."""
    decisions = [_decision(i, "SAFE_MODE") for i in range(10)] + [_decision(10, "FAILED")]
    out = assess_risk(decisions, [], [])
    assert out["level"] == "HIGH"


def test_event_without_severity_is_ignored():
    """Events that have no severity field must not be miscounted as CRITICAL."""
    decisions = [_decision(0, "NORMAL")]
    out = assess_risk(decisions, [], [{"type": "VOTE"}])
    assert out["level"] == "NOMINAL"
