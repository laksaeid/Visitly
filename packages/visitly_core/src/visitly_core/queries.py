"""Read-side aggregate queries (Postgres)."""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from visitly_core.constants import eligible_sql
from visitly_core.db import one
from visitly_core.settings import get_runtime_config
from visitly_core.timeutil import day_shift, format_local, local_day, local_hour_key


def _cap() -> int:
    return get_runtime_config().human_day_cap


def _tz_name() -> str:
    return get_runtime_config().timezone


def _eligible_params(start: str, end: str, cap: Optional[int] = None) -> dict:
    return {"start": start, "end": end, "cap": _cap() if cap is None else cap}


def _sql(include_bots: bool) -> str:
    return eligible_sql(include_bots)


def totals(session: Session, start: str, end: str, *, include_bots: bool = False) -> Dict[str, int]:
    visitors, views = session.execute(
        text(
            "SELECT COUNT(DISTINCT ip), COALESCE(SUM(pv), 0) FROM (%s) e"
            % _sql(include_bots)
        ),
        _eligible_params(start, end),
    ).fetchone()
    ips = one(
        session,
        """
        SELECT COUNT(DISTINCT ip) FROM visits
        WHERE day BETWEEN :start AND :end
          AND (pageviews + bot_pageviews) > 0
        """,
        {"start": start, "end": end},
    )
    return {
        "visitors": int(visitors or 0),
        "visitors_all": int(ips or 0),
        "pageviews": int(views or 0),
    }


def available_days(session: Session) -> List[str]:
    rows = session.execute(
        text("SELECT DISTINCT day FROM visits ORDER BY day")
    ).fetchall()
    return [r[0] for r in rows]


def day_hourly(
    session: Session,
    day: str,
    *,
    include_bots: bool = False,
) -> List[Dict[str, Any]]:
    if include_bots:
        hour_rows = {
            r[0]: r
            for r in session.execute(
                text(
                    """
                    SELECT hour,
                           COUNT(DISTINCT ip),
                           COALESCE(SUM(pageviews + bot_pageviews), 0)
                    FROM visits
                    WHERE day = :day AND (pageviews + bot_pageviews) > 0
                    GROUP BY hour
                    """
                ),
                {"day": day},
            ).fetchall()
        }
    else:
        hour_rows = {
            r[0]: r
            for r in session.execute(
                text(
                    """
                    SELECT v.hour, COUNT(DISTINCT v.ip), COALESCE(SUM(v.pageviews), 0)
                    FROM visits v
                    JOIN (%s) e ON e.day = v.day AND e.ip = v.ip
                    WHERE v.day = :day AND v.human = 1
                    GROUP BY v.hour
                    """
                    % _sql(False)
                ),
                {**_eligible_params(day, day), "day": day},
            ).fetchall()
        }
    hourly = []
    for h in range(24):
        key = local_hour_key(day, h)
        row = hour_rows.get(key)
        hourly.append({
            "hour": key,
            "label": "%02d:00" % h,
            "visitors": int(row[1]) if row else 0,
            "pageviews": int(row[2]) if row else 0,
        })
    return hourly


def collapse_tail(rows: List[dict], name_key: str, keep: int = 5) -> List[dict]:
    if len(rows) <= keep:
        return rows
    head = [dict(r) for r in rows[:keep]]
    rest = rows[keep:]
    head.append({
        name_key: "Other",
        "views": sum(int(r.get("views") or 0) for r in rest),
        "others": True,
        "others_count": len(rest),
    })
    return head


def day_top_pages(
    session: Session,
    start: str,
    end: str,
    limit: int = 5000,
    keep: Optional[int] = 5,
    *,
    include_bots: bool = False,
) -> List[dict]:
    rows = [
        {"path": r[0], "views": int(r[1])}
        for r in session.execute(
            text(
                """
                SELECT p.path, SUM(p.views) AS v
                FROM ip_paths p
                JOIN (%s) e ON e.day = p.day AND e.ip = p.ip
                GROUP BY p.path
                ORDER BY v DESC
                LIMIT :limit
                """
                % _sql(include_bots)
            ),
            {**_eligible_params(start, end), "limit": limit},
        ).fetchall()
    ]
    if keep is None:
        return rows
    return collapse_tail(rows, "path", keep=keep)


