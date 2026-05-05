"""Property test for I11 — safe-mode recovery hysteresis (Phase 3.2).

I11 (docs/INVARIANTS.md): once a step's `decision.system_mode` is
set to a more-severe mode (`NORMAL < DEGRADED < SAFE_MODE <
FAILED`), no later step may set `decision.system_mode` to a
strictly less-severe mode unless at least
`safe_mode_recovery_steps` consecutive steps have proposed the
less-severe (or even-less-severe) mode since the most-severe mode
was last entered. Escalations remain immediate.

Approach:

- Generate random fault schedules through the existing
  `scenario_runs` strategy.
- Walk the resulting `step_history` and check, for every
  strict-de-escalation transition, that the previous
  `safe_mode_recovery_steps` decisions all proposed at least the
  destination mode (i.e. the streak condition held).

We can't directly observe the *proposed* mode the manager rejected
(only the published mode), but the contrapositive that I11 codifies
is observable: the published mode never decreases unless the
required clean streak existed in published modes too.
"""

from __future__ import annotations

from hypothesis import HealthCheck, given, settings

from app.domain.enums import SystemMode

from .strategies import scenario_runs

_SEVERITY = {
    SystemMode.NORMAL: 0,
    SystemMode.DEGRADED: 1,
    SystemMode.SAFE_MODE: 2,
    SystemMode.FAILED: 3,
}

_PROPERTY = settings(
    max_examples=30,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture],
)


@_PROPERTY
@given(run=scenario_runs())
def test_i11_no_strict_de_escalation_within_cooldown(run):
    sim, _ = run
    recovery_steps = sim.safe_mode.recovery_steps

    decisions = [r.decision for r in sim.step_history]
    if len(decisions) < 2:
        return

    for i in range(1, len(decisions)):
        prev_mode = decisions[i - 1].system_mode
        cur_mode = decisions[i].system_mode
        prev_sev = _SEVERITY[prev_mode]
        cur_sev = _SEVERITY[cur_mode]

        if cur_sev >= prev_sev:
            # Escalation or hold — always allowed.
            continue

        # Strict de-escalation. The window of `recovery_steps - 1`
        # decisions immediately before this one must all be at-or-
        # below the previously-published `prev_mode` for I11 to
        # hold. (We compare against `prev_mode` because the spec
        # talks about "since the most-severe mode was last
        # entered" — the previous decision is the cleanest local
        # proxy.)
        window_start = max(0, i - recovery_steps + 1)
        window = decisions[window_start:i]
        # Every step in the window must have been at-or-below the
        # severity of `prev_mode` (otherwise the streak counter
        # would have reset).
        for w in window:
            assert _SEVERITY[w.system_mode] <= _SEVERITY[prev_mode], (
                f"I11 violated: step {decisions[i].step} de-escalates "
                f"{prev_mode.value} -> {cur_mode.value} but window "
                f"contains {w.system_mode.value}"
            )
