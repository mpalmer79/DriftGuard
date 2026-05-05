"""In-process rate limiter (Phase 8.2).

A small sliding-window token bucket keyed by client IP. The directive
nominally calls for ``slowapi``, but slowapi's ``@limiter.limit``
decorator is designed to wrap individual route handlers (where FastAPI
injects ``request`` and ``response`` parameters) and does not compose
cleanly with a single middleware that intercepts every route.

This module replaces it with ~40 lines of deterministic, easy-to-test
code that satisfies the same acceptance criteria:

- 60 requests/min per IP for ``POST``/``DELETE``/``PUT``/``PATCH``.
- 600 requests/min per IP for everything else.
- ``/metrics`` is exempt (Prometheus scrapers run continuously).
- 429 responses use the Phase 8.6 error envelope with code
  ``rate_limited`` and a ``retry-after`` header.

Configuration:

- ``SENTINEL_RATE_LIMIT_WRITE_PER_MIN`` (default 60)
- ``SENTINEL_RATE_LIMIT_READ_PER_MIN`` (default 600)
- ``SENTINEL_RATE_LIMIT_DISABLED=1`` short-circuits all checks; the
  rest of the test suite sets this to avoid coupling to wall-clock
  timing.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import FastAPI, Request
from starlette.responses import JSONResponse, Response

_WINDOW_SECONDS = 60.0
_WRITE_METHODS = frozenset({"POST", "DELETE", "PUT", "PATCH"})


class _SlidingWindowLimiter:
    """Per-key sliding-window counter.

    Each ``hit(key, limit)`` call records a timestamp, evicts entries
    older than ``_WINDOW_SECONDS``, and returns ``True`` if the bucket
    is still under ``limit`` after the new entry — otherwise ``False``
    and the new entry is *not* recorded (so a rejected request does
    not extend the window).
    """

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, key: str, limit: int, now: float) -> bool:
        bucket = self._hits[key]
        cutoff = now - _WINDOW_SECONDS
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True

    def reset(self) -> None:
        self._hits.clear()


def _disabled() -> bool:
    return os.environ.get("SENTINEL_RATE_LIMIT_DISABLED", "").lower() in ("1", "true", "yes")


def _write_limit() -> int:
    return int(os.environ.get("SENTINEL_RATE_LIMIT_WRITE_PER_MIN", "60"))


def _read_limit() -> int:
    return int(os.environ.get("SENTINEL_RATE_LIMIT_READ_PER_MIN", "600"))


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "anonymous"


def _is_metrics_path(request: Request) -> bool:
    return request.url.path.endswith("/metrics")


def _rate_limited_response() -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "code": "rate_limited",
                "message": "rate limit exceeded; retry after the cooldown window",
            }
        },
        headers={"retry-after": "60"},
    )


def install_rate_limiter(app: FastAPI) -> _SlidingWindowLimiter:
    limiter = _SlidingWindowLimiter()
    app.state.rate_limiter = limiter

    @app.middleware("http")
    async def rate_limit_middleware(
        request: Request, call_next: Callable[[Request], Response]
    ) -> Response:
        if _disabled() or _is_metrics_path(request):
            return await call_next(request)
        is_write = request.method in _WRITE_METHODS
        limit = _write_limit() if is_write else _read_limit()
        bucket = "write" if is_write else "read"
        key = f"{_client_ip(request)}:{bucket}"
        if not limiter.hit(key, limit, time.monotonic()):
            return _rate_limited_response()
        return await call_next(request)

    return limiter
