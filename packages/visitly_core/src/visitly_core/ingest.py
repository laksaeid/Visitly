"""Write-side ingest helpers for the collector."""

from __future__ import annotations

import hashlib
from typing import Any, Dict

from sqlalchemy import text
from sqlalchemy.orm import Session

from visitly_core.parsing import classify_record


def hash_ip(salt: str, ip: str) -> str:
    return hashlib.sha256((salt + ip).encode()).hexdigest()[:32]


def record(session: Session, salt: str, rec: Dict[str, Any], page_only: bool = False) -> bool:
    """Upsert one parsed request. Returns True when it was a page view."""
    classified = classify_record(rec)
    if classified is None:
        return False
    if page_only and not classified["is_page"]:
        return False

    ip = hash_ip(salt, rec["ip"])
    session.execute(
        text(
            """
            INSERT INTO visits(day, hour, ip, human, pageviews, bot_pageviews, requests)
            VALUES(:day, :hour, :ip, :human, :pageviews, :bot_pageviews, 1)
            ON CONFLICT (day, hour, ip) DO UPDATE SET
                human = GREATEST(visits.human, EXCLUDED.human),
                pageviews = visits.pageviews + EXCLUDED.pageviews,
                bot_pageviews = visits.bot_pageviews + EXCLUDED.bot_pageviews,
                requests = visits.requests + 1
            """
        ),
        {
            "day": classified["day"],
            "hour": classified["hour"],
            "ip": ip,
            "human": classified["human"],
            "pageviews": classified["pageviews"],
            "bot_pageviews": classified["bot_pageviews"],
        },
    )
    if classified["is_page"]:
        session.execute(
            text(
                """
                INSERT INTO ip_paths(day, ip, path, views)
                VALUES(:day, :ip, :path, 1)
                ON CONFLICT (day, ip, path) DO UPDATE SET views = ip_paths.views + 1
                """
            ),
            {
                "day": classified["day"],
                "ip": ip,
                "path": classified["path"],
            },
        )
        src = classified["referer_src"]
        if src:
            session.execute(
                text(
                    """
                    INSERT INTO ip_refs(day, ip, referer, views)
                    VALUES(:day, :ip, :referer, 1)
                    ON CONFLICT (day, ip, referer) DO UPDATE SET views = ip_refs.views + 1
                    """
                ),
                {
                    "day": classified["day"],
                    "ip": ip,
                    "referer": src,
                },
            )
    return bool(classified["is_page"])
