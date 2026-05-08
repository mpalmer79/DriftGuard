# Deploying DriftGuard to Railway

This runbook gets a fresh DriftGuard stack running on Railway in under
10 minutes. It assumes a free or hobby Railway account and a GitHub
account with this repo connected.

The result is a two-service Railway project:
- **driftguard-backend** — FastAPI, SQLite on a persistent volume
- **driftguard-frontend** — Next.js 15, server-side auth proxy

## One-time prerequisites

1. A Railway account (https://railway.app).
2. The Railway GitHub app installed on the account/org that owns
   this repo. (Railway prompts for this on first deploy.)
3. The repo pushed to GitHub with `backend/`, `frontend/`,
   `backend/railway.toml`, and `frontend/railway.toml` on the default
   branch.

## Step 1 — Create the project + backend service

1. In the Railway dashboard, click **New Project → Deploy from GitHub repo**.
2. Select the `DriftGuard` repo.
3. When asked for the root directory, enter **`backend`** and click
   Deploy.
4. After the first build finishes, open the service's **Settings**:
   - Rename the service to `driftguard-backend`.
   - Under **Networking → Public Networking**, click **Generate Domain**
     and copy the URL (it will look like
     `driftguard-backend-production.up.railway.app`). Save this — it
     is the **public backend URL**.
   - Under **Networking → Private Networking**, copy the internal DNS
     name (it will look like `driftguard-backend.railway.internal`).
     Save this — it is the **private backend URL**. The port on the
     private network is the same `$PORT` Railway assigned the service.

## Step 2 — Attach a volume for SQLite persistence

1. In the backend service, open the **Volumes** tab.
2. Click **New Volume**.
3. Set the **Mount Path** to **`/data`** (exactly — no trailing slash).
4. Size: **1 GB** is plenty (the SQLite database for portfolio-scale
   simulations is well under 100 MB).
5. Click Add. Railway redeploys the service with the volume attached.

## Step 3 — Set backend environment variables

In the backend service, open **Variables** and add:

| Variable | Value |
|---|---|
| `SENTINEL_DB_PATH` | `/data/driftguard.db` |
| `SENTINEL_CORS_ORIGINS` | *(leave unset for now — set in Step 6 once frontend domain is known)* |
| `SENTINEL_API_TOKEN` | A long random string (e.g. `python -c "import secrets; print(secrets.token_urlsafe(32))"`). Save this value. |
| `SENTINEL_TRUSTED_PROXIES` | `0.0.0.0/0` |

Notes:
- The `SENTINEL_*` env-var prefix is retained for backwards
  compatibility with deployments that pre-date the SentinelNav →
  DriftGuard rename. See `docs/DEPLOYMENT.md` ("Env var naming").
- `SENTINEL_TRUSTED_PROXIES = 0.0.0.0/0` tells the rate limiter to
  honor `x-forwarded-for` (Railway's edge proxy injects it). This is
  appropriate because Railway is the only thing that can reach the
  service. If you ever expose the backend through a different proxy
  topology, tighten this to Railway's edge CIDR.
- `SENTINEL_API_TOKEN` is required for write traffic. The frontend
  proxy reads the same value (Step 5) and injects it.

Click **Deploy** to apply.

## Step 4 — Add the frontend service

1. In the same Railway project, click **New → GitHub Repo** and
   select the same DriftGuard repo.
2. Set the root directory to **`frontend`**. Deploy.
3. After the first build finishes, open the service's **Settings**:
   - Rename to `driftguard-frontend`.
   - Under **Networking → Public Networking**, click **Generate Domain**.
     Copy the URL — this is the **public frontend URL**, the one users
     will hit.

## Step 5 — Set frontend environment variables

In the frontend service, open **Variables** and add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE` | The **public backend URL** from Step 1, *with `https://` prefix* |
| `SENTINEL_BACKEND_URL` | `http://<private-backend-dns>:<port>` — see note below |
| `SENTINEL_API_TOKEN` | Exactly the same value you set on the backend in Step 3 |

The `SENTINEL_BACKEND_URL` value uses Railway's private networking. It
should look like:

```
http://driftguard-backend.railway.internal:8000
```

The hostname is the private DNS name from Step 1. The port is `8000`
unless you changed the `EXPOSE` directive in `backend/Dockerfile`.
Railway routes private-network traffic to the container's internal
listening port, which is `$PORT` — but for private networking the
target port is whatever the service publishes, which Railway resolves
from the Dockerfile `EXPOSE` directive. Use `8000`.

Click **Deploy**.

## Step 6 — Wire CORS back to the frontend domain

1. Return to the **backend service → Variables**.
2. Set `SENTINEL_CORS_ORIGINS` to the public frontend URL from Step 4,
   with the `https://` prefix and **no trailing slash**. Example:
   ```
   https://driftguard-frontend-production.up.railway.app
   ```
3. **Save / Deploy.** The backend redeploys with the correct CORS
   allowlist.

## Step 7 — Smoke test

Open the public frontend URL in a browser. Confirm:

1. The landing page renders with the DriftGuard header.
2. Navigating to `/dashboard` works.
3. Creating a simulation via the UI succeeds (this exercises the
   write path: browser → frontend proxy → backend with bearer token).
4. The simulation persists across a backend redeploy: trigger a
   manual backend redeploy from the Railway dashboard, then refresh
   the dashboard — the simulation you created is still listed.

If any of these fails, see the **Troubleshooting** section below.

## Step 8 — Set the production-grade defaults

In the backend service, **Settings → Health Check**:
- Path: `/readyz` (already set by `railway.toml`)
- Timeout: 30s

In both services, **Settings → Restart Policy**:
- On Failure, max 10 retries (already set by `railway.toml`)

In both services, **Settings → Replicas**: 1.

## Troubleshooting

**Backend healthcheck fails (service stays in "Deploying" forever)**
- Check the deploy logs for `SQLite database is locked` or
  `permission denied`. The volume mount path must be `/data` and the
  container's non-root `sentinel` user (UID 1000) must be able to
  write there. Railway's volume defaults to root:root ownership; if
  you see permission errors, the workaround is to set
  `SENTINEL_DB_PATH` to `/tmp/driftguard.db` temporarily to confirm
  the rest of the stack works, then file a ticket with Railway about
  the volume ownership. (As of this writing, Railway volumes mount
  with permissive defaults and this is rarely a problem.)

**Frontend → backend calls 404 with a "Failed to fetch" message**
- `NEXT_PUBLIC_API_BASE` is wrong, missing the `https://` prefix, or
  has a trailing slash. The browser console will show the exact URL
  it dialed.

**Frontend → backend calls return 401**
- `SENTINEL_API_TOKEN` differs between the two services, or is unset
  on one. They must match exactly.

**Frontend → backend calls return CORS errors**
- `SENTINEL_CORS_ORIGINS` on the backend does not include the
  frontend's public URL, or has a trailing slash.

**Auth proxy logs `ENOTFOUND driftguard-backend.railway.internal`**
- The private DNS name is wrong. Verify it under the backend
  service's **Settings → Networking → Private Networking**. Railway
  uses lowercase hyphenated service names; if you renamed the
  service, the private DNS name follows the rename.

## Cost expectations

A two-service Railway hobby deployment with one volume runs
approximately:
- Backend: ~$5/month (always-on, ~256 MB RAM)
- Frontend: ~$5/month (always-on, ~256 MB RAM)
- Volume: ~$0.25/month per GB

For portfolio use, set both services to the **Hobby** tier and turn
on **sleep on inactivity** if you only need them up during interviews.

## What this deployment does *not* do

These are intentionally out of scope and documented in
`docs/OBSERVABILITY.md` under "Known limits":

- **No multi-replica scaling.** The simulation registry and rate
  limiter are per-process. `numReplicas = 1` is enforced in
  `railway.toml`. Scaling beyond one replica requires moving both to
  a shared store (Redis). See the project Roadmap in `README.md`.
- **No managed database.** Persistence is single-node SQLite on the
  Railway volume. A real production deployment would migrate to
  Postgres; ADR 0003 documents why this project deliberately stayed
  on SQLite.
- **No CDN for the frontend.** Railway serves the Next.js app
  directly. For portfolio scope this is fine; for production traffic
  put Cloudflare or Railway's edge in front.
