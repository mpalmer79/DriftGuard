# ADR 0011: Safe-mode recovery hysteresis

- **Status**: Proposed
- **Date**: 2026-05-05
- **Phase**: Phase 3 (PRs 3.1–3.2)

## Context

`SimulationConfig.safe_mode_recovery_steps = 5` exists in the
config dataclass and is **read by no one**. A
`grep "safe_mode_recovery_steps" backend/app/` returns one match —
the definition.

`SafeModeManager.transition()` accepts any mode change in either
direction with no resistance:

```python
def transition(self, new_mode: SystemMode) -> bool:
    changed = new_mode != self.current_mode
    self.current_mode = new_mode
    return changed
```

So in principle `evaluate()` can return `NORMAL → SAFE_MODE → NORMAL →
SAFE_MODE` over four consecutive steps if its inputs (vote outcome,
sensor status, controller-health counts) flap on a borderline signal.
Per-component hysteresis exists in `TrustDetector` (ADR 0001 and the
RECOVERING health state) but applies to per-controller and per-sensor
trust, not to the system mode the orchestrator publishes to the
mission report and the frontend.

The README and the portfolio case study had been claiming "recovery
cooldown" as a system-level property. PR 0.2 softened the claim
ahead of this ADR landing; this ADR is the substantive fix.

A reviewer reads "the engineer wired half the feature" when a config
field exists but is never consulted. Implementing the cooldown is
preferable to deleting the field — a recovery-hysteresis policy on
a system mode is a real safety property worth having and worth
testing.

## Decision

The policy: **escalations are immediate; de-escalations require a
sustained clean streak.**

Concretely, define mode severity:

```
NORMAL  <  DEGRADED  <  SAFE_MODE  <  FAILED
```

`SafeModeManager` tracks two pieces of internal state in addition to
`current_mode`:

- `_proposed_mode` — what the **underlying** evaluator (the existing
  `evaluate` clause body, renamed `_evaluate_proposed`) returned for
  the current step.
- `_recovery_streak` — number of consecutive steps for which
  `_proposed_mode` has been **strictly less severe** than
  `current_mode`.

The new public `evaluate()` returns:

- `_proposed_mode` immediately when it is **more severe than or
  equal to** `current_mode`. Resets `_recovery_streak` to zero.
  (Escalations and same-mode steps are unaffected.)
- `_proposed_mode` when it is **strictly less severe than**
  `current_mode` **and** `_recovery_streak >= recovery_steps`.
- `current_mode` (no de-escalation yet) otherwise. Increments
  `_recovery_streak`.

This is the textbook hysteresis policy used in fault-tolerant
control: a glitch on the way up acts immediately to keep the system
safe; a glitch on the way down does not yank the mode back. The
streak counter resets the moment `_proposed_mode` returns to
something at-or-above the current mode, so brief excursions don't
"poison" the recovery window — they just restart it.

`safe_mode_recovery_steps` is plumbed through
`SafeModeManager.__init__`. Default 5 (already in `SimulationConfig`).

### Invariant I11

Add to `docs/INVARIANTS.md`:

> **I11 — Safe-mode hysteresis on de-escalation.** Once a step's
> `decision.system_mode` is set to a more-severe mode, no later
> step may set `decision.system_mode` to a strictly less-severe
> mode unless at least `safe_mode_recovery_steps` consecutive
> steps have proposed the less-severe (or even-less-severe) mode
> since the most-severe mode was last entered.

I11 is enforced by `SafeModeManager.evaluate` (post Phase 3.2). It
is checked by a Hypothesis property test that generates random
fault schedules and asserts no de-escalation within the cooldown
window.

### TLA+ ↔ Python mirror

The current `SafeMode.tla` models `EvaluateMode` as a pure function
of `(vote, sensor, critical_count, unhealthy_count)`. Hysteresis
introduces history (`current_mode` and `_recovery_streak`) that the
pure-function spec does not capture. Two options:

1. **Extend the spec** to model `EvaluateMode` over a state-history
   tuple. This is faithful but expands the input space by
   `|Modes| × (recovery_steps + 1)`, materially slowing the
   exhaustive checker.
2. **Keep the spec for the proposed mode**, document explicitly
   that hysteresis is enforced *outside* `EvaluateMode`, and check
   it separately with the new property test.

Choose option 2. Rationale: the spec's existing role is to pin the
*proposed* mode given the *current step's* inputs, and that role
remains unchanged. The hysteresis layer is a wrapper; mixing it into
the spec would dilute the spec's purpose without strengthening any
property the property test will not already cover. The spec gets a
comment noting the boundary.

