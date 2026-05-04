# Built-in Scenarios

Each scenario uses a fixed seed and a fixed fault schedule. The same
inputs always produce the same outputs.

## nominal_cruise
- **Faults:** none
- **Expected:** system holds `NORMAL` for the whole run.
- **Why it matters:** baseline behavior with healthy redundancy.

## single_controller_latency
- **Faults:** `controller_b` exceeds its latency budget for 10 steps.
- **Expected:** the slow controller is rejected each tick; the other
  two still form consensus. Mode may stay `NORMAL` or move to
  `DEGRADED` depending on accumulated trust loss.
- **Why it matters:** demonstrates time-aware exclusion of late voters.

## sensor_drift_recovery
- **Faults:** sensor altitude drifts upward for 8 steps, then clears.
- **Expected:** sensor health degrades, action selection becomes
  conservative, system later enters `RECOVERING` and returns toward
  `NORMAL`.
- **Why it matters:** shows trust-driven safe-action restriction.

## split_vote_escalation
- **Faults:** controllers `b` and `c` are biased to different forced
  actions, breaking consensus.
- **Expected:** repeated `SPLIT` outcomes drive the system into
  `SAFE_MODE`.
- **Why it matters:** shows how disagreement, not single failure,
  triggers safe mode.

## multi_fault_failure
- **Faults:** sensor dropout (probabilistic) plus invalid output and
  silent failure on two controllers.
- **Expected:** repeated critical failures reach the `FAILED` mode.
- **Why it matters:** validates the terminal escalation path.

## intermittent_fault
- **Faults:** controller_a alternates between healthy and faulty using
  a fixed pattern.
- **Expected:** health bounces through `SUSPECT` / `RECOVERING`; mode
  oscillates rather than collapsing.
- **Why it matters:** demonstrates de-escalation and recovery cooldown.
