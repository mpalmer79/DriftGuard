# ADR 0005: FastAPI + Next.js, not a single full-stack framework

- **Status**: Accepted
- **Date**: 2026-05-04
- **Phase**: Backfill (Phase 0.4)

## Context

The system has two surfaces: a simulation API consumed by both the
frontend and direct callers (curl, scripts, tests), and a UI that lets
a human inspect simulation runs interactively.

Options:

1. A single full-stack framework (Django + templates, Phoenix + LiveView,
   Rails, Remix, ...).
2. A backend service plus a separate frontend SPA, talking over a
   typed JSON API.

## Decision

Two services:

- **Backend**: Python + FastAPI. Pydantic schemas, a small repository
  layer, an in-process simulation core. Easy to run as a script or a
  uvicorn process. Easy to test with `httpx.TestClient`.
- **Frontend**: Next.js 14 with the App Router, TypeScript, Tailwind.
  All API calls go through a single typed client (`frontend/lib/api.ts`)
  and types live in `frontend/types/api.ts`.

## Consequences

### Positive

- The backend is independently usable. A reviewer can curl every
  endpoint without spinning up a frontend.
- The frontend is independently deployable. It can talk to a hosted
  backend or a local one through `NEXT_PUBLIC_API_BASE`.
- The simulation core is pure Python. Nothing about HTTP, React, or
  TypeScript leaks into it. This keeps the determinism claim clean.
- The two stacks can be tested with stack-native tools (`pytest`,
  `vitest`, `playwright`).

### Negative / Tradeoffs

- We maintain two type systems. The Python schemas are the source of
  truth; the TypeScript types are hand-written from the same shape.
  A drift here is a real cost. (Future: generate TS types from the
  OpenAPI schema.)
- Two CI pipelines. One for each stack.

### Neutral

- The CORS configuration becomes an explicit decision (Phase 8.5).

## Alternatives Considered

### Server-rendered Django / Rails
Faster to start, but fights the goal of having a clean machine-readable
API. We want the simulation to be scriptable from the outside.

### Next.js full-stack with API routes
Possible, but Python is the right home for the simulation core
(`numpy` familiarity, scientific tooling, future JAX/SciPy options).
Putting the simulation in a Next.js route would either require
porting it to TypeScript or running a Python sidecar — at which point
we are back to two services without the upside.

## References

- Code: `backend/app/main.py`, `frontend/lib/api.ts`, `frontend/types/api.ts`
- Related: ADR 0003 (SQLite — sympathetic with the in-process backend
  story).
