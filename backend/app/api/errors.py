from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from ..core.exceptions import SentinelError


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(SentinelError)
    async def _handle_sentinel_error(_: Request, exc: SentinelError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": str(exc)}},
        )
