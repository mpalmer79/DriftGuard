# Deployment

SentinelNav is a small two-process system: a FastAPI backend and a
Next.js frontend. Both ship with Dockerfiles.

## Local development

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
pytest -q
```

Frontend:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The frontend reads `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`).

## Docker

```bash
docker compose up --build
```

Brings up:

- backend on `:8000`
- frontend on `:3000`

The frontend container is wired to point at the backend service.

## Production notes

- The default repository uses an in-memory SQLite database, which is
  fine for demos and resets between processes. To persist runs, point
  the `Database(path=...)` to a mounted volume.

### CORS allowlist (Phase 8.5)

Set `SENTINEL_CORS_ORIGINS` to a comma-separated list of allowed
origins:

```bash
export SENTINEL_CORS_ORIGINS="https://app.example.com,https://staging.example.com"
```

Default is `http://localhost:3000,http://127.0.0.1:3000` (dev). The
literal `*` is permitted as an explicit wildcard but should never
ship to production.

### Bearer-token auth on writes (Phase 8.3)

Set `SENTINEL_API_TOKEN` to require an `Authorization: Bearer <token>`
header on every state-mutating request (`POST /simulations`,
`POST /simulations/{id}/step`, `POST /simulations/{id}/faults`,
`POST /scenarios`, `POST /scenarios/{name}/run[/{steps}]`,
`DELETE /scenarios/{name}`).

```bash
export SENTINEL_API_TOKEN="$(openssl rand -hex 32)"
```

When unset, the API is open (dev mode). Read endpoints (`GET /...`)
are never gated by the token — observability tools are expected to
scrape without auth.

Failed auth returns `401` with body
`{"error": {"code": "unauthorized", "message": "..."}}` per the
Phase 8.6 error taxonomy.

### Resource caps (Phase 8.4)

Compile-time constants in `app/simulation/orchestrator.py`:

- `Simulation.MAX_STEPS = 10_000`
- `Simulation.MAX_FAULTS = 100`

And in `app/api/dependencies.py`:

- `MAX_REGISTRY_SIZE = 100` — LRU eviction on the in-memory
  simulation registry. Persisted simulations remain accessible
  through the read endpoints.

Hitting any cap returns `429` with code `capacity_exceeded`.
