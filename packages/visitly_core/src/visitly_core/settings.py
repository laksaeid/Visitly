"""Process-wide runtime config (hosts, timezone, caps)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import FrozenSet, Optional


@dataclass(frozen=True)
class RuntimeConfig:
    site_hosts: FrozenSet[str] = field(default_factory=lambda: frozenset())
    timezone: str = "UTC"
    human_day_cap: int = 120
    site_name: str = "Visitly"

    def allows_host(self, host: str) -> bool:
        host = (host or "").lower().strip()
        if not host:
            # combined logs often omit host; allow when no hosts configured
            # or when hosts are set (filter applied elsewhere / assumed single-site)
            return True
        if not self.site_hosts:
            return True
        return host in self.site_hosts

    def is_internal_referer_host(self, host: str) -> bool:
        host = (host or "").lower().strip()
        if host.startswith("www."):
            host = host[4:]
        if host in ("localhost", "127.0.0.1", "0.0.0.0"):
            return True
        for allowed in self.site_hosts:
            a = allowed.lower()
            if a.startswith("www."):
                a = a[4:]
            if host == a or host.endswith("." + a):
                return True
        return False


_CONFIG: RuntimeConfig = RuntimeConfig()


def get_runtime_config() -> RuntimeConfig:
    return _CONFIG


def set_runtime_config(config: RuntimeConfig) -> None:
    global _CONFIG
    _CONFIG = config


def parse_hosts(raw: Optional[str]) -> FrozenSet[str]:
    if not raw:
        return frozenset()
    return frozenset(h.strip().lower() for h in raw.split(",") if h.strip())
