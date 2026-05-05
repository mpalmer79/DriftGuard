# SentinelNav System Invariants

This document is the contract every release must keep. Each invariant
is a property the simulation must hold across every (seed, scenario,
step count) combination. Property-based tests in
`backend/app/tests/properties/` enforce these; the soak test
exercises them across long runs.

The invariants are numbered so a reviewer or a CI failure message can
point at one ("I5 violated"). New invariants get appended; existing
numbers are stable.

## Glossary

- **Decision** — a `SystemDecision` produced once per simulation step.
- **Pre-step state** — the `VehicleState` before the orchestrator's
  step loop runs.
- **Trusted controllers** — `decision.trusted_controllers`, the
  controllers whose votes the orchestrator believed.
- **Critical controller** — one whose `TrustDetector` health is
  `CRITICAL`.
- **Fault flag** — an entry in `sensor.fault_flags`.

## I1 — Safe action set in FAILED mode

**Statement.** A `SystemDecision` whose `system_mode == FAILED` always
has `final_action ∈ {HOLD, STABILIZE, DECELERATE, ABORT}`.

**Why.** RESEARCH §6 / ADR 0001: a system that has lost too much trust
must restrict itself to a small, conservative action set. `ABORT` is
the canonical fallback per `SafeModeManager.fallback_action(FAILED)`.

**Enforcement.** `SafeModeManager.restrict_action` in
`simulation/safe_mode.py`.

## I2 — Safe action set in SAFE_MODE

**Statement.** A `SystemDecision` whose `system_mode == SAFE_MODE`
never has `final_action ∈ {TURN_LEFT, TURN_RIGHT, ASCEND, ACCELERATE}`.

**Why.** Safe mode is the conservative-action mode. The forbidden
actions all increase the energy or attitude excursion of the vehicle,
which is exactly what the safe-mode manager is trying to bound.

**Enforcement.** Same path as I1; the allowed set
`SAFE_ALLOWED_ACTIONS` is the complement of the forbidden set.

## I3 — Direct NORMAL → FAILED is permitted

**Statement.** A single step may transition the system mode from
`NORMAL` to `FAILED` without passing through `DEGRADED` or
`SAFE_MODE`. This is intentional, not a bug.

**Why.** Real systems experience multi-component sudden failures (a
power event that kills two boards at once; a sensor invalidation
coincident with a controller crash). The state machine reflects that:
if `≥ 2` controllers go critical in the same step, or the sensor goes
invalid while at least one controller is unhealthy, the safe-mode
manager promotes directly to `FAILED`.

**Documented in.** ADR 0008.

**Test.** Property tests do not assert the absence of NORMAL→FAILED
transitions; they assert that whenever such a transition occurs, the
preconditions for FAILED hold.

## I4 — Healthy quorum implies NORMAL

**Statement.** If the vote outcome is `CONSENSUS`, the sensor status
is `OK`, and no controller is unhealthy, then `system_mode == NORMAL`.

**Why.** Defines what NORMAL means: there is no remaining cause to
degrade. The contrapositive is what the safe-mode manager actually
checks; the invariant is the positive form.

## I5 — Critical controllers are never trusted

**Statement.** A controller currently in health state `CRITICAL` does
not appear in `decision.trusted_controllers` of any decision in the
same step or later, until it transitions out of `CRITICAL`.

**Why.** Trust scoring would be theatre if a controller flagged
critical were still allowed to drive the vote outcome.

## I6 — Event id uniqueness

**Statement.** Every `event_id` produced within a single simulation is
unique.

**Why.** The mission report and the timeline reconstructor both
deduplicate on `event_id`. A collision would silently drop an audit
event.

**Enforcement.** `core.ids.event_id()` returns a UUID4-based string;
collisions are astronomically unlikely but the test is cheap to keep
running.

## I7 — Step monotonicity

**Statement.** For every `StepRecord` in `Simulation.step_history`,
`record.decision.step == record.state.step` and the step values are
strictly increasing across the history.

**Why.** The orchestrator promises one decision per step; a step
duplicate or reordering breaks the timeline reconstructor.

## I8 — Replay determinism

**Statement.** For any (root seed, scenario name, step count), two
runs in the same process produce the same `SystemDecision` sequence
and the same canonical-JSON timeline.

**Why.** This is the central design property. ADR 0004 and ADR 0006
explain how the seed propagation and the SHA-256 RNG derivation make
it true.

**Test.** `tests/test_determinism.py` enforces this directly,
including a cross-process variant. Property tests reaffirm it at
random seeds.

## I9 — Vote outcome strictly determines whether `selected_action` is set

**Statement.** `vote.outcome == CONSENSUS` if and only if
`vote.selected_action is not None`. Conversely, `SPLIT` and
`INSUFFICIENT_DATA` always have `selected_action is None`.

**Why.** Caller code (orchestrator, mission report, frontend) reads
either the outcome or the action, depending on context. The two must
agree or every consumer needs defensive code.

**Enforcement.** `simulation/voting.py`.

## I10 — Recovery is never instant

**Statement.** A controller flagged `DEGRADED` or `CRITICAL` does not
return to `HEALTHY` in a single step. It must transit `RECOVERING`
and then accumulate ≥ `recovery_steps` clean steps.

**Why.** A glitch should not erase the trust hit. ADR 0001 calls this
out as the windowed detector's reason to exist.

**Enforcement.** `simulation/health.py::TrustDetector._observe`.

## Adding new invariants

1. Append to this document with a stable number (`I11`, `I12`, ...).
2. Add a property test file `tests/properties/test_invariant_NN_*.py`.
3. Reference it from `docs/INVARIANTS.md` and from any ADR that
   explains the underlying decision.
