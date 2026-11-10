"""Timezone-aware calendar helpers via zoneinfo."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

from visitly_core.settings import get_runtime_config


def _tz() -> ZoneInfo:
    return ZoneInfo(get_runtime_config().timezone)


def local_now(ts: Optional[int] = None) -> datetime:
    if ts is None:
        ts = int(datetime.now(tz=timezone.utc).timestamp())
    return datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(_tz())


def local_day(ts: Optional[int] = None) -> str:
    return local_now(ts).strftime("%Y-%m-%d")


def local_hour_key(day: str, hour_int: int) -> str:
    return "%sT%02d" % (day, hour_int)


def local_parts(ts: int) -> Tuple[str, str]:
    dt = local_now(ts)
    day = dt.strftime("%Y-%m-%d")
    return day, day + "T" + dt.strftime("%H")


def day_shift(day: str, delta: int) -> str:
    y, m, d = [int(x) for x in day.split("-")]
    # noon in configured TZ avoids DST edge ambiguity for calendar days
    base = datetime(y, m, d, 12, 0, 0, tzinfo=_tz())
    shifted = base + timedelta(days=delta)
    return shifted.strftime("%Y-%m-%d")


def format_local(ts: Optional[int] = None, fmt: str = "%Y-%m-%d %H:%M") -> str:
    return local_now(ts).strftime(fmt)
