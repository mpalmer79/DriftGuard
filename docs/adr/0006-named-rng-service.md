# ADR 0006: Centralized seeded RNG service with named children

- **Status**: Accepted (supersedes the RNG-derivation paragraph of ADR 0004)
- **Date**: 2026-05-04
- **Phase**: Phase 1.1

## Context

ADR 0004 made determinism a first-class concern through seed
propagation but accepted a pragmatic tradeoff: each subsystem held its
own `random.Random`. Sensors used a Random seeded directly from the
root seed; each controller used a Random seeded from
`hash(controller_id)`. ADR 0004 explicitly flagged this as
"cross-contamination risk: if call order between subsystems changes,
RNG sequences shift" and earmarked Phase 1.1 to replace it.

RESEARCH.md §5.3 ("deterministic logical-time scheduler"), §6
("non-deterministic replay → audit failure"), and §11 ("same seed × 10
→ 10/10 identical") raise the bar further: determinism is the
governing property of the kernel, not a best-effort claim.

Two issues with the prior design:

1. **Process-dependent hashes.** Python's built-in `hash()` is salted
   per process when `PYTHONHASHSEED` is unset. `hash("controller_a")`
   produces a different integer in two different invocations, which
   means controller-fault RNGs were never actually reproducible across
   process boundaries. The existing tests passed only because they ran
   in-process.
2. **Implicit consumer registry.** Adding a new RNG consumer (e.g. an
   anomaly detector) meant inventing a new `random.Random` somewhere
   and hoping nobody else collided with the same seed.

## Decision

Introduce `app.core.rng.RngService`. It holds one root seed and yields
named child `random.Random` instances derived through SHA-256 truncated
to 64 bits:

    child_seed = int.from_bytes(
        sha256(f"{root_seed}:{name}".encode()).digest()[:8],
        "big",
    )

Children are cached per name so repeated lookups return the same
instance and therefore the same stream. The derivation is independent
of `PYTHONHASHSEED`, so the same `(root_seed, name)` pair reproduces
across processes.

Every simulation-path consumer of randomness must obtain its RNG
through `RngService.child(name)`. Bare `random.<func>` calls and bare
`random.Random(...)` constructors are forbidden inside `app/`.

## Consequences

### Positive

- Cross-process reproducibility: the Phase 1.3 subprocess test can now
  legitimately compare timeline byte-equality between runs in
  separate Python interpreters.
- Single registry of randomness consumers. `RngService.names()`
  returns the set of children materialized for a simulation, which is
  a useful audit signal.
- New consumers (Phase 6 anomaly detector, Phase 9 fleet) attach by
  asking for a new name. No new global state.

### Negative / Tradeoffs

- One more layer of indirection. The cost is small (a dict lookup per
  step) and only pays for itself once you start needing audited
  determinism, which is the whole point.
- Until the rollout commits land, both the old per-subsystem RNGs and
  the new service coexist in the codebase. The transition is
  staged across two-file commits to keep behavior stable.

### Neutral

- The derivation strategy is internal to the service. If a future ADR
  swaps SHA-256 for, say, BLAKE2 or a JAX-style splittable PRNG, the
  child API does not change.

## Alternatives Considered

### Pure-functional splittable PRNG (JAX-style keys)

The strongest guarantee but heavy in a Python-stdlib codebase. The
ergonomic cost (every consumer threads a key through every call) is
disproportionate for the win. Deferred.

### One global Random with documented call order

Rejected for the same reason ADR 0004 rejected it: any reordering of
sensor reads versus controller evaluations changes outputs.

### Use Python's `secrets` module

`secrets` is intentionally non-deterministic. Wrong tool for replay.

## References

- Code: `backend/app/core/rng.py`
- Tests: `backend/app/tests/test_rng_service.py`
- Supersedes: ADR 0004 (Determinism via Seed Propagation), specifically
  the "ad-hoc per-subsystem RNGs" tradeoff.
- Successor: none yet. Phase 6 will document anomaly-detector
  consumption of the service.
