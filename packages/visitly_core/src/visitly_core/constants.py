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

# Humans only (default):
# - soft-cap each IP at :cap pageviews (power users still count)
# - drop extreme crawlers above 5x the cap (likely non-human despite UA)
# Previously HAVING <= :cap dropped every IP over the soft cap entirely.
ELIGIBLE_SQL = (
    "SELECT day, ip, LEAST(SUM(pageviews), :cap) AS pv FROM visits "
    "WHERE day BETWEEN :start AND :end AND human = 1 "
    "GROUP BY day, ip "
    "HAVING SUM(pageviews) > 0 AND SUM(pageviews) <= (:cap * 5)"
)

# Include bots: soft-capped; still drop pathological outliers.
ELIGIBLE_SQL_WITH_BOTS = (
    "SELECT day, ip, LEAST(SUM(pageviews + bot_pageviews), :cap) AS pv FROM visits "
    "WHERE day BETWEEN :start AND :end AND (pageviews + bot_pageviews) > 0 "
    "GROUP BY day, ip "
    "HAVING SUM(pageviews + bot_pageviews) > 0 "
    "AND SUM(pageviews + bot_pageviews) <= (:cap * 5)"
)


def eligible_sql(include_bots: bool = False) -> str:
    return ELIGIBLE_SQL_WITH_BOTS if include_bots else ELIGIBLE_SQL
