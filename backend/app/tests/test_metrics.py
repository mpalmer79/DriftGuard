"""Metrics registry tests (Phase 4.2).

Focused on the metric definitions themselves and the render
contract; orchestrator-side hooks are pinned by the integration
tests in ``test_metrics_endpoint.py`` (Phase 4.2 followup).
"""

import pytest

from app.core import metrics


@pytest.fixture(autouse=True)
def _isolated_registry():
    metrics.reset_registry()
    yield
    metrics.reset_registry()


def test_render_returns_text_and_content_type():
    payload, ctype = metrics.render()
    assert isinstance(payload, bytes)
    assert ctype.startswith("text/plain")


def test_simulation_steps_counter_labels_by_id():
    metrics.simulation_steps_total.labels(simulation_id="sim-a").inc()
    metrics.simulation_steps_total.labels(simulation_id="sim-a").inc()
    metrics.simulation_steps_total.labels(simulation_id="sim-b").inc()

    payload, _ = metrics.render()
    text = payload.decode()
    assert 'sentinel_simulation_steps_total{simulation_id="sim-a"} 2.0' in text
    assert 'sentinel_simulation_steps_total{simulation_id="sim-b"} 1.0' in text


def test_decisions_counter_labels_mode_and_action():
    metrics.decisions_total.labels(mode="NORMAL", action="HOLD").inc()
    metrics.decisions_total.labels(mode="SAFE_MODE", action="STABILIZE").inc()
    payload, _ = metrics.render()
    text = payload.decode()
    assert 'sentinel_decisions_total{action="HOLD",mode="NORMAL"} 1.0' in text
    assert 'sentinel_decisions_total{action="STABILIZE",mode="SAFE_MODE"} 1.0' in text


def test_step_duration_histogram_observes():
    metrics.step_duration_seconds.observe(0.012)
    metrics.step_duration_seconds.observe(0.7)
    payload, _ = metrics.render()
    text = payload.decode()
    assert "sentinel_step_duration_seconds_count 2.0" in text


def test_faults_active_is_a_gauge():
    metrics.faults_active.labels(type="SENSOR_DRIFT", target="sensor").set(1)
    metrics.faults_active.labels(type="SENSOR_DRIFT", target="sensor").set(0)
    payload, _ = metrics.render()
    text = payload.decode()
    assert 'sentinel_faults_active{target="sensor",type="SENSOR_DRIFT"} 0.0' in text


def test_controller_health_one_hot():
    metrics.controller_health.labels(controller_id="controller_a", status="HEALTHY").set(1)
    metrics.controller_health.labels(controller_id="controller_a", status="DEGRADED").set(0)
    payload, _ = metrics.render()
    text = payload.decode()
    assert (
        'sentinel_controller_health{controller_id="controller_a",status="HEALTHY"} 1.0' in text
    )


def test_replay_fingerprint_info_renders_label_kv():
    metrics.replay_fingerprint.labels(simulation_id="sim-x").info(
        {"fingerprint": "deadbeef" * 8}
    )
    payload, _ = metrics.render()
    text = payload.decode()
    assert "sentinel_replay_fingerprint" in text
    assert "deadbeef" in text


def test_reset_registry_clears_all_series():
    metrics.simulation_steps_total.labels(simulation_id="x").inc()
    metrics.reset_registry()
    payload, _ = metrics.render()
    text = payload.decode()
    assert "sentinel_simulation_steps_total{" not in text
