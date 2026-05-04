# SentinelNav Frontend

Next.js 14 + TypeScript + Tailwind CSS dashboard for the SentinelNav
backend.

## Pages

- `/` — landing
- `/dashboard` — list/create simulations, run steps
- `/scenarios` — list and run built-in scenarios
- `/simulations/[id]` — detail view (state, faults, decisions, events)
- `/simulations/[id]/replay` — step-by-step replay with controls
- `/simulations/[id]/report` — mission report (JSON + Markdown)

## Run

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE` to the backend URL (defaults to
`http://localhost:8000`).

## Build

```bash
npm run build
npm start
```

## Type / lint

```bash
npm run typecheck
```
