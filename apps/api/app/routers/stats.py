from __future__ import annotations

import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DbSession
from app.services import stats as stats_service
from visitly_core.timeutil import local_day

router = APIRouter(tags=["stats"])

DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _require_day(day: Optional[str], *, required: bool = False) -> Optional[str]:
    if day is None or day == "":
        if required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"ok": False, "error": "bad day"},
            )
        return None
    if not DAY_RE.match(day):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"ok": False, "error": "bad day"},
        )
    return day


@router.get("/api/overview")
@router.get("/api/data")
def overview(
    _user: CurrentUser,
    db: DbSession,
    day: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    day = _require_day(day)
    return stats_service.overview(db, day)


@router.get("/api/day")
def day_detail(
    _user: CurrentUser,
    db: DbSession,
    day: str = Query(...),
) -> Dict[str, Any]:
    day = _require_day(day, required=True)  # type: ignore[assignment]
    data = stats_service.day_detail(db, day)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": "day not found"},
        )
    return data


@router.get("/api/top")
def top_list(
    _user: CurrentUser,
    db: DbSession,
    kind: str = Query(default="pages"),
    day: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    if not day:
        day = local_day()
    day = _require_day(day, required=True)  # type: ignore[assignment]
    data = stats_service.top_list(db, kind, day)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"ok": False, "error": "not found"},
        )
    return data
