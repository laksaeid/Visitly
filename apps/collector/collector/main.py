from __future__ import annotations

import argparse
import os
import sys

from sqlalchemy import text

from collector.config import get_settings
from collector.worker import collect, purge_backfill
from visitly_core.db import make_engine, make_session_factory
from visitly_core.selftest import run_selftest

# Stable lock id for pg_try_advisory_lock (Visitly collector).
_PG_LOCK_KEY = 872014401


def _try_lock(path: str):
    """Cross-platform non-blocking file lock. Returns file handle or None."""
    parent = os.path.dirname(os.path.abspath(path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    lock = open(path, "a+")
    try:
        if os.name == "nt":
            import msvcrt

            lock.seek(0)
            if lock.read(1) == "":
                lock.write("0")
                lock.flush()
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        lock.close()
        return None
    return lock


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="visitly-collect")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument(
        "--purge-backfill",
        action="store_true",
        help="Clear aggregates and rebuild from configured log source",
    )
    args = ap.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    settings = get_settings()
    # File lock alone is unreliable with `docker compose run --rm` (ephemeral FS).
    file_lock = _try_lock(settings.lock_path)

    engine = make_engine(settings.database_url)
    SessionLocal = make_session_factory(engine)
    session = SessionLocal()
    got_pg_lock = False
    try:
        got_pg_lock = bool(
            session.execute(
                text("SELECT pg_try_advisory_lock(:k)"), {"k": _PG_LOCK_KEY}
            ).scalar()
        )
        if not got_pg_lock:
            print("another collector run is active; skipping")
            return 0
        if args.purge_backfill:
            imported = purge_backfill(session, settings)
        else:
            imported = collect(session, settings)
            print("collector: imported %d requests" % imported)
    finally:
        if got_pg_lock:
            try:
                session.execute(
                    text("SELECT pg_advisory_unlock(:k)"), {"k": _PG_LOCK_KEY}
                )
                session.commit()
            except Exception:
                session.rollback()
        session.close()
        if file_lock is not None:
            file_lock.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