The exhaustive Python checker (`test_transition_exhaustive.py`) is
updated to assert `_evaluate_proposed` against the spec — i.e., the
unchanged clause body — and to call out (in a comment header) that
hysteresis is checked separately by the property test added in PR 3.2.

## Consequences

### Positive

- `safe_mode_recovery_steps` becomes load-bearing. The config field
  is no longer dead weight.
- The system mode flap behaviour is now bounded: borderline-fault
  scenarios produce a single escalation rather than a stutter.
- I11 is a real, falsifiable property the Hypothesis property test
  enforces across ≥ 30 random schedules.
- The README's "recovery cooldown" claim becomes accurate by PR 3.2.

### Negative / Tradeoffs

- Recovery is slower by design. A scenario that escalates to
  SAFE_MODE because of a transient sensor glitch will hold SAFE_MODE
  for at least `recovery_steps` clean steps. Existing tests that
  asserted same-step de-escalation must be updated with explicit
  loosening comments (Phase 3.2 carries that work). The action plan
  treats this kind of test update as routine, with `# Phase 3.2:
  hysteresis enforced; loosened to N steps` comments documenting
  the change.
- The TLA+ spec no longer covers the *full* runtime function — it
  covers only `_evaluate_proposed`. The boundary is documented in
  the spec and in `test_transition_exhaustive.py` (Phase 3.2).
- Replay fingerprints for scenarios that previously de-escalated
  within the cooldown window will change. ADR 0010 already
  authorised one fingerprint reset for the EKF wiring (PR 1.3);
  Phase 3.2's reset is the second authorised reset in this plan and
  is recorded in the PR description.

### Neutral

- The new state (`_proposed_mode`, `_recovery_streak`) is two
  scalar fields. No new modules, no new dependencies.
- `SafeModeManager` keeps its public surface (`evaluate`,
  `transition`, `restrict_action`, `fallback_action`).
  `_evaluate_proposed` is private.

## Alternatives Considered

### Delete `safe_mode_recovery_steps` instead

Easier. Rejected because it leaves a real safety property
unimplemented and walks back the README claim permanently. The
config field is small; the cooldown is a textbook fault-tolerance
property; the test cost is bounded. Implementing is the better
outcome.

### Apply hysteresis to escalation as well as de-escalation

Symmetric. Rejected because escalation hysteresis is an
anti-feature: a borderline fault that should escalate must escalate
*now*. Hysteresis on the way up is how single-bit errors turn into
multi-step incidents. The asymmetric policy (immediate escalation,
cooled-off recovery) is the correct fail-safe design.

### Use the trust detector's per-component recovery cooldown directly

The `TrustDetector` already enforces per-component recovery via the
RECOVERING health state. We could remove `safe_mode_recovery_steps`
and rely on those health states to indirectly cool off the system
mode (since `evaluate` reads controller-health counts).

Rejected because the two cooldowns are about different things. The
trust detector's cooldown is about whether a *controller* should
return to HEALTHY. The system-mode cooldown is about whether the
*system* should return to a less-severe operating mode after a
mode-changing event. They have different time constants, different
inputs (the system-mode cooldown observes the proposed mode, the
trust cooldown observes per-step health observations), and different
consumers (the mission report renders the system mode separately
from per-component health). Conflating them would obscure both.

### Streak-of-N de-escalations across mode levels

A stricter variant: require N clean steps for `SAFE_MODE → DEGRADED`,
then N more for `DEGRADED → NORMAL`. Rejected because the policy is
opaque in operation ("why is the system stuck in DEGRADED?") and
because the simpler "any de-escalation requires N clean proposals"
already covers the flap case. If a scenario needs the stricter
behaviour, ADR 0012 can revisit.

## References

- Code: `backend/app/simulation/safe_mode.py`,
  `backend/app/core/config.py`,
  `backend/app/tests/test_safe_mode.py` (new tests in PR 3.2),
  `backend/app/tests/properties/test_invariant_11_hysteresis.py`
  (new in PR 3.2).
- Spec: `docs/formal/SafeMode.tla` (comment header updated in
  PR 3.2; `EvaluateMode` itself unchanged because hysteresis is
  out-of-band).
- Related: ADR 0001 (dual fault detectors / per-component cooldown),
  ADR 0008 (direct NORMAL → FAILED is allowed), I10 in
  `docs/INVARIANTS.md`.
