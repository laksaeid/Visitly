from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.routers import auth, public, stats

settings = get_settings()
WEB_DIST = Path(__file__).resolve().parents[2] / "web" / "dist"


def create_app() -> FastAPI:
    app = FastAPI(
        title="Visitly API",
        version="0.1.0",
        docs_url=f"{settings.base_path}/api/docs",
        openapi_url=f"{settings.base_path}/api/openapi.json",
        redoc_url=None,
    )

    if settings.cors_origin_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origin_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(public.router, prefix=settings.base_path)
    app.include_router(auth.router, prefix=settings.base_path)
    app.include_router(stats.router, prefix=settings.base_path)

    @app.get("/healthz")
    def healthz() -> dict:
        return {"ok": True}

    if WEB_DIST.is_dir():
        assets = WEB_DIST / "assets"
        if assets.is_dir():
            app.mount(
                f"{settings.base_path}/assets",
                StaticFiles(directory=str(assets)),
                name="assets",
            )

        index = WEB_DIST / "index.html"

        @app.get(settings.base_path)
        @app.get(f"{settings.base_path}/")
        def spa_root() -> FileResponse:
            return FileResponse(index)

        @app.get(f"{settings.base_path}/{{full_path:path}}")
        def spa(full_path: str) -> FileResponse:
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="not found")
            candidate = (WEB_DIST / full_path).resolve()
            root = WEB_DIST.resolve()
            if str(candidate).startswith(str(root)) and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(index)

    return app


app = create_app()
