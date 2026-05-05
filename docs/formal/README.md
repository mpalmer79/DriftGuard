# Formal Specifications

This directory holds machine-readable specifications of SentinelNav's
safety-critical state machines. They are aspirational per the Phase 3.5
directive — the project is not formally verified end-to-end, but the
core safe-mode transition logic is small enough that a real spec adds
real evidence.

The spec here is paired with an exhaustive Python checker that
validates the implementation matches the spec for every input
combination. The checker is fast, reproducible in CI, and does not
require a TLA+ toolchain. The TLA+ spec itself is the human-readable
reference and the artifact a hiring panel can read.

## Files

- `SafeMode.tla` — TLA+ specification of the safe-mode transition
  function. Models the inputs (vote outcome, sensor status, critical
  / unhealthy controller counts) and the output mode. Asserts the
  invariants from `docs/INVARIANTS.md` as TLA+ theorems.
- `../../backend/app/tests/properties/test_transition_exhaustive.py`
  — Python exhaustive checker that mirrors the same input space and
  asserts the live `SafeModeManager.evaluate` function matches the
  spec on every combination.

## Running the spec

The TLA+ spec can be checked with TLC (the TLA+ model checker):

```
tlc SafeMode.tla
```

We do not gate CI on this because installing TLC adds a heavy
dependency. The exhaustive Python checker provides equivalent
coverage for the transition function with no extra dependency.

## What's not modeled

- The trust detector itself (the windowed escalation logic). Its
  property is "recovery passes through RECOVERING" (I10), which is
  pinned by unit tests rather than a formal spec.
- The voting engine. Pinned by unit tests; small enough that a spec
  would be parallel duplication.
- Persistence and the timeline reconstructor. Out of scope for the
  Phase 3.5 directive.

If a future phase wants to broaden the formal coverage, the right
move is to add specs for those subsystems alongside this one rather
than expanding `SafeMode.tla`.
