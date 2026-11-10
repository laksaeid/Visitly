# Installing Visitly

## Requirements

- Linux host with Docker Engine + Compose plugin (`docker compose`)
- An nginx edge that already serves your site (host nginx **or** a Docker nginx container)
- Free localhost ports **3099** (API/UI) and **5433** (Postgres)
- Outbound network to pull/build images

## 1. Clone and configure

```bash
git clone https://github.com/laksaeid/Visitly.git
cd Visitly
cp .env.example .env
mkdir -p /var/lib/visitly
```

Edit `.env`. Minimum you must set:

| Variable | Example |
|----------|---------|
| `POSTGRES_PASSWORD` | strong password |
| `DATABASE_URL` | `postgresql+psycopg://visitly:PASSWORD@localhost:5433/visitly` (host-side tools only; Compose overrides this inside containers) |
| `VISITLY_SITE_NAME` | `Hamerz` |
| `VISITLY_SITE_HOSTS` | `example.com,www.example.com` |
| `VISITLY_TIMEZONE` | `Asia/Tehran` |
| `VISITLY_ADMIN_USER` / `VISITLY_ADMIN_PASSWORD` | dashboard login |
| `VISITLY_SESSION_SECRET` | long random string |
| `VISITLY_LOG_SOURCE` | `docker` or `file` |
| `VISITLY_DOCKER_CONTAINER` | nginx container name when `docker` (e.g. `hamerz-nginx-edge`) |
| `VISITLY_LOG_PATH` / `VISITLY_HOST_LOG_DIR` | when `file` |
| `VISITLY_LOCK_PATH` | `/var/lib/visitly/collect.lock` |

**Iran mirrors** (optional) — uncomment the Iran block in `.env.example` (`VISITLY_MIRROR_PROFILE=iran`, Arvan images, Tsinghua PyPI, npmmirror).

**Log format:** Visitly expects edge TSV lines with `$host` (see `deploy/nginx.visitly.conf.snippet`). Combined logs also work but cannot filter by Host as cleanly.

## 2. Start Postgres + API

```bash
docker compose -p visitly up -d postgres
docker compose -p visitly build api
docker compose -p visitly up -d api
docker exec visitly-api alembic upgrade head
```

Check:

```bash
curl -sS http://127.0.0.1:3099/healthz
curl -sS http://127.0.0.1:3099/stats/api/config
```

UI locally: `http://127.0.0.1:3099/stats/`

## 3. Collector (first import + cron)

Build and run a one-shot import:

```bash
docker compose -p visitly --profile collector build collector
docker compose -p visitly --profile collector run --rm --no-deps collector
```

Schedule every 2 minutes (do **not** overlap long backfills without the lock — Compose uses a Postgres advisory lock plus `/var/lib/visitly/collect.lock`):

```bash
cat >/etc/cron.d/visitly-collect <<'EOF'
*/2 * * * * root cd /path/to/Visitly && /usr/bin/docker compose -p visitly --profile collector run --rm --no-deps collector >>/var/log/visitly-collect.log 2>&1
EOF
chmod 644 /etc/cron.d/visitly-collect
```

If counts look doubled after a bad run, pause cron, rebuild from logs, then re-enable:

```bash
mv /etc/cron.d/visitly-collect /etc/cron.d/visitly-collect.disabled
docker compose -p visitly --profile collector run --rm --no-deps collector \
  python -m collector.main --purge-backfill
mv /etc/cron.d/visitly-collect.disabled /etc/cron.d/visitly-collect
```

## 4. Nginx `/stats/` proxy

Copy the location block from `deploy/nginx.visitly.conf.snippet` into the **site** `server { }` that serves your public hostname (not an unrelated vhost).

```nginx
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
```

Backup the conf, test, reload:

```bash
cp /path/to/site.conf /path/to/site.conf.visitly-bak-$(date +%Y%m%d%H%M%S)
nginx -t && nginx -s reload
# or, for Docker edge nginx:
# docker exec <nginx-container> nginx -t && docker exec <nginx-container> nginx -s reload
```

Public UI: `https://YOUR_DOMAIN/stats/`

## 5. Verify

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3099/stats/
curl -sS http://127.0.0.1:3099/healthz
tail -f /var/log/visitly-collect.log
docker logs -f visitly-api
```

Login with `VISITLY_ADMIN_USER` / `VISITLY_ADMIN_PASSWORD`.

## How metrics work (so numbers look “right”)

- **Source:** nginx access logs only (no JS beacon). Client-side SPA navigations that never hit nginx are invisible.
- **Pageviews:** `GET`/`HEAD` `200`/`304` HTML-like paths; assets, `/_next/`, `/api/`, `/stats`, etc. are skipped.
- **Bots:** User-Agent patterns → `bot_pageviews`. Default UI filter is humans only.
- **Cap:** each IP contributes at most `VISITLY_HUMAN_DAY_CAP` (default 120) pageviews/day; IPs above `5 × cap` are treated as crawlers and excluded from the human KPI.
- **Uniques:** distinct privacy-hashed IPs with at least one eligible pageview.

If the dashboard looks inflated, check `/var/log/visitly-collect.log` for a second huge `imported NNNNN requests` line — that means a full re-ingest raced the previous run. Use `--purge-backfill` after fixing locks/cron as above.

## Upgrades

```bash
cd /path/to/Visitly
git pull
docker compose -p visitly build api collector
docker compose -p visitly up -d api
docker exec visitly-api alembic upgrade head
# collector picks up on next cron tick; or run once:
docker compose -p visitly --profile collector run --rm --no-deps collector
```

## Safety notes

- Postgres (`5433`) and API (`3099`) bind to **127.0.0.1** only.
- Do not restart the Docker daemon or unrelated Compose stacks while installing.
- Always backup nginx conf before editing; run `nginx -t` before reload.
