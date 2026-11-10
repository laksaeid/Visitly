#!/usr/bin/env python3
"""Copy legacy stats.db (SQLite) into Postgres.

Usage:
  python scripts/migrate_sqlite_to_postgres.py \\
    --sqlite ../stats/stats.db \\
    --database-url postgresql+psycopg://visitly:visitly_dev_change_me@localhost:5432/visitly
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "packages" / "visitly_core" / "src"))

from sqlalchemy import text  # noqa: E402
from visitly_core.db import ensure_schema, make_engine, make_session_factory  # noqa: E402


def copy_table(sqlite_con: sqlite3.Connection, session, table: str, columns: list[str]) -> int:
    cols = ", ".join(columns)
    placeholders = ", ".join(":" + c for c in columns)
    rows = sqlite_con.execute(f"SELECT {cols} FROM {table}").fetchall()
    count = 0
    for row in rows:
        params = {c: row[i] for i, c in enumerate(columns)}
        session.execute(
            text(
                f"INSERT INTO {table} ({cols}) VALUES ({placeholders}) "
                f"ON CONFLICT DO NOTHING"
            ),
            params,
        )
        count += 1
        if count % 1000 == 0:
            session.commit()
    session.commit()
    return count


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--sqlite",
        required=True,
        help="Path to a SQLite stats.db to import",
    )
    ap.add_argument(
        "--database-url",
        default=os.environ.get(
            "DATABASE_URL",
            "postgresql+psycopg://visitly:visitly_dev_change_me@localhost:5432/visitly",
        ),
    )
    ap.add_argument(
        "--truncate",
        action="store_true",
        help="Clear Postgres tables before import",
    )
    args = ap.parse_args()

    if not os.path.isfile(args.sqlite):
        raise SystemExit(f"sqlite file not found: {args.sqlite}")

    engine = make_engine(args.database_url)
    ensure_schema(engine)
    SessionLocal = make_session_factory(engine)
    session = SessionLocal()
    sqlite_con = sqlite3.connect(args.sqlite)

    try:
        if args.truncate:
            for table in ("visits", "ip_paths", "ip_refs", "meta"):
                session.execute(text(f"DELETE FROM {table}"))
            session.commit()
            print("truncated: cleared postgres tables")

        n_visits = copy_table(
            sqlite_con,
            session,
            "visits",
            ["day", "hour", "ip", "human", "pageviews", "bot_pageviews", "requests"],
        )
        n_paths = copy_table(
            sqlite_con,
            session,
            "ip_paths",
            ["day", "ip", "path", "views"],
        )
        n_refs = copy_table(
            sqlite_con,
            session,
            "ip_refs",
            ["day", "ip", "referer", "views"],
        )
        n_meta = copy_table(sqlite_con, session, "meta", ["k", "v"])
        print(
            "migrate ok: visits=%d paths=%d refs=%d meta=%d"
            % (n_visits, n_paths, n_refs, n_meta)
        )
    finally:
        session.close()
        sqlite_con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
