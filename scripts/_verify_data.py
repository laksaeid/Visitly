import paramiko

REMOTE = r"""
python3 <<'PY'
import json, urllib.request, subprocess, sqlite3
from pathlib import Path
from datetime import datetime, timedelta, timezone

env = {}
for line in Path("/root/stats/Visitly/.env").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

user = env.get("VISITLY_ADMIN_USER", "admin")
pw = env.get("VISITLY_ADMIN_PASSWORD", "change-me")
pg_user = env.get("POSTGRES_USER", "visitly")
pg_db = env.get("POSTGRES_DB", "visitly")
print("tz_env", env.get("VISITLY_TIMEZONE"))
print("hosts", env.get("VISITLY_SITE_HOSTS"))
print("cap", env.get("VISITLY_HUMAN_DAY_CAP"))

def http(url, data=None, cookie=None):
    headers = {}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(
        url, data=data, headers=headers, method="POST" if data is not None else "GET"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, resp.read().decode(), resp.headers.get("Set-Cookie", "")

st, body, setc = http(
    "http://127.0.0.1:3099/stats/api/login",
    json.dumps({"user": user, "password": pw}).encode(),
)
cookie = setc.split(";")[0]
print("login", st, body)

for bots in (False, True):
    q = "bots=true&" if bots else ""
    st, body, _ = http("http://127.0.0.1:3099/stats/api/overview?%sts=1" % q, cookie=cookie)
    d = json.loads(body)
    t = d["totals"]["today"]
    print("MODE", "bots" if bots else "humans")
    print(" generated", d["generated"], "tz", d["timezone"], "selected", d["selected_day"], "today", d["today"])
    print(" today", {k: t.get(k) for k in ["visitors", "pageviews", "visitors_all", "bot_pageviews", "requests"]})
    print(" day", d["day"]["totals"])
    print(" tops", [(p.get("path"), p.get("views")) for p in d["day"]["top_pages"][:5]])
    print(" daily_tail", d["daily"][-3:])

# Asia/Tehran is UTC+3:30 (no DST currently)
today = (datetime.now(timezone.utc) + timedelta(hours=3, minutes=30)).strftime("%Y-%m-%d")
print("tehran_today", today)

def psql(sql):
    return subprocess.check_output(
        ["docker", "exec", "-i", "visitly-pg", "psql", "-U", pg_user, "-d", pg_db, "-c", sql],
        universal_newlines=True,
    )

print("--- visits by day ---")
print(psql(
    "SELECT day, SUM(pageviews) AS pageviews, SUM(bot_pageviews) AS bot_pageviews, "
    "SUM(requests) AS requests, COUNT(DISTINCT ip) AS all_ips, "
    "COUNT(DISTINCT ip) FILTER (WHERE human = 1) AS human_flag_ips, "
    "COUNT(DISTINCT ip) FILTER (WHERE pageviews > 0) AS ips_with_human_pv "
    "FROM visits GROUP BY day ORDER BY day DESC LIMIT 8;"
))

print("--- eligible humans today ---")
print(psql(
    "SELECT COUNT(DISTINCT ip) AS visitors, COALESCE(SUM(pv),0) AS pageviews FROM ("
    " SELECT day, ip, SUM(pageviews) AS pv FROM visits"
    " WHERE day BETWEEN '%s' AND '%s' AND human = 1"
    " GROUP BY day, ip HAVING SUM(pageviews) <= 120"
    ") e;" % (today, today)
))

print("--- all page activity today ---")
print(psql(
    "SELECT COUNT(DISTINCT ip) AS ips, COALESCE(SUM(pageviews),0) AS human_pv, "
    "COALESCE(SUM(bot_pageviews),0) AS bot_pv, "
    "COALESCE(SUM(pageviews+bot_pageviews),0) AS all_pv, "
    "COALESCE(SUM(requests),0) AS requests "
    "FROM visits WHERE day = '%s';" % today
))

print("--- path counts ---")
print(psql("SELECT COUNT(*) AS paths FROM ip_paths;"))
print(psql("SELECT COUNT(*) AS refs FROM ip_refs;"))
print(psql("SELECT path, SUM(views) v FROM ip_paths GROUP BY path ORDER BY v DESC LIMIT 10;"))

print("--- collector log ---")
print(subprocess.check_output(["bash", "-lc", "tail -n 40 /var/log/visitly-collect.log 2>/dev/null || true"], universal_newlines=True))

print("--- api selected env ---")
out = subprocess.check_output(["docker", "exec", "visitly-api", "printenv"], universal_newlines=True)
for line in out.splitlines():
    if line.startswith(("VISITLY_", "DATABASE_", "POSTGRES_")):
        if "PASSWORD" in line or "SECRET" in line:
            k = line.split("=", 1)[0]
            print(k + "=***")
        else:
            print(line)

p = Path("/root/hamerz-stats/stats.db")
if p.exists():
    con = sqlite3.connect(str(p))
    tables = [r[0] for r in con.execute("select name from sqlite_master where type='table'")]
    print("--- legacy tables ---", tables)
    for t in tables:
        cols = con.execute("pragma table_info(%s)" % t).fetchall()
        print("schema", t, cols)
        try:
            print("count", t, con.execute("select count(*) from %s" % t).fetchone())
        except Exception as ex:
            print("count err", t, ex)
    if "visits" in tables:
        try:
            print("legacy days", con.execute(
                "select day, sum(pageviews), sum(bot_pageviews), sum(requests), count(distinct ip) "
                "from visits group by day order by day desc limit 8"
            ).fetchall())
        except Exception as ex:
            print("legacy aggregate err", ex)
PY
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "62.60.212.159",
    username="root",
    password="6886NcZrGf",
    timeout=30,
    allow_agent=False,
    look_for_keys=False,
)
_, o, e = c.exec_command(REMOTE, timeout=180)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR", err[:5000])
c.close()
