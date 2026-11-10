from __future__ import annotations

import re
import shutil
import time
from datetime import datetime
from pathlib import Path

from .util import (
    InstallContext,
    InstallError,
    compose,
    confirm,
    env_value,
    header,
    http_get,
    port_free,
    prompt,
    random_secret,
    read_env,
    run,
    say,
    which,
    write_env,
)

IRAN_MIRRORS = {
    "POSTGRES_IMAGE": "docker.arvancloud.ir/library/postgres:16-alpine",
    "NODE_IMAGE": "docker.arvancloud.ir/library/node:22-alpine",
    "PYTHON_IMAGE": "docker.arvancloud.ir/library/python:3.12-slim",
    "PIP_INDEX_URL": "https://pypi.tuna.tsinghua.edu.cn/simple",
    "PIP_TRUSTED_HOST": "pypi.tuna.tsinghua.edu.cn",
    "NPM_REGISTRY": "https://registry.npmmirror.com",
}

GLOBAL_MIRRORS = {
    "POSTGRES_IMAGE": "postgres:16-alpine",
    "NODE_IMAGE": "node:22-alpine",
    "PYTHON_IMAGE": "python:3.12-slim",
    "PIP_INDEX_URL": "https://pypi.org/simple",
    "PIP_TRUSTED_HOST": "pypi.org",
    "NPM_REGISTRY": "https://registry.npmjs.org",
}

TOTAL_STAGES = 8


def stage_preflight(ctx: InstallContext) -> None:
    header("Preflight checks", 1, TOTAL_STAGES)

    if not ctx.compose_file.exists():
        raise InstallError(f"docker-compose.yml not found in {ctx.root}")

    docker = which("docker")
    if not docker:
        raise InstallError("Docker is required. Install Docker Engine, then re-run.")

    version = run(ctx, ["docker", "version", "--format", "{{.Server.Version}}"], capture=True)
    say(f"  Docker server: {version.stdout.strip() or 'ok'}")

    compose_check = run(ctx, ["docker", "compose", "version"], capture=True, check=False)
    if compose_check.returncode != 0:
        raise InstallError("Docker Compose plugin is required (`docker compose`).")
    say(f"  {compose_check.stdout.strip()}")

    for label, port in (("API", ctx.api_port), ("Postgres host bind", ctx.db_port)):
        if port_free("127.0.0.1", port):
            say(f"  Port 127.0.0.1:{port} ({label}) is free")
        else:
            if not confirm(
                f"  Port 127.0.0.1:{port} ({label}) is in use. Continue anyway?",
                default=False,
                yes=ctx.yes,
            ):
                raise InstallError(f"Port {port} is busy. Free it or change docker-compose.yml.")

    say("  Preflight passed.")
    if not confirm("Continue to configuration?", default=True, yes=ctx.yes):
        raise InstallError("Install cancelled.")


