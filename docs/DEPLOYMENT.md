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
- The backend exposes CORS for any origin so the frontend works in
  any environment. Tighten this for production.
- The backend has no auth. Run it behind your own gateway when
  exposing to the internet.
