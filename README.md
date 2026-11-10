# Visitly

**Self-hosted website analytics from your nginx access logs.**

Visitly tails nginx logs (file or Docker stdout), stores privacy-hashed aggregates in Postgres, and serves a clean dashboard behind a simple login. No third-party trackers, no SaaS.

![Visitly](https://img.shields.io/badge/license-MIT-blue) ![stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React%20%2B%20Postgres-teal)

## Features

- Unique visitors & pageviews (bot-filtered)
- Daily / hourly charts in your timezone
- Top pages and traffic sources
- Cookie session login (single admin)
- Nginx **file** or **Docker** log source

## Install (automated)

Anyone can install from this repo with the staged CLI:

```bash
git clone https://github.com/laksaeid/Visitly.git
cd Visitly
chmod +x install.sh
./install.sh
```

Needs Docker + Compose. Host Python 3.10+ is optional — on older OS Python (e.g. 3.6) the script bootstraps itself in a `python:3.12` container. In Iran you can set `VISITLY_MIRROR_PROFILE=iran` first.

Windows:

```powershell
python install.py
```

The installer runs **8 stages** (preflight → `.env` → Postgres → API build → migrations → collector → nginx → verify), confirming each step. Full details: **[INSTALL.md](INSTALL.md)**.

```bash
./install.sh --yes
./install.sh --non-interactive --skip-nginx   # env/.env driven automation
./install.sh --from api                       # resume
./install.sh --only verify
```

After install: `http://127.0.0.1:3099/stats/` (and `https://your-domain/stats/` once nginx proxies).

## Local development

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt

cd apps/api && alembic upgrade head && cd ../..
.\scripts\dev-api.ps1   # API on :3099
.\scripts\dev-web.ps1   # Vite on :5173/stats/
```

Login uses `VISITLY_ADMIN_USER` / `VISITLY_ADMIN_PASSWORD`.

## Layout

```text
apps/web          React + Vite dashboard
apps/api          FastAPI auth + stats APIs
apps/collector    nginx log worker → Postgres
apps/installer    interactive `python install.py` CLI
packages/visitly_core   parsing, bots, timezone days, queries
deploy/           nginx snippets
```

## Environment reference

| Variable | Description |
|----------|-------------|
| `VISITLY_SITE_HOSTS` | Comma-separated allowed Host values |
| `VISITLY_TIMEZONE` | IANA timezone for day/hour buckets |
| `VISITLY_SITE_NAME` | Brand label in the UI |
| `VISITLY_BASE_PATH` | URL mount (default `/stats`) |
| `VISITLY_LOG_SOURCE` | `file` or `docker` |
| `VISITLY_LOG_PATH` | Access log path when `file` |
| `VISITLY_HOST_LOG_DIR` | Host dir mounted into collector for `file` logs |
| `VISITLY_DOCKER_CONTAINER` | Container name when `docker` |
| `DATABASE_URL` | Postgres SQLAlchemy URL |

## API

| Method | Path |
|--------|------|
| GET | `/stats/api/config` (public) |
| POST | `/stats/api/login` |
| GET | `/stats/api/logout` |
| GET | `/stats/api/me` |
| GET | `/stats/api/overview?day=` |
| GET | `/stats/api/day?day=` |
| GET | `/stats/api/top?kind=&day=` |

## License

MIT — see [LICENSE](LICENSE).