def day_top_referers(
    session: Session,
    start: str,
    end: str,
    limit: int = 5000,
    keep: Optional[int] = 5,
    *,
    include_bots: bool = False,
) -> List[dict]:
    rows = [
        {"referer": r[0], "views": int(r[1])}
        for r in session.execute(
            text(
                """
                SELECT p.referer, SUM(p.views) AS v
                FROM ip_refs p
                JOIN (%s) e ON e.day = p.day AND e.ip = p.ip
                GROUP BY p.referer
                ORDER BY v DESC
                LIMIT :limit
                """
                % _sql(include_bots)
            ),
            {**_eligible_params(start, end), "limit": limit},
        ).fetchall()
    ]
    if keep is None:
        return rows
    return collapse_tail(rows, "referer", keep=keep)


def _returning_count(
    session: Session,
    day: str,
    since: str,
    prev: str,
    *,
    include_bots: bool,
) -> int:
    sql = _sql(include_bots)
    returning = session.execute(
        text(
            """
            SELECT COUNT(DISTINCT t.ip)
            FROM (%s) t
            JOIN (%s) p ON p.ip = t.ip
            """
            % (
                sql.replace(":start", ":t_start")
                .replace(":end", ":t_end")
                .replace(":cap", ":t_cap"),
                sql.replace(":start", ":p_start")
                .replace(":end", ":p_end")
                .replace(":cap", ":p_cap"),
            )
        ),
        {
            "t_start": day,
            "t_end": day,
            "t_cap": _cap(),
            "p_start": since,
            "p_end": prev,
            "p_cap": _cap(),
        },
    ).fetchone()[0]
    return int(returning or 0)


def build_top_list(
    session: Session,
    kind: str,
    day: str,
    *,
    include_bots: bool = False,
) -> Optional[dict]:
    today = local_day()
    days = available_days(session)
    if day not in days and day != today:
        return None
    if kind == "pages":
        rows = day_top_pages(session, day, day, keep=None, include_bots=include_bots)
        name_key = "path"
        title = "Top pages"
    elif kind in ("refs", "referers", "sources"):
        rows = day_top_referers(session, day, day, keep=None, include_bots=include_bots)
        name_key = "referer"
        title = "Traffic sources"
        kind = "refs"
    else:
        return None
    total_views = sum(int(r.get("views") or 0) for r in rows)
    return {
        "kind": kind,
        "title": title,
        "name_key": name_key,
        "day": day,
        "is_today": day == today,
        "timezone": _tz_name(),
        "include_bots": include_bots,
        "available_days": days if days else [today],
        "count": len(rows),
        "total_views": total_views,
        "rows": rows,
    }


def build_day_payload(
    session: Session,
    day: str,
    *,
    include_bots: bool = False,
) -> Optional[dict]:
    today = local_day()
    since = one(session, "SELECT MIN(day) FROM visits") or today
    days = available_days(session)
    if day not in days and day != today:
        return None

    t = totals(session, day, day, include_bots=include_bots)
    bots = one(
        session,
        "SELECT COALESCE(SUM(bot_pageviews), 0) FROM visits WHERE day = :day",
        {"day": day},
    )
    reqs = one(
        session,
        "SELECT COALESCE(SUM(requests), 0) FROM visits WHERE day = :day",
        {"day": day},
    )
    prev = day_shift(day, -1)
    returning = _returning_count(
        session, day, since, prev, include_bots=include_bots
    )

    return {
        "day": day,
        "is_today": day == today,
        "timezone": _tz_name(),
        "day_window": "00:00–24:00",
        "since": since,
        "include_bots": include_bots,
        "available_days": days if days else [today],
        "totals": dict(
            t,
            bot_pageviews=int(bots or 0),
            requests=int(reqs or 0),
            returning=returning,
        ),
        "hourly": day_hourly(session, day, include_bots=include_bots),
        "top_pages": day_top_pages(session, day, day, include_bots=include_bots),
        "top_referers": day_top_referers(session, day, day, include_bots=include_bots),
    }


