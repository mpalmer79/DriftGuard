# syntax=docker/dockerfile:1.7
# Pinned base image (slim-bookworm) for reproducible builds. Update by
# bumping the tag — Renovate/Dependabot can be wired to do it for us.
FROM python:3.11.9-slim-bookworm AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Install only what is needed to compile native wheels. None of the
# project's runtime deps require a compiler today, but keeping the
# split lets future additions stay in the builder stage.
RUN apt-get update \
    && apt-get install --no-install-recommends -y build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip
RUN --mount=type=cache,id=sentinelnav-backend-pip,target=/root/.cache/pip \
    /opt/venv/bin/pip install -r requirements.txt


FROM python:3.11.9-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}"

# Non-root user for the runtime container. UID/GID match the slim
# image's nobody-equivalent and keep the layout reproducible.
RUN groupadd --system --gid 1000 sentinel \
    && useradd --system --uid 1000 --gid sentinel --create-home sentinel

# Bring in the prebuilt virtualenv from the builder stage.
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY app ./app
RUN chown -R sentinel:sentinel /app

USER sentinel
EXPOSE 8000

# Readiness probe. Railway sets $PORT at runtime; the local Compose
# default is 8000 (set in docker-compose.yml). The shell-form CMD
# expands the variable; the JSON-array form does not.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import os,urllib.request,sys; p=os.environ.get('PORT','8000'); sys.exit(0 if urllib.request.urlopen(f'http://127.0.0.1:{p}/readyz',timeout=2).status==200 else 1)"

# Bind to $PORT (Railway-assigned) or 8000 (local default). The
# shell form is required so the variable is expanded by /bin/sh
# before uvicorn sees it.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
