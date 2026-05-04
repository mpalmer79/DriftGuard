from fastapi import FastAPI

from .api.routes import router


def create_app() -> FastAPI:
    app = FastAPI(
        title="SentinelNav",
        description="Deterministic, fault-tolerant control system simulation.",
        version="0.1.0",
    )
    app.include_router(router)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
