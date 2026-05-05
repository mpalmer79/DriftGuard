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

### Container hardening (Phase 9)

Both Dockerfiles are multi-stage, pinned to specific minor versions
of their base images, and drop to a non-root runtime user:

- **backend** — `python:3.11.9-slim-bookworm`, builder stage installs
  into `/opt/venv`, runtime stage copies the venv only. Drops to uid
  1000 (`sentinel`). `HEALTHCHECK` polls `/health`.
- **frontend** — `node:20.18-alpine`, ships the Next.js standalone
  bundle (no `node_modules` in runtime). Drops to uid 1001 (`nextjs`).
  `HEALTHCHECK` polls `/`.

`docker-compose.yml` adds defense-in-depth flags: `read_only: true`
root filesystem with `/tmp` tmpfs, `no-new-privileges`, and
`cap_drop: ALL`. Frontend depends on `backend: service_healthy` so
the API is reachable before Next.js boots.

### Supply-chain CI (Phase 9.3 + 9.4)

`.github/workflows/supply-chain.yml` runs on every push, every PR,
and a weekly cron:

- **SBOM** — Anchore syft emits per-target CycloneDX JSON SBOMs as
  workflow artifacts (30-day retention). Useful for auditors and for
  diffing dependencies between releases.
- **Vulnerability scan** — Aqua Trivy filesystem scan against
  `backend/` and `frontend/`, fails on `HIGH`/`CRITICAL`.
  `ignore-unfixed: true` so we do not block on advisories with no
  upstream patch yet.

Combined with the Phase 8.7 `bandit` + `pip-audit` gates on the
backend workflow, this gives layered coverage: bandit (Python static
analysis), pip-audit (PyPI advisories), Trivy (GHSA + OSV + Aqua DB,
plus npm coverage).

## Production notes

- The default repository uses an in-memory SQLite database, which is
  fine for demos and resets between processes. To persist runs, point
  the `Database(path=...)` to a mounted volume.

### Rate limiting (Phase 8.2)

A small in-process sliding-window limiter is installed by
`install_rate_limiter` in `app/api/rate_limit.py`. Defaults:

- 60 requests/min per client IP for `POST`/`DELETE`/`PUT`/`PATCH`
- 600 requests/min per client IP for everything else
- `/metrics` is exempt so Prometheus scrapers can poll continuously

Tunable via:

- `SENTINEL_RATE_LIMIT_WRITE_PER_MIN` (default 60)
- `SENTINEL_RATE_LIMIT_READ_PER_MIN` (default 600)
- `SENTINEL_RATE_LIMIT_DISABLED=1` short-circuits all checks. The
  test suite sets this in `conftest.py` to avoid coupling to
  wall-clock timing; production deployments should leave it unset.

Read and write buckets are tracked separately, so a flood of
`POST` requests does not consume read capacity. Hitting either cap
returns `429` with body
`{"error": {"code": "rate_limited", "message": "..."}}` and a
`retry-after: 60` header.

The limiter is in-process: it does not coordinate across replicas.
For horizontally-scaled deployments, terminate rate limiting at the
edge (nginx, Envoy, an API gateway) and treat this layer as a
defense-in-depth backstop.

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

### Security scanning in CI (Phase 8.7)

The backend CI workflow runs two security gates on every push and PR:

- `bandit -q -r app -c pyproject.toml` — static analysis for common
  Python security smells. `B311` (non-crypto `random`) is skipped
  by configuration: deterministic Mersenne-Twister RNG is a
  load-bearing project property (replay, fuzz reproducibility, ADR
  0006), and cryptographic randomness would actively break the
  simulation contract.
- `pip-audit -r requirements.txt -r requirements-dev.txt` — checks
  installed dependencies against the PyPI advisory database.
  We use `pip-audit` (PyPA-maintained, no auth required) instead of
  `safety`, which now requires an account for non-trivial use; the
  acceptance criterion "safety clean" is satisfied by an equivalent
  vulnerability gate.

Both steps are mandatory — failure breaks the build.
