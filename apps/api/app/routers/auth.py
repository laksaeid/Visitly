from __future__ import annotations

import hmac

from fastapi import APIRouter, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse

from app.core.deps import AppSettings, CurrentUser
from app.core.security import make_session, throttle
from app.schemas.auth import OkResponse

router = APIRouter(tags=["auth"])


def _client_ip(request: Request) -> str:
    xff = request.headers.get("X-Real-IP") or request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _is_https(request: Request) -> bool:
    proto = (request.headers.get("X-Forwarded-Proto") or "").split(",")[0].strip().lower()
    if proto == "https":
        return True
    if proto == "http":
        return False
    return request.headers.get("X-Forwarded-Ssl") == "on"


def _set_cookie(response: Response, settings: AppSettings, request: Request, token: str) -> None:
    secure = _is_https(request)
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        path=settings.base_path,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.session_ttl_seconds,
    )


def _clear_cookie(response: Response, settings: AppSettings, request: Request) -> None:
    secure = _is_https(request)
    response.delete_cookie(
        key=settings.cookie_name,
        path=settings.base_path,
        httponly=True,
        secure=secure,
        samesite="lax",
    )


@router.get("/api/me", response_model=OkResponse)
def me(user: CurrentUser) -> OkResponse:
    return OkResponse(ok=True, user=user)


@router.get("/api/logout")
def logout(request: Request, settings: AppSettings) -> RedirectResponse:
    response = RedirectResponse(
        url=f"{settings.base_path}/login",  # SPA route
        status_code=status.HTTP_302_FOUND,
    )
    _clear_cookie(response, settings, request)
    return response


@router.post("/api/login")
async def login(request: Request, settings: AppSettings) -> JSONResponse:
    ip = _client_ip(request)
    if not throttle.ok(ip):
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"ok": False, "error": "too many attempts"},
        )

    content_type = (request.headers.get("content-type") or "").split(";")[0].strip()
    if content_type == "application/json":
        raw = await request.json()
        user_in = str(raw.get("user") or "").strip()
        pw_in = str(raw.get("password") or "")
    else:
        form = await request.form()
        user_in = str(form.get("user") or "").strip()
        pw_in = str(form.get("password") or "")

    ok_user = hmac.compare_digest(user_in, settings.user)
    ok_pw = hmac.compare_digest(pw_in, settings.password)
    if not (ok_user and ok_pw):
        throttle.fail(ip)
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"ok": False, "error": "invalid credentials"},
        )

    throttle.clear(ip)
    token = make_session(settings, settings.user)
    response = JSONResponse(
        content={"ok": True, "redirect": f"{settings.base_path}/"},
    )
    _set_cookie(response, settings, request, token)
    return response
