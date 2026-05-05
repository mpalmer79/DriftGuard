"""Structured logging plumbing tests (Phase 4.1).

Verifies that EventLogger emits a parallel structlog line whose
fields mirror the recorded ``Event`` plus the documented correlation
id ``cid = simulation_id:step``. We capture the structlog output
through structlog's own testing utility ``capture_logs``.
"""

import structlog

from app.domain.enums import EventSeverity, EventType
from app.simulation.event_logger import EventLogger


def _capture():
    return structlog.testing.capture_logs()


def test_event_log_emits_structured_line_with_required_fields():
    logger = EventLogger(simulation_id="sim-1")
    with _capture() as captured:
        logger.log(
            step=3,
            timestamp=3.0,
            component="sensor",
            type=EventType.SENSOR,
            severity=EventSeverity.INFO,
            message="sensor status OK",
            metadata={"flags": [], "confidence": 1.0},
        )

    assert len(captured) == 1
    line = captured[0]
    assert line["event"] == "sensor status OK"
    assert line["simulation_id"] == "sim-1"
    assert line["step"] == 3
    assert line["component"] == "sensor"
    assert line["type"] == "SENSOR"
    assert line["severity"] == "INFO"
    assert line["cid"] == "sim-1:3"
    assert line["metadata"] == {"flags": [], "confidence": 1.0}
    assert "event_id" in line
    assert line["log_level"] == "info"


def test_severity_maps_to_log_level():
    logger = EventLogger(simulation_id="s")
    with _capture() as captured:
        logger.log(
            step=1,
            timestamp=1.0,
            component="x",
            type=EventType.FAULT,
            severity=EventSeverity.WARNING,
            message="warn",
        )
        logger.log(
            step=1,
            timestamp=1.0,
            component="x",
            type=EventType.FAULT,
            severity=EventSeverity.CRITICAL,
            message="crit",
        )
    assert captured[0]["log_level"] == "warning"
    assert captured[1]["log_level"] == "critical"


def test_no_simulation_id_means_no_cid():
    logger = EventLogger()
    with _capture() as captured:
        logger.log(
            step=1,
            timestamp=1.0,
            component="x",
            type=EventType.STATE,
            severity=EventSeverity.INFO,
            message="hi",
        )
    line = captured[0]
    assert line["simulation_id"] is None
    assert line["cid"] is None


def test_event_logger_appends_in_memory_before_structlog_call(monkeypatch):
    """In-memory append happens before the structlog emit, so a logger
    crash never loses the audit record. Today EventLogger does not
    swallow logger exceptions; if that policy changes, this test goes
    with it."""

    import contextlib

    logger = EventLogger(simulation_id="z")

    def _boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(logger._slog, "info", _boom)
    with contextlib.suppress(RuntimeError):
        logger.log(
            step=1,
            timestamp=1.0,
            component="x",
            type=EventType.STATE,
            severity=EventSeverity.INFO,
            message="hi",
        )
    assert len(logger.all()) == 1
