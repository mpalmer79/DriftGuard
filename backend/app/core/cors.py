"""CORS allowlist resolution (Phase 8.5).

Reads SENTINEL_CORS_ORIGINS as a comma-separated list. Defaults to
the local frontend dev origin. Supports the literal "*" as an
explicit dev override; production deployments should set a real list.
"""

from __future__ import annotations

import os

_DEFAULT_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")


def allowed_origins() -> list[str]:
    raw = os.environ.get("SENTINEL_CORS_ORIGINS")
    if raw is None:
        return list(_DEFAULT_ORIGINS)
    items = [item.strip() for item in raw.split(",") if item.strip()]
    return items or list(_DEFAULT_ORIGINS)
