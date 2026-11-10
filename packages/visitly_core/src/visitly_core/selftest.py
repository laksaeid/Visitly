"""Domain self-tests (no database required)."""

from __future__ import annotations

import calendar

from visitly_core.parsing import is_bot, is_page, parse_combined, parse_live, referer_key
from visitly_core.settings import RuntimeConfig, set_runtime_config
from visitly_core.timeutil import day_shift, local_hour_key, local_parts


def run_selftest() -> None:
    set_runtime_config(RuntimeConfig(
        site_hosts=frozenset({"example.com", "www.example.com"}),
        timezone="UTC",
    ))
    line = (
        "2026-11-09T17:52:01+00:00\t203.0.113.9\texample.com\tGET\t"
        "/product/widget?x=1\t304\t12\t"
        "https://google.com/\tMozilla/5.0 (Windows NT 10.0) Chrome/131\t"
        "0.01"
    )
    rec = parse_live(line)
    assert rec and rec["status"] == 304
    assert rec["path"].startswith("/product/"), rec["path"]
    assert not is_bot(rec["ua"])
    assert is_bot("Mozilla/5.0 (compatible; Googlebot/2.1)")
    assert is_page("/product/foo", 200, "GET")
    assert not is_page("/_next/static/a.js", 200, "GET")
    assert not is_page("/product/foo", 404, "GET")
    assert not is_page("/product/foo", 200, "POST")
    assert referer_key("https://www.google.com/search") == "google.com"
    assert referer_key("https://example.com/product/x") is None
    assert referer_key("") == "Direct"
    c = parse_combined(
        '1.2.3.4 - - [09/Nov/2026:14:21:03 +0000] "GET / HTTP/1.1" 200 5 '
        '"-" "curl/8.0"'
    )
    assert c and is_bot(c["ua"])
    set_runtime_config(RuntimeConfig(
        site_hosts=frozenset({"example.com"}),
        timezone="Asia/Tehran",
    ))
    d, h = local_parts(calendar.timegm((2026, 11, 9, 14, 21, 3, 0, 0, 0)))
    assert (d, h) == ("2026-11-09", "2026-11-09T17"), (d, h)
    d2, h2 = local_parts(calendar.timegm((2026, 11, 9, 21, 0, 0, 0, 0, 0)))
    assert (d2, h2) == ("2026-11-10", "2026-11-10T00"), (d2, h2)
    assert day_shift("2026-11-10", -1) == "2026-11-09"
    assert local_hour_key("2026-11-10", 0) == "2026-11-10T00"
    print("selftest ok")
