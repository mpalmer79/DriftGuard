"""OpenTelemetry tracing setup (Phase 4.3).

Tracing is opt-in. By default ``init_tracing`` is a no-op and
``tracer()`` returns the OTel global tracer, which silently records
no spans. Setting ``SENTINEL_TRACING=1`` (or calling
``init_tracing(force=True)`` from a test) wires the SDK with the
console span exporter so every step produces an inspectable trace
tree even without a collector.

Per the directive's ML / advisory rule: tracing exists as
observability evidence; it is never on the decision path.
"""

from __future__ import annotations

import os

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
    SimpleSpanProcessor,
)

_INITIALIZED = False
_TRACER_NAME = "sentinelnav"


def _enabled_via_env() -> bool:
    return os.environ.get("SENTINEL_TRACING", "").lower() in ("1", "true", "yes")


def init_tracing(*, force: bool | None = None, console: bool = True) -> None:
    """Idempotently configure the OTel tracer provider.

    Args:
        force: When ``True``, configure even if ``SENTINEL_TRACING``
            is unset. When ``False``, never configure (used to
            forcibly disable in tests). When ``None`` (default), use
            the env var.
        console: Attach the console exporter when configuring. The
            test path uses a SimpleSpanProcessor so each span is
            visible immediately.
    """

    global _INITIALIZED
    if _INITIALIZED:
        return

    if force is False:
        return
    if force is None and not _enabled_via_env():
        return

    provider = TracerProvider()
    if console:
        # SimpleSpanProcessor is synchronous: spans appear in the
        # console as they end, which is what the dev console output
        # in the directive's acceptance criteria implies.
        provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
    else:
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)
    _INITIALIZED = True


def tracer():
    """Return a tracer.

    When tracing is uninitialized, the OTel default no-op tracer is
    returned, so call sites can wrap stages in
    ``with tracer().start_as_current_span(...)`` unconditionally.
    """

    return trace.get_tracer(_TRACER_NAME)


def reset_for_tests() -> None:
    """Drop the configured provider so a test can re-initialize.

    Production code never calls this. Tests that exercise the SDK
    side effects use it to switch the global provider between
    runs."""

    global _INITIALIZED
    _INITIALIZED = False
    # Replace the provider with the default proxy. There is no public
    # API to "uninstall"; the proxy provider behaves as a no-op until
    # something calls set_tracer_provider again.
    trace._TRACER_PROVIDER = None  # type: ignore[attr-defined]