def stage_configure(ctx: InstallContext) -> None:
    header("Write .env configuration", 2, TOTAL_STAGES)

    existing = read_env(ctx.env_path)
    if existing and ctx.env_path.exists():
        say(f"  Found existing {ctx.env_path}")
        if confirm("Reuse / merge with existing .env?", default=True, yes=ctx.yes):
            ctx.env = dict(existing)
        elif not confirm("Overwrite .env with new values?", default=False, yes=ctx.yes):
            raise InstallError("Install cancelled.")

    def resolved(key: str, default: str = "") -> str:
        return ctx.env.get(key) or env_value(key) or existing.get(key) or default

    def ask(key: str, label: str, default: str, *, secret: bool = False) -> str:
        preset = resolved(key, default)
        if ctx.non_interactive:
            return preset
        return prompt(label, preset, secret=secret)

    # Mirror profile for global vs Iran-friendly registries/images
    mirror_preset = resolved("VISITLY_MIRROR_PROFILE", "global").lower()
    if ctx.non_interactive:
        mirror_choice = "2" if mirror_preset in {"iran", "ir", "2"} else "1"
    else:
        say("  Build/package mirrors:")
        say("    1) global — Docker Hub + PyPI + npmjs (default)")
        say("    2) iran   — Arvan / Tsinghua / npmmirror")
        mirror_choice = prompt("Choose mirror profile", "2" if mirror_preset in {"iran", "ir"} else "1")
    use_iran = mirror_choice.strip() in {"2", "iran", "ir"}
    mirrors = dict(IRAN_MIRRORS if use_iran else GLOBAL_MIRRORS)
    for key, value in mirrors.items():
        if not resolved(key):
            existing[key] = value

    site_name = ask("VISITLY_SITE_NAME", "Site name", "My Site")
    site_hosts = ask("VISITLY_SITE_HOSTS", "Site hosts (comma-separated)", "example.com,www.example.com")
    timezone = ask("VISITLY_TIMEZONE", "IANA timezone", "UTC")
    base_path = ask("VISITLY_BASE_PATH", "URL base path", "/stats")
    locale = ask("VISITLY_LOCALE", "Default UI locale (en|fa)", "en")

    admin_user = ask("VISITLY_ADMIN_USER", "Admin username", "admin")
    default_admin_password = resolved("VISITLY_ADMIN_PASSWORD") or (
        random_secret(12) if ctx.non_interactive else "change-me"
    )
    admin_password = ask("VISITLY_ADMIN_PASSWORD", "Admin password", default_admin_password, secret=True)
    if ctx.non_interactive and admin_password in {"", "change-me", "admin", "password"}:
        raise InstallError(
            "Non-interactive install requires a strong VISITLY_ADMIN_PASSWORD "
            "(env var or existing .env)."
        )

    session_secret = ask(
        "VISITLY_SESSION_SECRET",
        "Session secret (leave default to auto-generate)",
        resolved("VISITLY_SESSION_SECRET") or random_secret(),
        secret=True,
    )

    pg_user = ask("POSTGRES_USER", "Postgres user", "visitly")
    pg_password = ask(
        "POSTGRES_PASSWORD",
        "Postgres password",
        resolved("POSTGRES_PASSWORD") or random_secret(18),
        secret=True,
    )
    pg_db = ask("POSTGRES_DB", "Postgres database", "visitly")

    host_log_dir = resolved("VISITLY_HOST_LOG_DIR", "/var/log/nginx")
    if ctx.skip_collector:
        log_source = resolved("VISITLY_LOG_SOURCE", "file")
        log_path = resolved("VISITLY_LOG_PATH", "/var/log/nginx/access.log")
        docker_container = resolved("VISITLY_DOCKER_CONTAINER", "nginx")
    elif ctx.non_interactive:
        log_source = resolved("VISITLY_LOG_SOURCE", "file")
        log_path = resolved("VISITLY_LOG_PATH", "/var/log/nginx/access.log")
        docker_container = resolved("VISITLY_DOCKER_CONTAINER", "nginx")
        host_log_dir = resolved("VISITLY_HOST_LOG_DIR", str(Path(log_path).parent))
    else:
        say("  Collector log source:")
        say("    1) file   — nginx access log on disk")
        say("    2) docker — stdout from an nginx container")
        choice = prompt(
            "Choose log source",
            "1" if resolved("VISITLY_LOG_SOURCE", "file") == "file" else "2",
        )
        if choice.strip() in {"2", "docker", "d"}:
            log_source = "docker"
            docker_container = ask(
                "VISITLY_DOCKER_CONTAINER",
                "Nginx Docker container name",
                resolved("VISITLY_DOCKER_CONTAINER", "nginx"),
            )
            log_path = resolved("VISITLY_LOG_PATH", "/var/log/nginx/access.log")
        else:
            log_source = "file"
            log_path = ask(
                "VISITLY_LOG_PATH",
                "Nginx access log path (inside collector)",
                resolved("VISITLY_LOG_PATH", "/var/log/nginx/access.log"),
            )
            docker_container = resolved("VISITLY_DOCKER_CONTAINER", "nginx")
            host_log_dir = ask(
                "VISITLY_HOST_LOG_DIR",
                "Host directory to mount for that log",
                resolved("VISITLY_HOST_LOG_DIR", str(Path(log_path).parent)),
            )

    values = {
        "POSTGRES_USER": pg_user,
        "POSTGRES_PASSWORD": pg_password,
        "POSTGRES_DB": pg_db,
        "DATABASE_URL": f"postgresql+psycopg://{pg_user}:{pg_password}@localhost:{ctx.db_port}/{pg_db}",
        "VISITLY_MIRROR_PROFILE": "iran" if use_iran else "global",
        "POSTGRES_IMAGE": resolved("POSTGRES_IMAGE", mirrors["POSTGRES_IMAGE"]),
        "NODE_IMAGE": resolved("NODE_IMAGE", mirrors["NODE_IMAGE"]),
        "PYTHON_IMAGE": resolved("PYTHON_IMAGE", mirrors["PYTHON_IMAGE"]),
        "PIP_INDEX_URL": resolved("PIP_INDEX_URL", mirrors["PIP_INDEX_URL"]),
        "PIP_TRUSTED_HOST": resolved("PIP_TRUSTED_HOST", mirrors["PIP_TRUSTED_HOST"]),
        "NPM_REGISTRY": resolved("NPM_REGISTRY", mirrors["NPM_REGISTRY"]),
        "VISITLY_SITE_NAME": site_name,
        "VISITLY_SITE_HOSTS": site_hosts,
        "VISITLY_TIMEZONE": timezone,
        "VISITLY_BASE_PATH": base_path if base_path.startswith("/") else f"/{base_path}",
        "VISITLY_LOCALE": locale if locale in {"en", "fa"} else "en",
        "VISITLY_ADMIN_USER": admin_user,
        "VISITLY_ADMIN_PASSWORD": admin_password,
        "VISITLY_SESSION_SECRET": session_secret,
        "VISITLY_COOKIE_NAME": resolved("VISITLY_COOKIE_NAME", "visitly_sess"),
        "VISITLY_SESSION_TTL_SECONDS": resolved("VISITLY_SESSION_TTL_SECONDS", "604800"),
        "VISITLY_HOST": "0.0.0.0",
        "VISITLY_PORT": str(ctx.api_port),
        "VISITLY_CORS_ORIGINS": resolved("VISITLY_CORS_ORIGINS", "http://localhost:5173"),
        "VISITLY_LOG_SOURCE": log_source,
        "VISITLY_LOG_PATH": log_path,
        "VISITLY_DOCKER_CONTAINER": docker_container,
        "VISITLY_HOST_LOG_DIR": host_log_dir,
        "VISITLY_LOCK_PATH": resolved("VISITLY_LOCK_PATH", "./collect.lock"),
        "VISITLY_HUMAN_DAY_CAP": resolved("VISITLY_HUMAN_DAY_CAP", "120"),
    }

    say()
    say(f"  Writing {ctx.env_path}")
    if not confirm("Write .env now?", default=True, yes=ctx.yes):
        raise InstallError("Install cancelled.")
    write_env(ctx.env_path, values)
    ctx.env = values
    say("  .env saved.")
    if not ctx.non_interactive:
        say(f"  Admin user: {admin_user}")
        say("  Admin password: (stored in .env — keep it safe)")


