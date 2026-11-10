from __future__ import annotations

import os
import secrets
import shutil
import socket
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable


class InstallError(RuntimeError):
    pass


@dataclass
class InstallContext:
    root: Path
    yes: bool = False
    non_interactive: bool = False
    skip_nginx: bool = False
    skip_collector: bool = False
    skip_cron: bool = False
    nginx_config: Path | None = None
    project: str = "visitly"
    api_port: int = 3099
    db_port: int = 5433
    env: dict[str, str] = field(default_factory=dict)

    @property
    def env_path(self) -> Path:
        return self.root / ".env"

    @property
    def compose_file(self) -> Path:
        return self.root / "docker-compose.yml"


def say(msg: str = "") -> None:
    print(msg, flush=True)


def header(title: str, step: int, total: int) -> None:
    say()
    say("=" * 60)
    say(f"  Stage {step}/{total}: {title}")
    say("=" * 60)


def prompt(label: str, default: str | None = None, *, secret: bool = False) -> str:
    suffix = f" [{default}]" if default not in (None, "") else ""
    while True:
        if secret and sys.stdin.isatty():
            import getpass

            raw = getpass.getpass(f"{label}{suffix}: ")
        else:
            raw = input(f"{label}{suffix}: ").strip()
        if raw:
            return raw
        if default is not None:
            return default
        say("  Value required.")


def confirm(label: str, *, default: bool = True, yes: bool = False) -> bool:
    if yes:
        say(f"{label} → yes (--yes)")
        return True
    hint = "Y/n" if default else "y/N"
    raw = input(f"{label} [{hint}]: ").strip().lower()
    if not raw:
        return default
    return raw in {"y", "yes"}


def run(
    ctx: InstallContext,
    args: list[str],
    *,
    check: bool = True,
    capture: bool = False,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    say(f"$ {' '.join(args)}")
    merged = os.environ.copy()
    if env:
        merged.update(env)
    result = subprocess.run(
        args,
        cwd=ctx.root,
        check=False,
        text=True,
        capture_output=capture,
        env=merged,
    )
    if check and result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        raise InstallError(f"Command failed ({result.returncode}): {' '.join(args)}\n{err}")
    return result


def which(name: str) -> str | None:
    return shutil.which(name)


def port_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)
        return sock.connect_ex((host, port)) != 0


def random_secret(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def write_env(path: Path, values: dict[str, str]) -> None:
    lines = [f"{k}={v}" for k, v in values.items()]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def read_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, _, value = raw.partition("=")
        out[key.strip()] = value.strip()
    return out


def env_value(*keys: str, default: str = "") -> str:
    """First non-empty match from process env."""
    for key in keys:
        value = os.environ.get(key)
        if value is not None and str(value).strip() != "":
            return str(value).strip()
    return default


def http_get(url: str, timeout: float = 3.0) -> tuple[int, str]:
    """Tiny HTTP GET without requiring curl."""
    from urllib.error import HTTPError, URLError
    from urllib.request import Request, urlopen

    req = Request(url, method="GET", headers={"User-Agent": "visitly-install/0.1"})
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310 — local health checks
            body = resp.read().decode("utf-8", errors="replace")
            return int(getattr(resp, "status", 200) or 200), body
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        return int(exc.code), body
    except URLError:
        return 0, ""
    except Exception:
        return 0, ""


def compose(
    ctx: InstallContext,
    *args: str,
    check: bool = True,
    capture: bool = False,
) -> subprocess.CompletedProcess[str]:
    base = ["docker", "compose", "-p", ctx.project, "-f", str(ctx.compose_file)]
    return run(ctx, base + list(args), check=check, capture=capture)


StageFn = Callable[[InstallContext], None]
