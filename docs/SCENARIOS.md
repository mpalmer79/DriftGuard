# Built-in Scenarios

Each scenario uses a fixed seed and a fixed fault schedule. Same
inputs always produce the same outputs. The source of truth is
`backend/app/scenarios/builtins.py`.

## nominal_cruise
- **Faults:** none.
- **Expected:** system holds `NORMAL` for the whole run.
- **Why it matters:** baseline behavior with healthy redundancy.

## single_controller_latency
- **Faults:** `controller_b` exceeds its latency budget for several
  steps.
- **Expected:** the slow controller is rejected each tick; the other
  two still form consensus. Mode may stay `NORMAL` or move to
  `DEGRADED` as trust loss accumulates.
- **Why it matters:** time-aware exclusion of late voters.

## sensor_drift_recovery
- **Faults:** sensor altitude drifts upward, then the fault clears.
- **Expected:** sensor health degrades, action selection becomes
  conservative, system later enters `RECOVERING` and returns toward
  `NORMAL`.
- **Why it matters:** trust-driven safe-action restriction.

## split_vote_escalation
- **Faults:** controller_b is action-biased and breaks consensus
  with the other two.
- **Expected:** repeated `SPLIT` outcomes drive the system into
  `SAFE_MODE`.
- **Why it matters:** disagreement, not single failure, triggers
  safe mode.

## multi_fault_failure
- **Faults:** sensor drift plus two controller failures.
- **Expected:** repeated critical failures escalate through
  `DEGRADED` and `SAFE_MODE` into `FAILED`.
- **Why it matters:** terminal escalation path.

## intermittent_fault
- **Faults:** `controller_a` alternates between healthy and faulty
  using a fixed pattern.
- **Expected:** health bounces through `SUSPECT` / `RECOVERING`;
  mode oscillates rather than collapsing.
- **Why it matters:** de-escalation and recovery cooldown.

## sensor_spike_transient
- **Faults:** a single-step sensor spike injects an outlier
  reading.
- **Expected:** the voter rejects the spike. The system stays in
  `NORMAL` or briefly enters `DEGRADED` before recovering.
- **Why it matters:** transient sensor faults must not cause
  persistent state changes.

## gps_denied_navigation
- **Faults:** GPS unavailable mid-mission (`GPS_DENIED` on the GPS
  source).
- **Expected:** EKF runs INS-only, the variance band grows, mode
  enters `DEGRADED`. If GPS does not return within budget, the
  system escalates to `SAFE_MODE`.
- **Why it matters:** uncertainty is observable. The EKF altitude
  variance signal is the demonstrable consequence of the denial.

## byzantine_low_confidence
- **Faults:** `controller_c` returns valid actions with persistently
  low confidence — the Byzantine case where a node responds but
  its outputs are unreliable.
- **Expected:** the voter weights its contribution down; provided
  the other two agree, the system stays in `NORMAL`.
- **Why it matters:** trust-weighted voting under partial
  controller compromise.

## compound_cascading_recovery
- **Faults:** a sensor noise spike overlaps with a compound
  controller fault. Both clear before the run ends.
- **Expected:** `DEGRADED` while faults are active; once both clear
  and the recovery window is satisfied, the system returns to
  `NORMAL`.
- **Why it matters:** escalation is not a one-way trip; recovery
  hysteresis still gates the de-escalation.
