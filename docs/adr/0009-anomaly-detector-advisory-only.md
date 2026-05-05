# ADR 0009: The anomaly detector is advisory only

- **Status**: Accepted
- **Date**: 2026-05-05
- **Phase**: Phase 6.2

## Context

Phase 6 introduces an isolation-forest-based anomaly detector that
scores each step's controller-output / sensor-reading vector against
a model trained on the simulation's first N nominal steps. The
question every reader will ask is: does this score affect what the
system actually does?

The answer is no. The principal-grade hardening directive's global
operating rule is explicit:

> Do not add ML to the decision path. The whole point of this system
> is deterministic control. ML may appear ONLY in the
> anomaly-detection layer, and only as an advisory signal that never
> overrides the deterministic safe-mode logic.

RESEARCH.md §13 phrases the same constraint operationally:

> AI or advanced controllers may advise, but deterministic assurance
> governs.

Without an explicit firewall, drift toward "let's let the score
inform the safe-mode threshold" would be easy and corrosive. This
ADR pins the firewall.

## Decision

The anomaly detector is implemented in
`backend/app/simulation/anomaly.py` as a self-contained
isolation forest. It exposes one public effect on the system:

- It emits structured events (`component="anomaly"`,
  `type=FAULT`, `severity=INFO|WARNING|CRITICAL` based on score
  bands) into the existing `EventLogger` stream.

It is forbidden from doing any of:

- Mutating `SafeModeManager` state.
- Influencing `vote()` outcomes.
- Returning a value the orchestrator's `step()` consumes for any
  decision other than logging.
- Being imported from `simulation/safe_mode.py`,
  `simulation/voting.py`, `simulation/detection.py` (the
  counter-based detector), or `simulation/health.py` (the trust
  detector).

The third bullet is the one with teeth. The orchestrator reads the
score for **observability** (events, mission report, future UI
chart) but never branches on it. A test asserts the import-graph
constraint above by failing if any of the named modules import
`anomaly`.

## Consequences

### Positive

- The determinism guarantees in ADR 0004, ADR 0006, and the
  property tests in Phase 3 still hold. Even when anomaly detection
  is on, the same `(seed, scenario, steps)` produce the same
  `SystemDecision` sequence and the same replay fingerprint.
- The mission report can carry a meaningful "ML agreed with the
  deterministic detector on X of Y events" headline without that
  agreement having any operational effect — exactly what the
  directive's "advisory only" language asks for.
- The detector can use any algorithm later (one-class SVM, a tiny
  autoencoder, a learned per-fault-type classifier). The firewall
  does not depend on the algorithm.

### Negative / Tradeoffs

- The advisory channel adds work without changing the deterministic
  output. Reviewers may ask "what does it do then?" The honest
  answer is "it's a second opinion." The mission report quantifies
  the agreement so the reviewer can decide whether they would
  promote it later.
- Two parallel detection systems (counter-based, windowed trust)
  already coexist — ADR 0001 documents that. Adding a third
  signal increases the surface a contributor needs to understand.
  The firewall makes this acceptable: the new signal is purely
  observability, not control.

### Neutral

- The isolation forest is implemented from scratch (not via
  `scikit-learn`) to keep the dependency footprint small and the
  determinism story self-contained. The full algorithm is ~120
  lines of Python.

## Alternatives Considered

### Use scikit-learn's `IsolationForest`

Mature, well-known, less code. Rejected for two reasons. First,
scikit-learn is a ~80 MB transitive install for a single class;
that is disproportionate for a portfolio-scope project. Second,
the `random_state` parameter does not always produce
bit-identical output across sklearn minor versions, which would
weaken the determinism claim documented in ADR 0006.

### Mahalanobis distance against the warm-up mean and covariance

Simpler (~30 lines), no library, smooth scores. Rejected because
the directive specifies "isolation-forest based" and the
isolation forest's per-feature random splits make it more
robust to skewed feature distributions than a Gaussian
assumption would be. Mahalanobis remains a fallback if a future
revision wants a smaller anomaly module.

### Let anomaly score weight the safe-mode threshold

Tempting because it would close the loop. Rejected categorically.
This is the path the directive forbids and the firewall this ADR
exists to enforce.

## References

- Code: `backend/app/simulation/anomaly.py`
- Tests: `backend/app/tests/test_anomaly_detector.py`,
  `backend/app/tests/test_anomaly_firewall.py`
- Related: ADR 0001 (dual fault detectors), ADR 0004 (determinism),
  ADR 0006 (RNG service), RESEARCH.md §13.
