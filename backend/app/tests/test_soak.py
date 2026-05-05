"""Soak test: every scenario × 1000 steps with invariants asserted.

Phase 3.4 acceptance: this catches drift that would only show up
under a long horizon — repeated escalation/recovery cycles, slow
trust decay, sensor accumulators that quietly diverge.

Marked ``@pytest.mark.slow`` so the default suite stays fast.
``make soak`` is the documented entry point.
"""

from __future__ import annotations

import pytest

from app.domain.enums import Action, SystemMode, VoteOutcome
from app.scenarios import all_scenarios, run_scenario
from app.simulation.safe_mode import SAFE_ALLOWED_ACTIONS

_FORBIDDEN_IN_SAFE_MODE = {Action.TURN_LEFT, Action.TURN_RIGHT, Action.ASCEND, Action.ACCELERATE}

SCENARIOS = [s.name for s in all_scenarios()]


@pytest.mark.slow
@pytest.mark.parametrize("scenario", SCENARIOS)
def test_soak_invariants_hold_for_1000_steps(scenario):
    sim, _ = run_scenario(scenario, 1000)
    assert len(sim.step_history) == 1000

    last_step = -1
    for record in sim.step_history:
        # I7: step monotonicity
        assert record.decision.step == record.state.step
        assert record.decision.step > last_step
        last_step = record.decision.step

        # I1: FAILED -> safe-only
        if record.decision.system_mode == SystemMode.FAILED:
            assert record.decision.final_action in SAFE_ALLOWED_ACTIONS

        # I2: SAFE_MODE -> not aggressive
        if record.decision.system_mode == SystemMode.SAFE_MODE:
            assert record.decision.final_action not in _FORBIDDEN_IN_SAFE_MODE

        # I9: outcome iff action
        if record.vote.outcome == VoteOutcome.CONSENSUS:
            assert record.vote.selected_action is not None
        else:
            assert record.vote.selected_action is None

    # I6: event_id uniqueness over the whole run
    seen: set[str] = set()
    for event in sim.events.all():
        assert event.event_id not in seen
        seen.add(event.event_id)
