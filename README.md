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

## Install

Full steps: **[INSTALL.md](INSTALL.md)**.

```bash
git clone https://github.com/laksaeid/Visitly.git
cd Visitly
cp .env.example .env
# edit .env — site hosts, admin, timezone, log source (file|docker)
mkdir -p /var/lib/visitly

docker compose -p visitly up -d postgres
docker compose -p visitly build api
docker compose -p visitly up -d api
docker exec visitly-api alembic upgrade head

docker compose -p visitly --profile collector build collector
docker compose -p visitly --profile collector run --rm --no-deps collector
# then add /etc/cron.d/visitly-collect (see INSTALL.md)
```

Proxy `/stats/` to `127.0.0.1:3099` using `deploy/nginx.visitly.conf.snippet`.

Local UI: `http://127.0.0.1:3099/stats/` · Public: `https://your-domain/stats/`

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
| `VISITLY_LOCK_PATH` | Collector lock file (use `/var/lib/visitly/collect.lock` in prod) |
| `VISITLY_HUMAN_DAY_CAP` | Soft per-IP pageview cap (default `120`) |
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
