from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import time
from typing import Iterable, List, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from collector.config import CollectorSettings
from visitly_core.db import meta_get, meta_set, one
from visitly_core.ingest import record
from visitly_core.parsing import parse_live, parse_line
from visitly_core.queries import build_payload


def ensure_salt(session: Session) -> str:
    salt = meta_get(session, "salt")
    if salt:
        return salt
    salt = hashlib.sha256(
        ("%s%s" % (time.time(), os.urandom(16))).encode()
    ).hexdigest()
    meta_set(session, "salt", salt)
    session.commit()
    return salt


def docker_log_files(container: str, *, include_rotated: bool = False) -> List[str]:
    docker = shutil.which("docker") or "/usr/bin/docker"
    path = subprocess.check_output(
        [docker, "inspect", "-f", "{{.LogPath}}", container],
        stderr=subprocess.DEVNULL,
    ).decode("utf-8", "replace").strip()
    if not path:
        return []
    # Incremental runs only follow the live file. Rotated siblings are for
    # purge-backfill; reading them every cron tick races with rotation renames.
    if include_rotated:
        return [path + ".2", path + ".1", path]
    return [path]


def _offset_for(path: str, inode: int, offsets: dict) -> int:
    """Resolve byte offset.

    Prefer inode-only keys so Docker/logrotate renames (same inode, new path)
    do not reset the cursor and double-ingest the rotated file.
    """
    inode_key = str(inode)
    if inode_key in offsets:
        return int(offsets.get(inode_key) or 0)
    # legacy path:inode keys from earlier Visitly builds
    path_key = "%s:%s" % (path, inode)
    if path_key in offsets:
        return int(offsets.get(path_key) or 0)
    # older path:inode entries after rename — match by inode suffix
    suffix = ":%s" % inode
    for key, value in offsets.items():
        if key.endswith(suffix) or key == inode_key:
            return int(value or 0)
    return 0


def _read_new_bytes(path: str, offsets: dict) -> Tuple[bytes, str, int]:
    """Return (complete_lines_bytes, offset_key, new_offset)."""
    if not os.path.exists(path):
        return b"", "", 0
    st = os.stat(path)
    # inode-only key survives rotation/rename of the same file
    key = str(st.st_ino)
    off = _offset_for(path, st.st_ino, offsets)
    if off > st.st_size:
        off = 0
    with open(path, "rb") as fh:
        fh.seek(off)
        data = fh.read()
    if not data:
        return b"", key, off
    end = data.rfind(b"\n")
    if end < 0:
        return b"", key, off
    return data[: end + 1], key, off + end + 1


def _ingest_lines(session: Session, salt: str, lines: Iterable[bytes], *, docker_json: bool) -> Tuple[int, int]:
    imported = 0
    skipped = 0
    for raw in lines:
        if docker_json:
            try:
                obj = json.loads(raw.decode("utf-8", "replace"))
            except ValueError:
                continue
            if obj.get("stream") != "stdout":
                continue
            msg = obj.get("log", "").rstrip("\n")
            if "\t" in msg:
                rec = parse_live(msg)
            else:
                skipped += 1
                continue
        else:
            msg = raw.decode("utf-8", "replace").rstrip("\n")
            if not msg:
                continue
            rec = parse_line(msg)
        if rec is None:
            continue
        record(session, salt, rec)
        imported += 1
    return imported, skipped


def collect_docker(
    session: Session,
    settings: CollectorSettings,
    offsets: dict,
    salt: str,
    *,
    include_rotated: bool = False,
) -> Tuple[int, int]:
    try:
        files = docker_log_files(
            settings.docker_container, include_rotated=include_rotated
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        print("collector: docker inspect failed: %s" % exc)
        return 0, 0
    imported = 0
    skipped = 0
    for path in files:
        chunk, key, new_off = _read_new_bytes(path, offsets)
        if not key or not chunk:
            continue
        n, s = _ingest_lines(session, salt, chunk.splitlines(), docker_json=True)
        imported += n
        skipped += s
        offsets[key] = new_off
    return imported, skipped


def collect_file(
    session: Session,
    settings: CollectorSettings,
    offsets: dict,
    salt: str,
    *,
    include_rotated: bool = False,
) -> Tuple[int, int]:
    path = settings.log_path
    candidates = [path + ".2", path + ".1", path] if include_rotated else [path]
    imported = 0
    skipped = 0
    for p in candidates:
        chunk, key, new_off = _read_new_bytes(p, offsets)
        if not key or not chunk:
            continue
        n, s = _ingest_lines(session, salt, chunk.splitlines(), docker_json=False)
        imported += n
        skipped += s
        offsets[key] = new_off
    return imported, skipped


def _normalize_offsets(offsets: dict) -> dict:
    """Keep inode-only keys; drop legacy path:inode duplicates."""
    normalized: dict = {}
    for key, value in offsets.items():
        key_s = str(key)
        if key_s.isdigit():
            inode = key_s
        elif ":" in key_s:
            inode = key_s.rsplit(":", 1)[-1]
        else:
            continue
        if not inode.isdigit():
            continue
        cur = int(normalized.get(inode) or 0)
        normalized[inode] = max(cur, int(value or 0))
    return normalized


def collect(
    session: Session,
    settings: CollectorSettings,
    *,
    include_rotated: bool = False,
) -> int:
    offsets = _normalize_offsets(json.loads(meta_get(session, "offsets") or "{}"))
    salt = ensure_salt(session)
    source = (settings.log_source or "file").strip().lower()
    if source == "docker":
        imported, skipped = collect_docker(
            session, settings, offsets, salt, include_rotated=include_rotated
        )
    else:
        imported, skipped = collect_file(
            session, settings, offsets, salt, include_rotated=include_rotated
        )

    meta_set(session, "offsets", json.dumps(_normalize_offsets(offsets), sort_keys=True))
    meta_set(session, "last_run", str(int(time.time())))
    session.commit()
    if skipped:
        print("collector: skipped %d non-edge lines" % skipped)
    return imported


def purge_backfill(session: Session, settings: CollectorSettings) -> int:
    before = {
        "visits": one(session, "SELECT COUNT(*) FROM visits"),
        "paths": one(session, "SELECT COUNT(*) FROM ip_paths"),
        "refs": one(session, "SELECT COUNT(*) FROM ip_refs"),
        "backfill_until": meta_get(session, "backfill_until"),
    }
    session.execute(text("DELETE FROM visits"))
    session.execute(text("DELETE FROM ip_paths"))
    session.execute(text("DELETE FROM ip_refs"))
    session.execute(
        text("DELETE FROM meta WHERE k IN ('backfill_until', 'offsets')")
    )
    meta_set(session, "offsets", "{}")
    session.commit()
    print(
        "purge-backfill: cleared visits=%d paths=%d refs=%d backfill_until=%s"
        % (
            before["visits"],
            before["paths"],
            before["refs"],
            before["backfill_until"],
        )
    )
    # Rebuild from live + rotated docker/file logs once.
    imported = collect(session, settings, include_rotated=True)
    data = build_payload(session)
    left = session.execute(
        text(
            "SELECT day, COUNT(*), COALESCE(SUM(pageviews),0) FROM visits "
            "GROUP BY day ORDER BY day"
        )
    ).fetchall()
    print("purge-backfill: re-imported %d requests" % imported)
    print("purge-backfill: remaining days: %s" % (left,))
    print(
        "purge-backfill: overview today visitors=%s"
        % data["totals"]["today"]["visitors"]
    )
    assert meta_get(session, "backfill_until") is None
    return imported