def stage_postgres(ctx: InstallContext) -> None:
    header("Start Postgres", 3, TOTAL_STAGES)
    if not confirm("Start visitly-pg now?", default=True, yes=ctx.yes):
        raise InstallError("Install cancelled.")
    compose(ctx, "up", "-d", "postgres")
    say("  Waiting for Postgres health…")
    deadline = time.time() + 90
    while time.time() < deadline:
        health = run(
            ctx,
            ["docker", "inspect", "--format", "{{.State.Health.Status}}", "visitly-pg"],
            capture=True,
            check=False,
        )
        status = (health.stdout or "").strip()
        if status == "healthy":
            say("  Postgres is healthy.")
            return
        time.sleep(3)
    raise InstallError("Postgres did not become healthy in time. Check: docker logs visitly-pg")


def stage_api(ctx: InstallContext) -> None:
    header("Build & start API + dashboard", 4, TOTAL_STAGES)
    say("  This builds the React UI into the API image (may take several minutes).")
    if not confirm("Build and start visitly-api now?", default=True, yes=ctx.yes):
        raise InstallError("Install cancelled.")
    compose(ctx, "up", "-d", "--build", "api")
    say("  Waiting for API…")
    deadline = time.time() + 180
    while time.time() < deadline:
        code, body = http_get(f"http://127.0.0.1:{ctx.api_port}/healthz")
        if code == 200:
            say(f"  API healthy: {body.strip()}")
            return
        time.sleep(3)
    logs = run(ctx, ["docker", "logs", "--tail", "40", "visitly-api"], capture=True, check=False)
    say(logs.stdout or logs.stderr or "")
    raise InstallError("API did not respond on /healthz. Check docker logs visitly-api")


