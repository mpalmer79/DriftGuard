# DriftGuard Frontend

Next.js 15 + TypeScript + Tailwind CSS dashboard for the DriftGuard
backend.

## Pages

- `/` — landing
- `/dashboard` — list / create simulations, run steps
- `/scenarios` — list and run built-in scenarios
- `/scenarios/new` — author a YAML scenario
- `/simulations/[id]` — detail view (state, faults, decisions, events)
- `/simulations/[id]/live` — SSE stream of an in-flight run
- `/simulations/[id]/replay` — step-by-step replay
- `/simulations/[id]/report` — mission report (JSON + Markdown)

## Run

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE` to the backend URL (defaults to
`http://localhost:8000`). For write traffic, the auth proxy reads
`SENTINEL_API_TOKEN` server-side; see `docs/DEPLOYMENT.md`.

## Build

```bash
npm run build
npm start
```

## Type / lint / test

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test            # vitest unit tests
npm run test:e2e        # playwright smoke
```
