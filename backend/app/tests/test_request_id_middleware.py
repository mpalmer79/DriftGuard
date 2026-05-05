"""Tests for the request-id middleware (Phase 4.5)."""

import re

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import reset_state_for_tests
from app.api.middleware import current_request_id
from app.main import create_app


@pytest.fixture
def client():
    reset_state_for_tests()
    return TestClient(create_app())


_GENERATED = re.compile(r"^req_[0-9a-f]{16}$")


def test_response_includes_request_id_header(client):
    r = client.get("/health")
    assert r.status_code == 200
    rid = r.headers.get("x-request-id")
    assert rid is not None
    assert _GENERATED.match(rid)


def test_request_id_is_echoed_back_when_supplied(client):
    r = client.get("/health", headers={"x-request-id": "client-supplied-123"})
    assert r.headers["x-request-id"] == "client-supplied-123"


def test_each_request_gets_a_distinct_generated_id(client):
    a = client.get("/health").headers["x-request-id"]
    b = client.get("/health").headers["x-request-id"]
    assert a != b


def test_context_var_is_unset_outside_a_request():
    """The contextvar resets between requests; outside one, it is None."""

    assert current_request_id.get() is None


def test_request_id_is_set_during_request_handling():
    """While the middleware is active inside a route, current_request_id
    reflects the inbound id. We exercise this by registering a tiny
    side-channel route that reads the contextvar."""

    from fastapi import FastAPI

    from app.api.middleware import install_request_id_middleware

    app = FastAPI()
    install_request_id_middleware(app)

    seen: dict[str, str | None] = {}

    @app.get("/peek")
    def peek():
        seen["rid"] = current_request_id.get()
        return {"rid": seen["rid"]}

    c = TestClient(app)
    body = c.get("/peek", headers={"x-request-id": "peeker"}).json()
    assert body["rid"] == "peeker"
