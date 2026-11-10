"""Shared constants for parsing and aggregation."""

HUMAN_DAY_CAP = 120

ASSET_EXTS = {
    ".js", ".mjs", ".css", ".map", ".json", ".xml", ".txt", ".csv",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp3", ".mp4", ".webm", ".m4a", ".ogg", ".wav",
    ".pdf", ".zip", ".rar", ".7z", ".tar", ".gz", ".apk", ".dmg",
    ".webmanifest",
}

SKIP_PREFIXES = (
    "/_next/", "/uploads/", "/api/", "/.well-known/", "/stats",
    "/favicon.ico", "/robots.txt", "/sitemap", "/manifest", "/static/",
    "/wp-", "/apple-touch", "/browserconfig", "/cgi-sys/", "/swagger",
)

# Humans only (default): capped human pageviews.
ELIGIBLE_SQL = (
    "SELECT day, ip, SUM(pageviews) AS pv FROM visits "
    "WHERE day BETWEEN :start AND :end AND human = 1 "
    "GROUP BY day, ip HAVING SUM(pageviews) <= :cap"
)

# Include bots: any IP with page activity (human + bot pageviews).
ELIGIBLE_SQL_WITH_BOTS = (
    "SELECT day, ip, SUM(pageviews + bot_pageviews) AS pv FROM visits "
    "WHERE day BETWEEN :start AND :end AND (pageviews + bot_pageviews) > 0 "
    "GROUP BY day, ip HAVING SUM(pageviews + bot_pageviews) <= :cap"
)


def eligible_sql(include_bots: bool = False) -> str:
    return ELIGIBLE_SQL_WITH_BOTS if include_bots else ELIGIBLE_SQL
