---------------------------- MODULE SafeMode ----------------------------
(*
  TLA+ specification of SentinelNav's safe-mode transition function.

  This is the function `SafeModeManager.evaluate` in
  `backend/app/simulation/safe_mode.py`. The spec models the four
  modes, the inputs that drive the transition, and the policy
  expressed as a series of guarded clauses. The invariants from
  `docs/INVARIANTS.md` are stated as TLA+ theorems and are checked
  by an accompanying Python exhaustive checker.

  Reading order: constants, the mode enum, the transition function,
  the invariants.
*)

EXTENDS Naturals, FiniteSets

(* The four reachable modes. NORMAL/DEGRADED/SAFE_MODE/FAILED. *)
Modes == {"NORMAL", "DEGRADED", "SAFE_MODE", "FAILED"}

(* Vote outcomes the orchestrator hands the safe-mode manager. *)
VoteOutcomes == {"CONSENSUS", "SPLIT", "INSUFFICIENT_DATA"}

(* Sensor status enum. *)
SensorStatuses == {"OK", "DEGRADED", "INVALID"}

(*
  The three controller ids. We model controller health as two counts:

    critical_count  = number of controllers in CRITICAL state
    unhealthy_count = number of controllers above the SUSPECT threshold,
                      INCLUDING the critical ones

  This matches the live FaultDetector: ``unhealthy_controllers``
  returns every controller whose counter has crossed the warning
  threshold, and a controller flagged CRITICAL has by definition
  crossed warning too. So ``critical_count <= unhealthy_count`` is an
  invariant of the input domain, expressed below as a domain
  restriction on ``Inputs``.
*)
NumControllers == 3

(*
  EvaluateMode mirrors `SafeModeManager.evaluate` exactly. The order
  of clauses is significant — the manager promotes to FAILED first,
  then SAFE_MODE for any of three reasons, then DEGRADED, then
  NORMAL. The Python implementation must match this clause order
  for the exhaustive checker to pass.
*)
EvaluateMode(vote, sensor, critical_count, unhealthy_count) ==
    LET sensor_invalid == sensor = "INVALID"
    IN
        IF critical_count >= 2 THEN "FAILED"
        ELSE IF sensor_invalid /\ unhealthy_count >= 1 THEN "FAILED"
        ELSE IF vote = "INSUFFICIENT_DATA" THEN "SAFE_MODE"
        ELSE IF sensor_invalid THEN "SAFE_MODE"
        ELSE IF vote = "SPLIT" THEN "SAFE_MODE"
        ELSE IF critical_count >= 1 THEN "SAFE_MODE"
        ELSE IF unhealthy_count >= 1 THEN "DEGRADED"
        ELSE "NORMAL"

(*
  Domain of inputs. All reachable combinations satisfy
  ``critical_count <= unhealthy_count`` because every CRITICAL
  controller is also above the SUSPECT threshold (see comment on
  NumControllers). The Python exhaustive checker enforces the same
  domain restriction.
*)
Inputs ==
    { in \in
        [ vote: VoteOutcomes
        , sensor: SensorStatuses
        , critical_count: 0..NumControllers
        , unhealthy_count: 0..NumControllers
        ]
      : in.critical_count <= in.unhealthy_count
    }

(* I1 — analogue: in FAILED, the manager forces ABORT. The action
   restriction itself is in `restrict_action`; the spec for the mode
   is "FAILED is reachable iff the FAILED preconditions hold". *)
I1_FailedPrecondition(in) ==
    EvaluateMode(in.vote, in.sensor, in.critical_count, in.unhealthy_count) = "FAILED"
    => in.critical_count >= 2 \/ (in.sensor = "INVALID" /\ in.unhealthy_count >= 1)

(* I3 — direct NORMAL -> FAILED is permitted (ADR 0008). The spec
   permits this by construction; the theorem is a sanity check that
   the precondition is consistent with FAILED reachability. *)
THEOREM Direct_Normal_To_Failed_Reachable ==
    \E in \in Inputs :
        EvaluateMode(in.vote, in.sensor, in.critical_count, in.unhealthy_count) = "FAILED"

(* I4 — healthy quorum implies NORMAL. *)
I4_HealthyQuorumIsNormal(in) ==
    /\ in.vote = "CONSENSUS"
    /\ in.sensor = "OK"
    /\ in.unhealthy_count = 0
    /\ in.critical_count = 0
    => EvaluateMode(in.vote, in.sensor, in.critical_count, in.unhealthy_count) = "NORMAL"

(* The full safety theorem: every input combination produces a
   well-defined mode in Modes, and the I1/I4 implications hold. *)
THEOREM SafeMode_Sound ==
    \A in \in Inputs :
        /\ EvaluateMode(in.vote, in.sensor, in.critical_count, in.unhealthy_count) \in Modes
        /\ I1_FailedPrecondition(in)
        /\ I4_HealthyQuorumIsNormal(in)

==============================================================================
