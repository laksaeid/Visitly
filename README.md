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

## Quick start

### 1. Configure

```bash
cp .env.example .env
```

Set at least:

```env
VISITLY_SITE_NAME=My Site
VISITLY_SITE_HOSTS=example.com,www.example.com
VISITLY_TIMEZONE=UTC
VISITLY_ADMIN_USER=admin
VISITLY_ADMIN_PASSWORD=choose-a-strong-password
VISITLY_SESSION_SECRET=long-random-string
VISITLY_LOG_SOURCE=file
VISITLY_LOG_PATH=/var/log/nginx/access.log
DATABASE_URL=postgresql+psycopg://visitly:visitly_dev_change_me@localhost:5432/visitly
```

### 2. Run with Docker Compose

Docker builds default to the **Arvan Iran mirrors** for PyPI/npm (override with `PIP_INDEX_URL` / `NPM_REGISTRY` in `.env`).

```bash
# optional: confirm mirror works
curl -I https://mirror.arvancloud.ir/pypi/simple/pip/

docker compose up -d --build postgres api web
# optional collector (mount host logs via VISITLY_HOST_LOG_DIR)
docker compose --profile collector up -d collector
```

- API: `http://127.0.0.1:3099`
- Web (nginx front): `http://127.0.0.1:8080/stats/`

Apply migrations once:

```bash
docker compose exec api alembic upgrade head
```

### 3. Nginx

See [`deploy/nginx.visitly.conf.snippet`](deploy/nginx.visitly.conf.snippet) for:

- Recommended `log_format visitly` (TSV including `$host`)
- `/stats/` reverse proxy to the API

Classic `combined` logs also work when `VISITLY_SITE_HOSTS` is set (host filter uses configured hosts; empty `$host` in combined lines is accepted for single-site installs).

### 4. Collector (cron / systemd)

Every 1–2 minutes:

```bash
python -m collector.main
# or: visitly-collect
```

Self-test:

```bash
python -m collector.main --selftest
```

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
apps/web          React + Vite dashboard (English, LTR)
apps/api          FastAPI auth + stats APIs
apps/collector    nginx log worker → Postgres
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
