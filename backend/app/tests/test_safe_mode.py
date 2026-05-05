from app.domain.enums import Action, SensorStatus, SystemMode, VoteOutcome
from app.domain.models import SensorReading, VoteResult
from app.simulation.detection import FaultDetector
from app.simulation.safe_mode import SafeModeManager


def _reading(status=SensorStatus.OK):
    return SensorReading(
        reading_id="r",
        step=1,
        altitude=1000,
        velocity=120,
        heading=0,
        pitch=0,
        roll=0,
        confidence=1.0,
        status=status,
        fault_flags=[],
    )


def _vote(outcome):
    return VoteResult(
        outcome=outcome,
        selected_action=Action.HOLD if outcome == VoteOutcome.CONSENSUS else None,
        agreeing_controllers=[],
        rejected_controllers=[],
        reason="t",
    )


def test_safe_mode_on_split():
    m = SafeModeManager(FaultDetector(50.0, 3, 6, 2, 4))
    mode, _ = m.evaluate(_vote(VoteOutcome.SPLIT), _reading())
    assert mode == SystemMode.SAFE_MODE


def test_safe_mode_on_invalid_sensor():
    m = SafeModeManager(FaultDetector(50.0, 3, 6, 2, 4))
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading(SensorStatus.INVALID))
    assert mode == SystemMode.SAFE_MODE


def test_normal_when_healthy():
    m = SafeModeManager(FaultDetector(50.0, 3, 6, 2, 4))
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert mode == SystemMode.NORMAL


def test_failed_when_two_critical():
    d = FaultDetector(50.0, 3, 6, 2, 4)
    d.state.invalid_counts["controller_a"] = 5
    d.state.invalid_counts["controller_b"] = 5
    m = SafeModeManager(d)
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert mode == SystemMode.FAILED


def test_restrict_action_in_safe_mode():
    assert SafeModeManager.restrict_action(SystemMode.SAFE_MODE, Action.ASCEND) == Action.STABILIZE
    assert SafeModeManager.restrict_action(SystemMode.NORMAL, Action.ASCEND) == Action.ASCEND


# --- Phase 3.2: recovery hysteresis (ADR 0011 / I11) ---


def _force_critical(d: FaultDetector, ids: list[str]) -> None:
    """Push the named controllers into the FaultDetector's critical
    bucket so `_evaluate_proposed` returns FAILED."""

    for cid in ids:
        d.state.invalid_counts[cid] = 10


def test_escalation_is_immediate_no_streak_required():
    """Phase 3.2 — escalations bypass the cooldown.

    The whole point of hysteresis on de-escalation only is so a
    safety-critical fault can promote the mode in a single step.
    """

    d = FaultDetector(50.0, 3, 6, 2, 4)
    m = SafeModeManager(d, recovery_steps=5)
    # Healthy first.
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    m.transition(mode)
    assert mode == SystemMode.NORMAL

    # Now drive 2 controllers critical.
    _force_critical(d, ["controller_a", "controller_b"])
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert mode == SystemMode.FAILED  # immediate, no cooldown


def test_de_escalation_held_until_streak_completes():
    """SAFE_MODE → DEGRADED de-escalation requires `recovery_steps`
    consecutive proposals of the lower mode."""

    d = FaultDetector(50.0, 3, 6, 2, 4)
    m = SafeModeManager(d, recovery_steps=3)
    # Push to SAFE_MODE via a single critical controller.
    d.state.invalid_counts["controller_a"] = 10
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    m.transition(mode)
    assert mode == SystemMode.SAFE_MODE

    # Clear critical but keep one controller unhealthy → proposed
    # mode is DEGRADED. Hysteresis holds SAFE_MODE for 2 steps, then
    # de-escalates on step 3.
    d.state.invalid_counts["controller_a"] = 0
    d.state.invalid_counts["controller_b"] = 3  # unhealthy

    held1, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert held1 == SystemMode.SAFE_MODE
    held2, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert held2 == SystemMode.SAFE_MODE
    released, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert released == SystemMode.DEGRADED


