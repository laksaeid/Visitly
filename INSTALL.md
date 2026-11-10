# Installing Visitly

Visitly ships an **automated staged installer** so anyone can go from a git clone to a running dashboard without hand-copying Docker commands.

## Requirements

- Linux server recommended (nginx + Docker is the usual production setup)
- Docker Engine with Compose plugin (`docker compose`)
- Python 3.10+ (stdlib only — no `pip install` needed for the installer)
- Outbound network to pull images / build deps (or use the Iran mirror profile)

## One-command install

```bash
git clone https://github.com/laksaeid/Visitly.git
cd Visitly
chmod +x install.sh
./install.sh
```

Windows (PowerShell), from the repo root:

```powershell
python install.py
```

The installer pauses between stages so you can review each step. Use `--yes` to auto-accept continue prompts.

## What each stage does

| # | Stage | Action |
|---|-------|--------|
| 1 | Preflight | Checks Docker, Compose, ports `3099` / `5433` |
| 2 | Configure | Writes `.env` (site, admin, log source, mirror profile) |
| 3 | Postgres | Starts `visitly-pg` on `127.0.0.1:5433` |
| 4 | API | Builds SPA + API image, starts `visitly-api` on `127.0.0.1:3099` |
| 5 | Migrate | Runs `alembic upgrade head` |
| 6 | Collector | Builds collector, first run, optional `/etc/cron.d` job |
| 7 | Nginx | Prints `/stats/` proxy snippet; optional safe patch + backup |
| 8 | Verify | Hits `/healthz`, `/stats/`, `/stats/api/config` |

## Fully automated (CI / scripted)

Set config via environment (or a prepared `.env`), then:

```bash
export VISITLY_SITE_NAME='My Site'
export VISITLY_SITE_HOSTS='example.com,www.example.com'
export VISITLY_TIMEZONE='UTC'
export VISITLY_ADMIN_USER='admin'
export VISITLY_ADMIN_PASSWORD='choose-a-strong-password'
export VISITLY_LOG_SOURCE='file'   # or docker
export VISITLY_LOG_PATH='/var/log/nginx/access.log'
# optional Iran-friendly builds:
# export VISITLY_MIRROR_PROFILE=iran

./install.sh --non-interactive --skip-nginx
```

Patch nginx in the same run:

```bash
./install.sh --non-interactive --nginx-config /etc/nginx/sites-enabled/example.com
```

## Resume / repair

```bash
./install.sh --from api          # continue from API build
./install.sh --only verify       # health check only
./install.sh --only collector    # rebuild collector + cron prompt
```

## After install

- Local UI: `http://127.0.0.1:3099/stats/`
- Public UI: `https://YOUR_DOMAIN/stats/` (after nginx proxy)
- Login: values from `.env` (`VISITLY_ADMIN_USER` / `VISITLY_ADMIN_PASSWORD`)

Logs:

```bash
docker logs -f visitly-api
docker compose -p visitly --profile collector run --rm --no-deps collector
```

## Mirror profiles

| Profile | When to use |
|---------|-------------|
| `global` (default) | Docker Hub + PyPI + npmjs |
| `iran` | Arvan Docker mirror + Tsinghua PyPI + npmmirror |

Choose interactively in stage 2, or set `VISITLY_MIRROR_PROFILE=iran`.

## Safety notes

- Postgres and API bind to **localhost only** (`5433`, `3099`) so they do not collide with an existing public Postgres on `5432`.
- Nginx patching always writes a timestamped `*.visitly-bak-*` backup and runs `nginx -t` before reload.
- The installer never restarts the Docker daemon and never touches unrelated Compose projects.
