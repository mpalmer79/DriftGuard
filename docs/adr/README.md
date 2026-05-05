# Architecture Decision Records

Each load-bearing decision in SentinelNav has an ADR. New decisions are
appended sequentially. Old ADRs are never rewritten — when a decision
changes, supersede it with a new ADR and mark the old one accordingly.

| #    | Title | Status |
| ---- | ----- | ------ |
| 0001 | Dual fault detectors (counter + windowed trust) | Accepted |
| 0002 | Majority-of-three voting, not weighted or Bayesian | Accepted |
| 0003 | SQLite, not Postgres | Accepted |
| 0004 | Determinism enforced through seed propagation | Accepted (RNG paragraph superseded by 0006) |
| 0005 | FastAPI + Next.js, not a single full-stack framework | Accepted |
| 0006 | Centralized seeded RNG service with named children | Accepted (Phase 1.1) |
| 0007 | 3-DOF dynamics layered under the legacy kinematic update | Accepted (Phase 2.1/2.2) |
| 0008 | Direct NORMAL → FAILED transitions are permitted | Accepted (Phase 3.1) |

Use `0000-template.md` as the starting point.
