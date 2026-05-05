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


# --- Phase 5.1: trusted-proxy gate on x-forwarded-for ---


class _StubClient:
    def __init__(self, host: str) -> None:
        self.host = host


class _StubRequest:
    """Minimal Request-like stub for unit-testing _client_ip."""

    def __init__(self, peer: str, headers: dict[str, str] | None = None) -> None:
        self.client = _StubClient(peer)
        self.headers = headers or {}


def test_xff_ignored_when_trusted_proxies_unset(monkeypatch):
    """Default behaviour: untrusted env, x-forwarded-for is ignored.

    Before Phase 5.1 the limiter blindly trusted x-forwarded-for, so a
    hostile client could exhaust any peer's per-key budget. Now the
    peer's own IP is used unless SENTINEL_TRUSTED_PROXIES says otherwise.
    """

    from app.api.rate_limit import _client_ip

    monkeypatch.delenv("SENTINEL_TRUSTED_PROXIES", raising=False)
    req = _StubRequest(peer="203.0.113.5", headers={"x-forwarded-for": "1.2.3.4"})
    assert _client_ip(req) == "203.0.113.5"


def test_xff_honored_when_peer_in_trusted_cidr(monkeypatch):
    from app.api.rate_limit import _client_ip

    monkeypatch.setenv("SENTINEL_TRUSTED_PROXIES", "10.0.0.0/8")
    req = _StubRequest(peer="10.1.2.3", headers={"x-forwarded-for": "198.51.100.7"})
    assert _client_ip(req) == "198.51.100.7"


def test_xff_ignored_when_peer_outside_trusted_cidr(monkeypatch):
    from app.api.rate_limit import _client_ip

    monkeypatch.setenv("SENTINEL_TRUSTED_PROXIES", "10.0.0.0/8")
    req = _StubRequest(peer="203.0.113.99", headers={"x-forwarded-for": "1.1.1.1"})
    assert _client_ip(req) == "203.0.113.99"


def test_xff_first_entry_only_when_trusted(monkeypatch):
    """A trusted proxy chain still pins the *first* hop's IP (the
    originating client), not the last one in the chain."""

    from app.api.rate_limit import _client_ip

    monkeypatch.setenv("SENTINEL_TRUSTED_PROXIES", "10.0.0.0/8")
    req = _StubRequest(
        peer="10.0.0.5",
        headers={"x-forwarded-for": "203.0.113.10, 10.0.0.5"},
    )
    assert _client_ip(req) == "203.0.113.10"


def test_malformed_trusted_proxies_silently_dropped(monkeypatch):
    """Garbage in the env is treated as 'no trusted proxies' rather
    than crashing. Safer default: untrusted-by-default."""

    from app.api.rate_limit import _client_ip

    monkeypatch.setenv("SENTINEL_TRUSTED_PROXIES", "not-a-cidr,also-not")
    req = _StubRequest(peer="10.1.2.3", headers={"x-forwarded-for": "1.2.3.4"})
    assert _client_ip(req) == "10.1.2.3"


def test_anonymous_when_no_peer_or_proxy(monkeypatch):
    from app.api.rate_limit import _client_ip

    monkeypatch.delenv("SENTINEL_TRUSTED_PROXIES", raising=False)

    class _NoClient:
        client = None
        headers: dict[str, str] = {}

    assert _client_ip(_NoClient()) == "anonymous"
