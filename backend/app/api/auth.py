"""Optional bearer-token guard for write endpoints (Phase 8.3).

If ``SENTINEL_API_TOKEN`` is set, every state-mutating request must
include ``Authorization: Bearer <token>``. If unset, write endpoints
are open — this is dev mode and the readme/deployment docs call it
out explicitly.

Read endpoints (`GET /...`) are unaffected: the simulation is a
read-mostly artifact and observability tools are expected to scrape
without auth.
"""

from __future__ import annotations

import hmac
import os

from fastapi import Request

from ..core.exceptions import AuthError

_HEADER = "authorization"
_PREFIX = "bearer "


def _expected_token() -> str | None:
    # NOTE: ``SENTINEL_API_TOKEN`` is a legacy env-var name kept for
    # backwards compatibility with existing Railway / docker-compose
    # deployments that pre-date the SentinelNav -> DriftGuard rename
    # (2026-05). Renaming would silently break those deployments, so
    # the prefix is intentionally retained. See docs/DEPLOYMENT.md
    # ("Env var naming") for the full list.
    raw = os.environ.get("SENTINEL_API_TOKEN")
    if raw is None:
        return None
    raw = raw.strip()
    return raw or None


def require_write_auth(request: Request) -> None:
    """FastAPI dependency that enforces the bearer token on writes.

    No-op when ``SENTINEL_API_TOKEN`` is unset. Raises ``AuthError``
    on missing or mismatched header so the Phase 8.6 handler renders
    a 401.
    """

    expected = _expected_token()
    if expected is None:
        return
    raw = request.headers.get(_HEADER, "")
    if not raw or not raw.lower().startswith(_PREFIX):
        raise AuthError("missing or malformed Authorization header")
    supplied = raw[len(_PREFIX) :].strip()
    # Constant-time compare so a timing side-channel does not leak the
    # token byte-by-byte. The cost over `==` is negligible at our QPS.
    if not hmac.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8")):
        raise AuthError("invalid bearer token")
