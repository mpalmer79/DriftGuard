"""Error taxonomy tests (Phase 8.6).

Pins the contract that every SentinelError subclass has a stable
code, a sane HTTP status, and lands at the API layer with the
documented body shape ``{"error": {"code": "...", "message": "..."}}``.
"""

from __future__ import annotations

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app.api.errors import install_error_handlers
from app.core.exceptions import (
    ALL_ERRORS,
    AuthError,
    CapacityError,
    ConflictError,
    NotFoundError,
    RateLimitError,
    ScenarioError,
    SentinelError,
    ValidationError,
)


def test_all_errors_are_subclasses_of_sentinel_error():
    for cls in ALL_ERRORS:
        assert issubclass(cls, SentinelError)


def test_each_error_has_a_unique_code():
    codes = [c.code for c in ALL_ERRORS]
    assert len(codes) == len(set(codes)), f"duplicate error codes: {codes}"


@pytest.mark.parametrize(
    ("cls", "status"),
    [
        (NotFoundError, 404),
        (ConflictError, 409),
        (ValidationError, 400),
        (ScenarioError, 400),
        (CapacityError, 429),
        (AuthError, 401),
        (RateLimitError, 429),
    ],
)
def test_status_code_matches_taxonomy(cls, status):
    assert cls.status_code == status


def _build_app() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)
    router = APIRouter()

    @router.get("/raise/{kind}")
    def raise_(kind: str):
        if kind == "notfound":
            raise NotFoundError("missing thing")
        if kind == "auth":
            raise AuthError("token required")
        if kind == "capacity":
            raise CapacityError("at the cap")
        if kind == "rate":
            raise RateLimitError("too many requests")
        raise SentinelError("generic")

    app.include_router(router)
    return app


def test_error_handler_renders_taxonomy_body():
    client = TestClient(_build_app())
    r = client.get("/raise/notfound")
    assert r.status_code == 404
    body = r.json()
    assert body == {"error": {"code": "not_found", "message": "missing thing"}}


def test_error_handler_for_auth_renders_401():
    client = TestClient(_build_app())
    r = client.get("/raise/auth")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_error_handler_for_capacity_renders_429():
    client = TestClient(_build_app())
    r = client.get("/raise/capacity")
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "capacity_exceeded"


def test_error_handler_for_rate_limit_renders_429():
    client = TestClient(_build_app())
    r = client.get("/raise/rate")
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "rate_limited"
