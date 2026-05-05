# ADR 0008: Direct NORMAL → FAILED transitions are permitted

- **Status**: Accepted
- **Date**: 2026-05-05
- **Phase**: Phase 3.1

## Context

Phase 3 inventories the system's safety invariants in
`docs/INVARIANTS.md`. The directive flags one open question: should
the state machine require passing through `DEGRADED` or `SAFE_MODE`
on the way to `FAILED`?

The current safe-mode manager allows direct `NORMAL` → `FAILED`. If
two controllers go `CRITICAL` in the same step, or the sensor goes
invalid while at least one controller is already unhealthy, the
manager promotes the simulation directly to `FAILED`.

Two competing design intuitions:

1. **Linear escalation only.** Always pass through intermediate
   states. Reads cleanly on a state diagram; produces a longer audit
   trail because every escalation step is logged.
2. **Multi-cause direct promotion.** Real systems experience
   simultaneous multi-component failures: a power event that kills
   two boards at once, a sensor invalidation coincident with a
   controller crash. The state machine should reflect that.

## Decision

Permit direct `NORMAL` → `FAILED` transitions when the precondition
for `FAILED` (≥ 2 critical controllers, or sensor invalid + ≥ 1
unhealthy controller) is met in a single step.

`docs/INVARIANTS.md` records this as I3. The property tests assert
that **whenever such a transition occurs, the FAILED preconditions
hold** — they do not assert the absence of NORMAL→FAILED.

## Consequences

### Positive

- Matches the failure modes RESEARCH §6 calls out: simultaneous
  multi-component faults are real and should not be smoothed over.
- Keeps the safe-mode manager simple. A linear-only state machine
  would need a deliberate stage-by-stage escalation queue.
- The audit trail is preserved through the `MODE_CHANGE` event,
  which logs the justification ("multiple critical failures").
  Readers learn that the system bypassed intermediate states by
  reading the event, not by inferring from the absence of one.

### Negative / Tradeoffs

- A simple state diagram cannot mark `NORMAL` → `FAILED` as the
  long-arrow shortcut without an asterisk. Documentation must
  explain it. (This ADR is that explanation.)
- Operator dashboards that watch for "DEGRADED appeared" as the
  early-warning signal will not catch a multi-cause failure. That is
  appropriate: by the time the conditions for direct FAILED hold, the
  early-warning window has already closed.

### Neutral

- The trust detector still runs and still produces its `CRITICAL`
  health events for each contributing controller. The mode jump is
  the safe-mode manager's reaction to the *combination*, not a loss
  of per-component visibility.

## Alternatives Considered

### Force linear escalation

Require `NORMAL` → `DEGRADED` → `SAFE_MODE` → `FAILED`. Rejected:
introduces an artificial delay before `FAILED` in cases where the
system already has all the evidence it needs to conclude. The delay
would be a surprise hazard, not a feature.

### Promote only via `SAFE_MODE`

A compromise: skip `DEGRADED` but require `SAFE_MODE`. Rejected for
the same reason: `SAFE_MODE` is the "I lost trust, I will hold the
line" mode. Going through it on the way to `FAILED` adds a frame of
pretend-I-can-recover that we cannot honestly back up.

## References

- Code: `backend/app/simulation/safe_mode.py::SafeModeManager.evaluate`
- Tests: `backend/app/tests/properties/test_invariant_i3.py` (Phase 3.2)
- Related: ADR 0001 (dual detectors), ADR 0007 (dynamics layering),
  RESEARCH §6 (failure modes), `docs/INVARIANTS.md` I3.
