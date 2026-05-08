# ADR 0003: SQLite, not Postgres

- **Status**: Accepted
- **Date**: 2026-05-04
- **Phase**: Backfill (Phase 0.4)

## Context

Persistence requirements: store simulation runs (state per step, sensor
readings, controller outputs, votes, decisions, faults, events) and
serve them back through API endpoints for recovery and reporting.
Throughput is one step every few hundred milliseconds at most. Data
volume is small: a 100-step simulation persists on the order of a few
KB across all tables.

## Decision

Use SQLite, embedded in-process via the standard library `sqlite3`
module. The default deployment uses an in-memory database so each
process starts clean; production deployments can mount a file path.

## Consequences

### Positive

- Zero operational overhead. No separate service to start, no container
  to coordinate, no connection pool to size.
- The schema is defined as a single multi-statement string and applied
  at connect time. Schema migrations to date have been additive.
- Works identically in tests, locally, and in the deployed Docker
  container. Tests use `:memory:` and require no fixtures.
- The data model is exposed through a thin repository layer, so
  swapping to a different backend later (Phase n+1) is a self-contained
  change.

### Negative / Tradeoffs

- No concurrent writers. DriftGuard has a single writer (the API
  process) so this is not a current limitation; it would matter for a
  multi-vehicle fleet running in parallel processes.
- No native JSON column type. We serialize complex fields with
  `json.dumps`. This is fine for the volumes involved.
- No replication, no point-in-time recovery. The deployment story
  assumes a single mounted volume.

### Neutral

- The repository module size grew to the point that we are
  decomposing it (Phase 0.5).

## Alternatives Considered

### Postgres
Mature, concurrent, JSON-native. The right answer for a multi-tenant
service. The wrong answer for a single-process deterministic simulator
where adding it would inflate the deployment footprint without
unlocking a use case we have.

### A flat append-only event log with no DB
Tempting for the determinism story (the canonical record IS the event
stream). Rejected because the report and recovery endpoints want
per-table queries, and reconstructing those from a stream every request
would push complexity into the application layer.

## References

- Code: `backend/app/persistence/database.py`
