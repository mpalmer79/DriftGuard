"""Application error taxonomy (Phase 8.6).

Every exception that should reach the client subclasses
``SentinelError`` and carries:

- ``code``: a stable string the frontend can switch on.
- ``status_code``: the HTTP status the API layer renders.

The error response shape (see ``app/api/errors.py``) is:

    {"error": {"code": "<code>", "message": "<message>"}}

Add new error classes here, never inline. The frontend's
``api.ts`` consumes the ``code`` field; changing it is a breaking
change.
"""


class SentinelError(Exception):
    """Base for all application errors."""

    code: str = "sentinel_error"
    status_code: int = 500


class NotFoundError(SentinelError):
    code = "not_found"
    status_code = 404


class ConflictError(SentinelError):
    code = "conflict"
    status_code = 409


class ValidationError(SentinelError):
    code = "validation_error"
    status_code = 400


class ScenarioError(SentinelError):
    code = "scenario_error"
    status_code = 400


class CapacityError(SentinelError):
    """Raised when a resource cap (Phase 8.4) is exceeded."""

    code = "capacity_exceeded"
    status_code = 429


class AuthError(SentinelError):
    """Raised by the optional bearer-token guard (Phase 8.3)."""

    code = "unauthorized"
    status_code = 401


class RateLimitError(SentinelError):
    """Raised by the slowapi rate-limit middleware (Phase 8.2)."""

    code = "rate_limited"
    status_code = 429


# The full registry, exposed so docs and the OpenAPI spec can iterate.
ALL_ERRORS: tuple[type[SentinelError], ...] = (
    NotFoundError,
    ConflictError,
    ValidationError,
    ScenarioError,
    CapacityError,
    AuthError,
    RateLimitError,
)
