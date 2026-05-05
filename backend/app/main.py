from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.errors import install_error_handlers
from .api.health_routes import router as health_router
from .api.middleware import install_request_id_middleware
from .api.recovery_routes import router as recovery_router
from .api.report_routes import router as report_router
from .api.routes import router
from .api.scenario_routes import router as scenario_router
from .api.stream_routes import router as stream_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="SentinelNav",
        description="Deterministic, fault-tolerant control system simulation.",
        version="0.2.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_request_id_middleware(app)
    install_error_handlers(app)
    app.include_router(health_router)
    app.include_router(router)
    app.include_router(recovery_router)
    app.include_router(scenario_router)
    app.include_router(report_router)
    app.include_router(stream_router)

    return app


app = create_app()
