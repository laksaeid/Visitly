from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import AppSettings

router = APIRouter(tags=["public"])


@router.get("/api/config")
def public_config(settings: AppSettings) -> dict:
    return {
        "ok": True,
        "site_name": settings.site_name,
        "timezone": settings.timezone,
        "base_path": settings.base_path,
        "locale": settings.locale,
    }
