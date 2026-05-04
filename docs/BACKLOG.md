# SentinelNav Backlog

Drift control: anything I notice while working on phase X but that is
not on phase X's task list lands here. The backlog is sacred. Items
move to a phase when they get prioritized; they never get done out of
band.

## Open

- [ ] Generate `frontend/types/api.ts` from the OpenAPI schema instead
      of hand-writing it. (Source: ADR 0005 tradeoff.)
- [ ] Replace `_fault_active_this_step` and `_intermittent_active`
      in `simulation/sensors.py` and `simulation/controllers.py` with
      a single helper after Phase 1.1's centralized RNG lands.
- [ ] Persist `trust.snapshot()` per step so the report can chart
      health-over-time, not just final state. (Source: PR #2 tradeoffs.)
- [ ] Reconcile the two detectors per ADR 0001. Targeted for after
      Phase 5.
- [ ] Default the SQLite path to a project-local file so docker
      restarts retain demo state. Phase 10 may handle this.

## Done (this phase)

(Items move here as they ship.)