def test_de_escalation_streak_resets_on_glitch():
    """A single glitch back to (or above) the current mode resets
    the recovery counter — brief excursions don't poison the
    cooldown, they restart it."""

    d = FaultDetector(50.0, 3, 6, 2, 4)
    m = SafeModeManager(d, recovery_steps=3)

    # Drive into SAFE_MODE.
    d.state.invalid_counts["controller_a"] = 10
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    m.transition(mode)

    # Two clean proposals (DEGRADED): streak builds up.
    d.state.invalid_counts["controller_a"] = 0
    d.state.invalid_counts["controller_b"] = 3
    m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert m._recovery_streak == 2

    # A glitch: vote SPLIT proposes SAFE_MODE again → reset.
    glitch, _ = m.evaluate(_vote(VoteOutcome.SPLIT), _reading())
    assert glitch == SystemMode.SAFE_MODE
    assert m._recovery_streak == 0


def test_failed_to_safe_mode_de_escalation_is_held():
    """The four de-escalation pairs all use the same gate.

    FAILED → SAFE_MODE specifically: takes recovery_steps clean
    proposals.
    """

    d = FaultDetector(50.0, 3, 6, 2, 4)
    m = SafeModeManager(d, recovery_steps=2)

    _force_critical(d, ["controller_a", "controller_b"])
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    m.transition(mode)
    assert mode == SystemMode.FAILED

    # Clear one of the criticals, keep the other unhealthy → propose
    # SAFE_MODE.
    d.state.invalid_counts["controller_a"] = 0  # back to healthy
    d.state.invalid_counts["controller_b"] = 10  # still critical
    held, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert held == SystemMode.FAILED  # hysteresis holds
    released, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert released == SystemMode.SAFE_MODE


def test_degraded_to_normal_de_escalation_is_held():
    d = FaultDetector(50.0, 3, 6, 2, 4)
    m = SafeModeManager(d, recovery_steps=2)
    d.state.invalid_counts["controller_a"] = 3  # unhealthy → DEGRADED
    mode, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    m.transition(mode)
    assert mode == SystemMode.DEGRADED

    # Clear the unhealthy bucket → propose NORMAL.
    d.state.invalid_counts["controller_a"] = 0

    held, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert held == SystemMode.DEGRADED
    released, _ = m.evaluate(_vote(VoteOutcome.CONSENSUS), _reading())
    assert released == SystemMode.NORMAL


def test_evaluate_proposed_is_pure_and_history_independent():
    """`_evaluate_proposed` is the function the TLA+ spec models —
    it must return the same answer for the same (vote, sensor,
    detector-state) triple regardless of `current_mode` or streak.
    """

    d = FaultDetector(50.0, 3, 6, 2, 4)
    m = SafeModeManager(d, recovery_steps=5)

    # Same inputs, two different histories → same proposed mode.
    a, _ = m._evaluate_proposed(_vote(VoteOutcome.CONSENSUS), _reading())
    m.current_mode = SystemMode.FAILED
    m._recovery_streak = 4
    b, _ = m._evaluate_proposed(_vote(VoteOutcome.CONSENSUS), _reading())
    assert a == b == SystemMode.NORMAL


def test_recovery_steps_config_passed_through_orchestrator():
    """Sanity: SimulationConfig.safe_mode_recovery_steps is now
    actually consumed (was the latent bug ADR 0011 fixes)."""

    from dataclasses import replace

    from app.core.config import DEFAULT_CONFIG
    from app.simulation.orchestrator import Simulation

    cfg = replace(DEFAULT_CONFIG, safe_mode_recovery_steps=7)
    sim = Simulation("hyst", seed=1, config=cfg)
    assert sim.safe_mode.recovery_steps == 7
