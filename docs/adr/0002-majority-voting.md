# ADR 0002: Majority-of-three voting, not weighted or Bayesian

- **Status**: Accepted
- **Date**: 2026-05-04
- **Phase**: Backfill (Phase 0.4)

## Context

Three controllers produce candidate actions per step. We need to combine
them into a single decision while excluding controllers that timed out
or returned invalid output. The combination function is the heart of the
redundancy story.

The classic options:

1. **Plurality / majority voting**: pick the action that ≥ N/2 + 1
   valid controllers agree on; otherwise declare a SPLIT.
2. **Weighted voting**: combine controllers' actions with confidence
   weights and pick the argmax.
3. **Bayesian fusion**: model each controller as a noisy estimator of
   the "true" optimal action and use posterior inference.

## Decision

Use majority voting with strict invalid/late exclusion. ≥ 2 of the
remaining controllers must agree on the same `Action` for `CONSENSUS`;
otherwise the outcome is `SPLIT` and the safe-mode manager assumes
control of the action.

## Consequences

### Positive

- The decision is trivial to audit and explain. A reviewer can
  reconstruct it from the persisted controller outputs in their head.
- It is robust to a single malicious or malfunctioning controller: it
  cannot force an action by reporting high confidence.
- The "SPLIT" outcome is a clean signal for safe-mode escalation.

### Negative / Tradeoffs

- We discard confidence information at the voting boundary; a 0.99
  vote and a 0.51 vote count the same.
- With three controllers, two-vs-one situations always pick the
  majority pair, which can mask a slowly drifting controller until
  the trust detector catches it.

### Neutral

- The voting engine is ~50 lines and trivially testable.

## Alternatives Considered

### Weighted voting with confidence
Tempting, but it makes a single high-confidence rogue controller able
to swing decisions. Confidence is also self-reported, which makes it
the wrong signal to weight by in an adversarial / fault context.

### Bayesian fusion
Genuinely more expressive but introduces a numerical posterior that
makes the decision path harder to reason about. The whole point of
DriftGuard is "deterministic, auditable, explainable." Bayesian
fusion fights that.

## References

- Code: `backend/app/simulation/voting.py`
- Tests: `backend/app/tests/test_voting.py`
