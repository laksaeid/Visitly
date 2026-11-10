from __future__ import annotations

import base64
import hashlib
import hmac
import time
from typing import Optional

from app.core.config import Settings


def b64e(s: str) -> str:
    return base64.urlsafe_b64encode(s.encode("utf-8")).decode("ascii").rstrip("=")


def b64d(s: str) -> str:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode((s + pad).encode("ascii")).decode("utf-8")


def sign(secret: str, payload: str) -> str:
    return hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def make_session(settings: Settings, user: str) -> str:
    exp = int(time.time()) + settings.session_ttl_seconds
    payload = "%s|%d" % (user, exp)
    return b64e(payload) + "." + sign(settings.session_secret, payload)


def check_session(settings: Settings, token: Optional[str]) -> Optional[str]:
    if not token or "." not in token:
        return None
    payload_b64, sig = token.rsplit(".", 1)
    try:
        payload = b64d(payload_b64)
    except Exception:
        return None
    if not hmac.compare_digest(sign(settings.session_secret, payload), sig):
        return None
    parts = payload.split("|")
    if len(parts) != 2:
        return None
    user, exp_s = parts
    try:
        exp = int(exp_s)
    except ValueError:
        return None
    if exp < int(time.time()):
        return None
    if user != settings.user:
        return None
    return user


class LoginThrottle:
    """Simple in-memory login throttle: ip -> [fail_count, lock_until]."""

    def __init__(self) -> None:
        self._fails: dict[str, list[float]] = {}

    def ok(self, ip: str) -> bool:
        now = time.time()
        row = self._fails.get(ip)
        if not row:
            return True
        if row[1] and now < row[1]:
            return False
        if row[1] and now >= row[1]:
            self._fails.pop(ip, None)
        return True

    def fail(self, ip: str) -> None:
        now = time.time()
        count, _lock = self._fails.get(ip, [0, 0])
        count += 1
        lock_until = 0.0
        if count >= 8:
            lock_until = now + 300
            count = 0
        self._fails[ip] = [count, lock_until]

    def clear(self, ip: str) -> None:
        self._fails.pop(ip, None)


throttle = LoginThrottle()