def stage_migrate(ctx: InstallContext) -> None:
    header("Run database migrations", 5, TOTAL_STAGES)
    if not confirm("Run alembic upgrade head inside visitly-api?", default=True, yes=ctx.yes):
        raise InstallError("Install cancelled.")
    run(ctx, ["docker", "exec", "visitly-api", "alembic", "upgrade", "head"])
    say("  Migrations applied.")


def stage_collector(ctx: InstallContext) -> None:
    header("Collector (nginx log ingest)", 6, TOTAL_STAGES)
    if ctx.skip_collector:
        say("  Skipped (--skip-collector).")
        return

    if not confirm("Build collector and run a first collect?", default=True, yes=ctx.yes):
        say("  Skipping collector for now.")
        ctx.skip_cron = True
        return

    compose(ctx, "--profile", "collector", "build", "collector")
    compose(
        ctx,
        "--profile",
        "collector",
        "run",
        "--rm",
        "--no-deps",
        "collector",
        check=False,
    )
    say("  First collector run finished (errors are OK if nginx logs are empty yet).")

    if ctx.skip_cron:
        return

    if not confirm("Install a cron job to collect every 2 minutes?", default=True, yes=ctx.yes):
        say("  Skipping cron. You can run collector manually later.")
        return

    cron_line = (
        f"*/2 * * * * root cd {ctx.root} && "
        f"/usr/bin/docker compose -p {ctx.project} --profile collector "
        f"run --rm --no-deps collector >>/var/log/visitly-collect.log 2>&1"
    )
    cron_path = Path("/etc/cron.d/visitly-collect")
    if os_name_is_windows():
        say("  Windows host detected — write this Task Scheduler / WSL cron yourself:")
        say(f"  {cron_line}")
        return

    if not confirm(f"Write {cron_path}?", default=True, yes=ctx.yes):
        say("  Cron not installed. Suggested line:")
        say(f"  {cron_line}")
        return

    try:
        cron_path.write_text(cron_line + "\n", encoding="utf-8")
        cron_path.chmod(0o644)
        say(f"  Wrote {cron_path}")
    except PermissionError:
        say("  Need root to write /etc/cron.d. Suggested line:")
        say(f"  {cron_line}")


def os_name_is_windows() -> bool:
    import os

    return os.name == "nt"


