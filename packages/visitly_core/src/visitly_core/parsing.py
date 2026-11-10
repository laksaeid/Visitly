"""Nginx edge / combined log parsing and request classification."""

from __future__ import annotations

import calendar
import ipaddress
import os
import re
from datetime import datetime
from typing import Any, Dict, Optional
from urllib.parse import unquote, urlsplit

from visitly_core.constants import ASSET_EXTS, SKIP_PREFIXES
from visitly_core.settings import get_runtime_config
from visitly_core.timeutil import local_parts

BOT_RE = re.compile(
    r"(bot\b|bots\b|crawl|spider|slurp|curl/|wget/|python-|python/|"
    r"aiohttp|httpx|requests/|go-http-client|okhttp|java/|libwww|"
    r"httpclient|http-client|axios/|node-fetch|undici|headlesschrome|"
    r"phantomjs|scrapy|facebookexternalhit|meta-externalagent|ahrefs|"
    r"semrush|mj12|petalbot|bytespider|gptbot|chatgpt|claude|anthropic|"
    r"ccbot|perplexity|dotbot|barkrowler|serpstat|dataforseo|uptime|"
    r"pingdom|monitor|check_http|nmap|masscan|zgrab|expanse|censys|"
    r"shodan|netcraft|internetmeasurement|h2-fingerprint|research;|"
    r"lighthouse|gtmetrix|pagespeed|telegrambot|whatsapp|k6|"
    r"windowspowershell|powershell|node)",
    re.I,
)

COMBINED_RE = re.compile(
    r'^(\S+) - - \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d{3}) (\d+|-) '
    r'"(.*)" "(.*)"$'
)


def is_bot(ua: Optional[str]) -> bool:
    ua = (ua or "").strip()
    if not ua or ua == "-":
        return True
    return bool(BOT_RE.search(ua))


def is_internal_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return addr.is_private or addr.is_loopback or addr.is_link_local


def normalize_path(uri: str) -> str:
    if uri.startswith("http://") or uri.startswith("https://"):
        uri = urlsplit(uri).path or "/"
    path = unquote(uri.split("?", 1)[0], errors="replace")
    if not path.startswith("/"):
        path = "/" + path
    return path[:300]


def is_page(path: str, status: int, method: str) -> bool:
    if method not in ("GET", "HEAD"):
        return False
    if status not in (200, 304):
        return False
    if path.startswith(SKIP_PREFIXES):
        return False
    ext = os.path.splitext(path.split("?", 1)[0])[1].lower()
    if ext in ASSET_EXTS:
        return False
    return True


def referer_key(referer: Optional[str]) -> Optional[str]:
    referer = (referer or "").strip()
    if not referer or referer == "-":
        return "Direct"
    try:
        host = (urlsplit(referer).hostname or "").lower()
    except ValueError:
        return "Other"
    if not host:
        return "Direct"
    if host.startswith("www."):
        bare = host[4:]
    else:
        bare = host
    cfg = get_runtime_config()
    if cfg.is_internal_referer_host(bare) or cfg.is_internal_referer_host(host):
        return None
    return bare


def parse_live(line: str) -> Optional[Dict[str, Any]]:
    """Parse Visitly/nginx edge TSV log line (includes $host)."""
    parts = line.split("\t")
    if len(parts) < 10:
        return None
    if len(parts) > 10:
        parts = parts[:8] + ["\t".join(parts[8:-1]), parts[-1]]
    stamp = parts[0]
    if len(stamp) > 5 and stamp[-3] == ":":
        stamp = stamp[:-3] + stamp[-2:]
    try:
        dt = datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%S%z")
    except ValueError:
        try:
            dt = datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            return None
    try:
        status = int(parts[5])
    except ValueError:
        return None
    return {
        "ts": calendar.timegm(dt.utctimetuple()),
        "ip": parts[1],
        "host": parts[2],
        "method": parts[3],
        "path": normalize_path(parts[4]),
        "status": status,
        "referer": parts[7],
        "ua": parts[8],
        "rsc": "_rsc=" in parts[4],
    }


def parse_combined(line: str) -> Optional[Dict[str, Any]]:
    m = COMBINED_RE.match(line)
    if not m:
        return None
    ip, tstr, method, uri, status, _bytes, referer, ua = m.groups()
    try:
        dt = datetime.strptime(tstr, "%d/%b/%Y:%H:%M:%S %z")
    except ValueError:
        return None
    return {
        "ts": calendar.timegm(dt.utctimetuple()),
        "ip": ip,
        "host": "",
        "method": method,
        "path": normalize_path(uri),
        "status": int(status),
        "referer": referer,
        "ua": ua,
        "rsc": "_rsc=" in uri,
    }


def parse_line(line: str) -> Optional[Dict[str, Any]]:
    line = line.rstrip("\n")
    if "\t" in line:
        return parse_live(line)
    return parse_combined(line)


def classify_record(rec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Return upsert fields for a parsed request, or None to skip."""
    if is_internal_ip(rec["ip"]):
        return None
    page = is_page(rec["path"], rec["status"], rec["method"]) and not rec.get("rsc")
    cfg = get_runtime_config()
    host = (rec.get("host") or "").lower()
    if host and not cfg.allows_host(host):
        return None
    day, hour = local_parts(rec["ts"])
    bot = is_bot(rec["ua"])
    human = 1 if (page and not bot) else 0
    return {
        "day": day,
        "hour": hour,
        "human": human,
        "pageviews": 1 if human else 0,
        "bot_pageviews": 1 if (page and bot) else 0,
        "path": rec["path"],
        "referer_src": referer_key(rec["referer"]) if page else None,
        "is_page": page,
    }
