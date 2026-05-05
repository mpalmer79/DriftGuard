from app.domain.enums import Action, HealthStatus, SensorStatus, VoteOutcome
from app.domain.models import ControllerOutput, SensorReading, VoteResult
from app.simulation.health import TrustDetector


def _reading(status=SensorStatus.OK, confidence=1.0):
    return SensorReading(
        reading_id="r",
        step=1,
        altitude=1000,
        velocity=120,
        heading=0,
        pitch=0,
        roll=0,
        confidence=confidence,
        status=status,
        fault_flags=[],
    )


def _out(cid="controller_a", valid=True, rt=10.0):
    return ControllerOutput(
        controller_id=cid,
        step=1,
        action=Action.HOLD,
        confidence=0.8,
        reason_code="X",
        response_time_ms=rt,
        valid=valid,
    )


def _vote(outcome=VoteOutcome.CONSENSUS):
    return VoteResult(
        outcome=outcome,
        selected_action=Action.HOLD if outcome == VoteOutcome.CONSENSUS else None,
        agreeing_controllers=[],
        rejected_controllers=[],
        reason="t",
    )


def test_repeated_invalid_escalates_to_critical():
    d = TrustDetector(
        latency_threshold_ms=50.0, critical_threshold=3, degraded_threshold=2, suspect_threshold=1
    )
    for _ in range(3):
        d.update([_out(valid=False)], _vote(), _reading())
    assert d.state.components["controller_a"].status == HealthStatus.CRITICAL


def test_recovery_after_clean_streak():
    d = TrustDetector(
        latency_threshold_ms=50.0,
        critical_threshold=2,
        degraded_threshold=2,
        suspect_threshold=1,
        recovery_steps=2,
    )
    for _ in range(2):
        d.update([_out(valid=False)], _vote(), _reading())
    assert d.state.components["controller_a"].status in (
        HealthStatus.DEGRADED,
        HealthStatus.CRITICAL,
    )
    for _ in range(2):
        d.update([_out(valid=True)], _vote(), _reading())
    assert d.state.components["controller_a"].status == HealthStatus.RECOVERING
    for _ in range(4):
        d.update([_out(valid=True)], _vote(), _reading())
    assert d.state.components["controller_a"].status == HealthStatus.HEALTHY


def test_temporary_fault_does_not_poison_permanently():
    d = TrustDetector(latency_threshold_ms=50.0, recovery_steps=2)
    d.update([_out(valid=False)], _vote(), _reading())
    for _ in range(6):
        d.update([_out(valid=True)], _vote(), _reading())
    assert d.state.components["controller_a"].status in (
        HealthStatus.HEALTHY,
        HealthStatus.RECOVERING,
    )


def test_disagreement_window_tracks_recent_outcomes():
    d = TrustDetector(latency_threshold_ms=50.0, window=4)
    for outcome in (VoteOutcome.SPLIT, VoteOutcome.SPLIT, VoteOutcome.CONSENSUS, VoteOutcome.SPLIT):
        d.update([_out()], _vote(outcome), _reading())
    assert 0.0 <= d.disagreement_rate() <= 1.0
    assert d.disagreement_rate() == 0.75


def test_snapshot_contains_all_components():
    d = TrustDetector(latency_threshold_ms=50.0)
    snap = d.snapshot()
    assert "controller_a" in snap
    assert "controller_b" in snap
    assert "controller_c" in snap
    assert "sensor" in snap
    assert "_global" in snap


def test_repeat_count_speeds_up_escalation():
    d = TrustDetector(latency_threshold_ms=50.0, suspect_threshold=2, recovery_steps=2)
    # First fault streak resolves
    for _ in range(2):
        d.update([_out(valid=False)], _vote(), _reading())
    for _ in range(4):
        d.update([_out(valid=True)], _vote(), _reading())
    # Second occurrence: a single misbehave should already escalate
    d.update([_out(valid=False)], _vote(), _reading())
    h = d.state.components["controller_a"]
    assert h.repeat_count >= 1


# --- Phase 5.3: renamed component-level helpers + readability ---


def test_unhealthy_components_includes_sensor_when_degraded():
    """Phase 5.3: TrustDetector tracks the sensor too, so the helper
    is named `unhealthy_components` (not `unhealthy_controllers`).

    Co-named methods on FaultDetector return a controller-only set;
    the rename + docstring make the semantic difference explicit.
    """

    d = TrustDetector(
        latency_threshold_ms=50.0,
        suspect_threshold=1,
        degraded_threshold=2,
        critical_threshold=3,
    )
    # Push the sensor into DEGRADED via repeated low-confidence reads.
    for _ in range(2):
        d.update([_out()], _vote(), _reading(status=SensorStatus.INVALID, confidence=0.0))
    components = d.unhealthy_components()
    assert "sensor" in components


def test_critical_components_includes_sensor_when_critical():
    d = TrustDetector(
        latency_threshold_ms=50.0,
        suspect_threshold=1,
        degraded_threshold=2,
        critical_threshold=3,
    )
    for _ in range(3):
        d.update([_out()], _vote(), _reading(status=SensorStatus.INVALID, confidence=0.0))
    assert "sensor" in d.critical_components()


def test_renamed_methods_distinguish_controllers_from_components():
    """Sanity: the controller-only helper and the component-level
    helper are reachable side-by-side. Both names live on the class."""

    d = TrustDetector(latency_threshold_ms=50.0)
    # `degraded_controllers` is the controller-only legacy helper.
    assert d.degraded_controllers() == []
    # `unhealthy_components` and `critical_components` are the new,
    # accurately-named component-level helpers.
    assert d.unhealthy_components() == []
    assert d.critical_components() == []


def test_recovery_gate_or_clause_handles_suspect_and_recovering():
    """Phase 5.3 readability: the (and ... or ... and) gate that
    promotes SUSPECT or long-RECOVERING components back to HEALTHY
    is now parenthesised explicitly. Pin the behaviour both ways:

    - A controller that hits SUSPECT and stays clean for
      recovery_steps must promote to HEALTHY.
    - A controller that hits CRITICAL must transit RECOVERING and
      stay clean for ``2 * recovery_steps`` to reach HEALTHY.
    """

    d = TrustDetector(
        latency_threshold_ms=50.0,
        suspect_threshold=1,
        degraded_threshold=2,
        critical_threshold=3,
        recovery_steps=2,
    )
    # SUSPECT path
    d.update([_out(valid=False)], _vote(), _reading())
    assert d.state.components["controller_a"].status == HealthStatus.SUSPECT
    for _ in range(2):
        d.update([_out(valid=True)], _vote(), _reading())
    assert d.state.components["controller_a"].status == HealthStatus.HEALTHY

    # CRITICAL → RECOVERING → HEALTHY path (needs 2 * recovery_steps)
    for _ in range(3):
        d.update([_out(valid=False)], _vote(), _reading())
    assert d.state.components["controller_a"].status == HealthStatus.CRITICAL
    for _ in range(2):
        d.update([_out(valid=True)], _vote(), _reading())
    assert d.state.components["controller_a"].status == HealthStatus.RECOVERING
    for _ in range(2):
        d.update([_out(valid=True)], _vote(), _reading())
    assert d.state.components["controller_a"].status == HealthStatus.HEALTHY
