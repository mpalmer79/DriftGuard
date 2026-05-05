"""CORS allowlist tests (Phase 8.5)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.core import cors
from app.main import create_app


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


def test_allowed_origins_defaults_to_localhost(monkeypatch):
    monkeypatch.delenv("SENTINEL_CORS_ORIGINS", raising=False)
    origins = cors.allowed_origins()
    assert "http://localhost:3000" in origins
    assert "*" not in origins


def test_allowed_origins_parses_csv(monkeypatch):
    monkeypatch.setenv(
        "SENTINEL_CORS_ORIGINS", "https://app.example.com, https://staging.example.com"
    )
    origins = cors.allowed_origins()
    assert origins == [
        "https://app.example.com",
        "https://staging.example.com",
    ]


def test_allowed_origins_supports_explicit_wildcard(monkeypatch):
    monkeypatch.setenv("SENTINEL_CORS_ORIGINS", "*")
    origins = cors.allowed_origins()
    assert origins == ["*"]


def test_allowed_origins_falls_back_to_default_on_empty(monkeypatch):
    monkeypatch.setenv("SENTINEL_CORS_ORIGINS", "  ,  ")
    assert cors.allowed_origins() == ["http://localhost:3000", "http://127.0.0.1:3000"]


def test_cors_response_for_allowed_origin(client):
    r = client.options(
        "/health",
        headers={
            "origin": "http://localhost:3000",
            "access-control-request-method": "GET",
        },
    )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_response_blocks_disallowed_origin(client):
    r = client.options(
        "/health",
        headers={
            "origin": "https://evil.example.com",
            "access-control-request-method": "GET",
        },
    )
    # Disallowed: starlette omits the access-control-allow-origin
    # header, the browser then refuses the request.
    assert r.headers.get("access-control-allow-origin") is None
