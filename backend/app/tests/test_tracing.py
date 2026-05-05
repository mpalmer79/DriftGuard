"""OpenTelemetry tracing tests (Phase 4.3).

Verifies that a scenario run produces the documented span tree
(step → sensor / controllers / vote / detection / decision /
persistence) inspectable via the in-memory exporter, satisfying
the directive's "spans should exist and be inspectable in dev"
acceptance criterion.

OTel forbids more than one ``set_tracer_provider`` per process,
so the in-memory exporter is installed once at session scope and
tests clear its buffer between runs. Tests that exercise the
``init_tracing`` env-driven behavior are kept to in-process state
(no global provider mutation) to avoid colliding with the
session-scoped provider.
"""

from __future__ import annotations

import pytest
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from app.core import tracing
from app.scenarios import run_scenario


@pytest.fixture(scope="session", autouse=True)
def session_in_memory_exporter():
    """Install a TracerProvider with an in-memory exporter for the whole test
    session. If a provider is already set (e.g. by another test fixture),
    add the exporter as an additional span processor."""

    exporter = InMemorySpanExporter()
    current = trace.get_tracer_provider()
    if isinstance(current, TracerProvider):
        current.add_span_processor(SimpleSpanProcessor(exporter))
    else:
        provider = TracerProvider()
        provider.add_span_processor(SimpleSpanProcessor(exporter))
        trace.set_tracer_provider(provider)
    return exporter


@pytest.fixture
def spans(session_in_memory_exporter):
    session_in_memory_exporter.clear()
    return session_in_memory_exporter


def test_init_tracing_is_no_op_when_env_unset(monkeypatch):
    """When SENTINEL_TRACING is unset and force is None, init_tracing
    must not crash and must not raise. We do not assert global state
    because the session fixture has already installed a provider."""

    monkeypatch.delenv("SENTINEL_TRACING", raising=False)
    tracing.init_tracing()  # no-op path


def test_tracer_returns_a_tracer():
    """The tracer accessor returns a usable tracer regardless of env."""

    tr = tracing.tracer()
    assert tr is not None
    with tr.start_as_current_span("smoke"):
        pass


def test_step_emits_span_tree(spans):
    run_scenario("nominal_cruise", 2)
    names = {s.name for s in spans.get_finished_spans()}

    assert "step" in names
    assert "sensor" in names
    assert "controllers" in names
    assert "vote" in names
    assert "detection" in names
    assert "decision" in names
    assert "persistence" in names
    assert {"controller_a", "controller_b", "controller_c"} <= names


def test_step_span_carries_attributes(spans):
    sim, _ = run_scenario("nominal_cruise", 1)
    step_spans = [s for s in spans.get_finished_spans() if s.name == "step"]
    assert step_spans
    attrs = step_spans[0].attributes or {}
    assert attrs.get("sim.id") == sim.id
    assert attrs.get("step") == 1
