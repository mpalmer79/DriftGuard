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