def stage_nginx(ctx: InstallContext) -> None:
    header("Nginx reverse proxy for /stats/", 7, TOTAL_STAGES)
    if ctx.skip_nginx:
        say("  Skipped (--skip-nginx).")
        return

    snippet = ctx.root / "deploy" / "nginx.visitly.conf.snippet"
    say("  Visitly should be proxied under your site, e.g. https://example.com/stats/")
    if snippet.exists():
        say()
        say(snippet.read_text(encoding="utf-8").rstrip())
        say()

    if ctx.nginx_config is None:
        if ctx.non_interactive:
            say("  Non-interactive mode: not patching nginx (pass --nginx-config PATH).")
            say("  Paste the snippet into your server block, then reload nginx.")
            return
        if not confirm("Patch an nginx site config automatically (with backup)?", default=False, yes=False):
            say("  Paste the snippet into your server block, then reload nginx.")
            return
        conf = prompt("Path to nginx site config", "")
        path = Path(conf)
    else:
        path = ctx.nginx_config
    if not path.is_file():
        raise InstallError(f"Nginx config not found: {path}")

    text = path.read_text(encoding="utf-8")
    marker = "127.0.0.1:3099/stats/"
    if marker in text:
        say("  Looks like /stats/ proxy already exists — leaving config unchanged.")
        return

    block = """
    location = /stats { return 301 /stats/; }
    location ^~ /stats/ {
        proxy_pass http://127.0.0.1:3099/stats/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Cache-Control "no-store" always;
    }
"""
    # Insert before the last closing brace of the server block when possible.
    match = list(re.finditer(r"^}", text, flags=re.MULTILINE))
    if not match:
        raise InstallError("Could not find a closing `}` to insert the location block.")
    insert_at = match[-1].start()
    updated = text[:insert_at] + block + "\n" + text[insert_at:]

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = path.with_suffix(path.suffix + f".visitly-bak-{stamp}")
    shutil.copy2(path, backup)
    say(f"  Backup: {backup}")
    path.write_text(updated, encoding="utf-8")
    say(f"  Updated: {path}")

    if which("nginx"):
        test = run(ctx, ["nginx", "-t"], check=False, capture=True)
        if test.returncode != 0:
            say("  nginx -t failed — restoring backup.")
            shutil.copy2(backup, path)
            raise InstallError((test.stderr or test.stdout or "nginx -t failed").strip())
        if confirm("Reload nginx now?", default=True, yes=ctx.yes):
            run(ctx, ["nginx", "-s", "reload"], check=False)
            say("  nginx reloaded.")
    else:
        say("  `nginx` binary not in PATH — reload it yourself after reviewing the config.")


def stage_verify(ctx: InstallContext) -> None:
    header("Verify install", 8, TOTAL_STAGES)
    if not ctx.env:
        ctx.env = read_env(ctx.env_path)
    health_code, health_body = http_get(f"http://127.0.0.1:{ctx.api_port}/healthz")
    spa_code, _ = http_get(f"http://127.0.0.1:{ctx.api_port}/stats/")
    config_code, config_body = http_get(f"http://127.0.0.1:{ctx.api_port}/stats/api/config")

    ok_health = health_code == 200
    ok_spa = 200 <= spa_code < 400
    ok_config = config_code == 200

    say(f"  /healthz              {'OK' if ok_health else 'FAIL'}  {health_body.strip()}")
    say(f"  /stats/               {'OK' if ok_spa else 'FAIL'}  HTTP {spa_code}")
    say(f"  /stats/api/config     {'OK' if ok_config else 'FAIL'}")
    if ok_config:
        say(f"  {config_body.strip()[:240]}")

    if not (ok_health and ok_spa and ok_config):
        raise InstallError("Verification failed. Check docker compose -p visitly ps && docker logs visitly-api")

    base = ctx.env.get("VISITLY_BASE_PATH", "/stats")
    hosts = ctx.env.get("VISITLY_SITE_HOSTS", "your-site").split(",")[0].strip()
    say()
    say("  Visitly is installed.")
    say(f"  Local:   http://127.0.0.1:{ctx.api_port}{base}/")
    say(f"  Public:  https://{hosts}{base}/  (after nginx proxy)")
    say(f"  Login:   {ctx.env.get('VISITLY_ADMIN_USER', 'admin')} / (password from .env)")
