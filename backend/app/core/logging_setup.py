"""Structured logging setup (Phase 4.1).

Configures structlog so every event the simulation emits has a
parallel structured log line. The format is environment-driven:

- ``SENTINEL_LOG_FORMAT=json`` (or unset in production) → JSON output.
- ``SENTINEL_LOG_FORMAT=console`` → human-friendly output for dev.

The configuration is idempotent — calling ``configure_logging`` more
than once (e.g. in tests) does not stack processors.

Each log line carries:

- ``timestamp`` (UTC, ISO-8601)
- ``level`` (info / warning / critical)
- ``event`` (the human-readable message)
- ``simulation_id``, ``step``, ``component``, ``type``, ``severity``,
  ``cid`` (correlation id = ``f"{simulation_id}:{step}"``)
- ``request_id`` (when emitted from inside an HTTP request, threaded
  through the Phase 4.5 contextvar)
"""

from __future__ import annotations

import logging
import os
import sys

import structlog

from ..api.middleware import current_request_id

_CONFIGURED = False


def configure_logging() -> None:
    """Idempotently configure structlog for the current process."""

    global _CONFIGURED
    if _CONFIGURED:
        return

    fmt = os.environ.get("SENTINEL_LOG_FORMAT", "json").lower()
    level = os.environ.get("SENTINEL_LOG_LEVEL", "INFO").upper()

    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(message)s",
        stream=sys.stdout,
    )

    processors: list = [
        structlog.contextvars.merge_contextvars,
        _inject_request_id,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
    ]
    if fmt == "console":
        processors.append(structlog.dev.ConsoleRenderer(colors=False))
    else:
        processors.append(structlog.processors.JSONRenderer(sort_keys=True))

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, level, logging.INFO)),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    _CONFIGURED = True


def _inject_request_id(logger, method_name, event_dict):
    """Pull the contextvar request id (set by the middleware) into the
    event dict if present. Outside a request the field is omitted."""

    rid = current_request_id.get()
    if rid is not None:
        event_dict.setdefault("request_id", rid)
    return event_dict


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Get a configured structlog logger.

    Configures on first call so import-time loggers in modules that
    might run outside the FastAPI app (CLI, scripts) do not need to
    remember the bootstrap step.
    """

    configure_logging()
    return structlog.get_logger(name)