def build_payload(
    session: Session,
    day: Optional[str] = None,
    *,
    include_bots: bool = False,
) -> dict:
    now = int(time.time())
    today = local_day(now)
    if day is None:
        day = today
    days_list = available_days(session)
    since = one(session, "SELECT MIN(day) FROM visits") or today
    month_start = day_shift(today, -29)
    week_start = day_shift(today, -6)
    yday = day_shift(today, -1)
    chart_start = since if since > month_start else month_start
    chart_days: List[str] = []
    d = chart_start
    while d <= today:
        chart_days.append(d)
        d = day_shift(d, 1)

    daily_rows = {
        r[0]: r
        for r in session.execute(
            text(
                """
                SELECT day, COUNT(DISTINCT ip), COALESCE(SUM(pv), 0)
                FROM (%s) e
                GROUP BY day
                """
                % _sql(include_bots)
            ),
            _eligible_params(chart_start, today),
        ).fetchall()
    }
    all_rows = {
        r[0]: int(r[1])
        for r in session.execute(
            text(
                """
                SELECT day, COUNT(DISTINCT ip) FROM visits
                WHERE day >= :start AND (pageviews + bot_pageviews) > 0
                GROUP BY day
                """
            ),
            {"start": chart_start},
        ).fetchall()
    }
    daily = []
    for d in chart_days:
        row = daily_rows.get(d)
        daily.append({
            "day": d,
            "visitors": int(row[1]) if row else 0,
            "pageviews": int(row[2]) if row else 0,
            "visitors_all": all_rows.get(d, 0),
        })

    selected = build_day_payload(session, day, include_bots=include_bots)
    if selected is None:
        selected = build_day_payload(session, today, include_bots=include_bots)
        day = today

    t_today = totals(session, today, today, include_bots=include_bots)
    t_yesterday = totals(session, yday, yday, include_bots=include_bots)
    t_week = totals(session, week_start, today, include_bots=include_bots)
    t_month = totals(session, month_start, today, include_bots=include_bots)
    t_all = totals(session, since, today, include_bots=include_bots)
    all_ips = one(
        session,
        """
        SELECT COUNT(DISTINCT ip) FROM visits
        WHERE (pageviews + bot_pageviews) > 0
        """,
    )
    returning = _returning_count(
        session, today, since, yday, include_bots=include_bots
    )
    today_bots = one(
        session,
        "SELECT COALESCE(SUM(bot_pageviews), 0) FROM visits WHERE day = :day",
        {"day": today},
    )
    today_requests = one(
        session,
        "SELECT COALESCE(SUM(requests), 0) FROM visits WHERE day = :day",
        {"day": today},
    )

    return {
        "generated": format_local(now),
        "generated_epoch": now,
        "timezone": _tz_name(),
        "day_window": "00:00–24:00",
        "since": since,
        "today": today,
        "selected_day": day,
        "include_bots": include_bots,
        "available_days": days_list if days_list else [today],
        "totals": {
            "today": dict(
                t_today,
                bot_pageviews=int(today_bots or 0),
                requests=int(today_requests or 0),
            ),
            "yesterday": t_yesterday,
            "last7": t_week,
            "last30": t_month,
            "all": {
                "visitors": t_all["visitors"],
                "visitors_all": int(all_ips or 0),
                "pageviews": t_all["pageviews"],
            },
            "returning_today": returning,
        },
        "daily": daily,
        "hourly": selected["hourly"],
        "day": selected,
        "top_pages": selected["top_pages"],
        "top_referers": selected["top_referers"],
    }
