from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from visitly_core.queries import build_day_payload, build_payload, build_top_list


def overview(db: Session, day: Optional[str] = None) -> Dict[str, Any]:
    return build_payload(db, day)


def day_detail(db: Session, day: str) -> Optional[Dict[str, Any]]:
    return build_day_payload(db, day)


def top_list(db: Session, kind: str, day: str) -> Optional[Dict[str, Any]]:
    return build_top_list(db, kind, day)
