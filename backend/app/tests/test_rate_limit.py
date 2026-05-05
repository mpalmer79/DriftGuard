"""Sliding-window rate limiter (Phase 8.2)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.api.rate_limit import _SlidingWindowLimiter
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("SENTINEL_RATE_LIMIT_DISABLED", raising=False)
    monkeypatch.setenv("SENTINEL_RATE_LIMIT_WRITE_PER_MIN", "3")
    monkeypatch.setenv("SENTINEL_RATE_LIMIT_READ_PER_MIN", "5")
    monkeypatch.delenv("SENTINEL_API_TOKEN", raising=False)
    reset_state_for_tests()
    return TestClient(create_app())


def test_writes_capped_with_429_and_code(client):
    # Limit is 3 writes/min; the 4th must 429 with the stable error code.
    for _ in range(3):
        r = client.post("/simulations", json={"seed": 1})
        assert r.status_code in (201, 409)
    r = client.post("/simulations", json={"seed": 1})
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "rate_limited"
    assert r.headers.get("retry-after") == "60"


def test_reads_have_a_separate_higher_cap(client):
    # First saturate writes; reads should still flow up to the read cap.
    for _ in range(3):
        client.post("/simulations", json={"seed": 1})
    for _ in range(5):
        r = client.get("/scenarios")
        assert r.status_code == 200
    r = client.get("/scenarios")
    assert r.status_code == 429


def test_metrics_endpoint_is_exempt(client):
    # Even after saturating reads, /metrics must keep responding.
    for _ in range(5):
        client.get("/scenarios")
    r = client.get("/scenarios")
    assert r.status_code == 429
    r = client.get("/metrics")
    assert r.status_code == 200


def test_disabled_flag_short_circuits(monkeypatch):
    monkeypatch.setenv("SENTINEL_RATE_LIMIT_DISABLED", "1")
    monkeypatch.setenv("SENTINEL_RATE_LIMIT_WRITE_PER_MIN", "1")
    reset_state_for_tests()
    c = TestClient(create_app())
    # Two writes in a row would normally hit the cap; with the kill switch
    # on, both succeed.
    r1 = c.post("/simulations", json={"seed": 1})
    r2 = c.post("/simulations", json={"seed": 2})
    assert r1.status_code == 201
    assert r2.status_code == 201


def test_sliding_window_evicts_old_entries():
    limiter = _SlidingWindowLimiter()
    # Two hits at t=0; cap of 2 is exhausted.
    assert limiter.hit("ip", limit=2, now=0.0) is True
    assert limiter.hit("ip", limit=2, now=0.5) is True
    assert limiter.hit("ip", limit=2, now=1.0) is False
    # 61s later both prior hits have aged out, so we get fresh capacity.
    assert limiter.hit("ip", limit=2, now=61.0) is True
    assert limiter.hit("ip", limit=2, now=61.1) is True
    assert limiter.hit("ip", limit=2, now=61.2) is False


def test_keys_are_independent():
    limiter = _SlidingWindowLimiter()
    assert limiter.hit("a", limit=1, now=0.0) is True
    assert limiter.hit("a", limit=1, now=0.1) is False
    # Different key has its own bucket.
    assert limiter.hit("b", limit=1, now=0.1) is True
