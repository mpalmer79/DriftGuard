# ADR 0001: Dual fault detectors (counter + windowed trust)

- **Status**: Accepted
- **Date**: 2026-05-04
- **Phase**: Backfill (Phase 0.4)

## Context

The simulation needs to detect controller misbehavior and sensor problems
and feed that signal to the safe-mode manager. The original implementation
used a simple counter-based detector that crossed thresholds at fixed
event counts. The Phase 5 expansion added a windowed trust detector with
explicit health states (`HEALTHY`/`SUSPECT`/`DEGRADED`/`CRITICAL`/
`RECOVERING`), per-component trust scores, repeat memory, and a recovery
cooldown.

These do not replace each other cleanly: the safe-mode manager already
encoded its escalation rules against the counter detector's
`unhealthy_controllers` / `critical_controllers` API, and that contract
is exercised by 29 pre-existing tests we are obligated to preserve.

## Decision

Run both detectors in parallel. The counter-based detector retains its
role driving the safe-mode manager and the existing test suite. The
windowed trust detector is layered on top: it emits richer events and
populates the trust snapshot used by the mission report and the trust
panel in the UI. The two never disagree about a hard transition because
the windowed detector is advisory inside the orchestrator.

## Consequences

### Positive

- Pre-existing safe-mode behavior and tests remain unchanged.
- The richer health model is available to UI/report without breaking
  the legacy decision path.
- The two detectors can be reconciled later in a single ADR-superseding
  rewrite, with a known migration path.

### Negative / Tradeoffs

- Double work per step: each output is observed twice.
- Two sources of truth for "is this controller healthy?" — readers must
  know which one feeds the safe-mode manager.

### Neutral

- The duplication is small (each detector is ~150 lines) and tightly
  scoped. Both are pure with respect to simulation state.

## Alternatives Considered

### Replace counter with windowed in one shot
Cleaner but would have required rewriting the safe-mode manager and
several tests in the same change set. We chose to ship the new
capability without churning the legacy contract.

### Drop the windowed detector in favor of richer counter logic
The richer health states (`SUSPECT`, `RECOVERING`) and the recovery
cooldown are genuinely valuable for the UI and the mission report.
Folding them into the counter detector would have grown that module
beyond the file-size ceiling.

## References

- Code: `backend/app/simulation/detection.py`, `backend/app/simulation/health.py`
- Tests: `backend/app/tests/test_fault_detection.py`,
  `backend/app/tests/test_health_detector.py`
