from __future__ import annotations

from typing import Annotated, Generator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import check_session
from app.db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> str:
    token = request.cookies.get(settings.cookie_name)
    user = check_session(settings, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"ok": False, "error": "unauthorized"},
        )
    return user


DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[str, Depends(get_current_user)]
AppSettings = Annotated[Settings, Depends(get_settings)]
