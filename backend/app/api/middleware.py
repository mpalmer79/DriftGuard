"""ASGI / FastAPI middleware (Phase 4.5).

Currently:

- ``request_id_middleware`` — generates a request id (or accepts an
  inbound ``X-Request-Id`` header), stashes it in
  ``request.state.request_id``, and echoes it back in the response.
  Phase 4.1 reads ``request.state.request_id`` to thread it into
  structured logs.
"""

from __future__ import annotations

import contextvars
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

_HEADER = "x-request-id"

# A context-local request id so library code (the EventLogger plumbing
# in Phase 4.1) can pick it up without threading the request through.
current_request_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_request_id", default=None
)


def install_request_id_middleware(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_id_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        rid = request.headers.get(_HEADER) or _new_request_id()
        request.state.request_id = rid
        token = current_request_id.set(rid)
        try:
            response = await call_next(request)
        finally:
            current_request_id.reset(token)
        response.headers[_HEADER] = rid
        return response


def _new_request_id() -> str:
    return f"req_{uuid.uuid4().hex[:16]}"
