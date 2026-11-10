import paramiko

REMOTE = r"""
python3 <<'PY'
import json, urllib.request, subprocess
from pathlib import Path
from datetime import datetime, timedelta, timezone

env = {}
for line in Path('/root/stats/Visitly/.env').read_text().splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k,v = line.split('=',1); env[k.strip()]=v.strip()

def http(url, data=None, cookie=None):
    headers = {'Content-Type':'application/json'} if data is not None else {}
    if cookie: headers['Cookie']=cookie
    req = urllib.request.Request(url, data=data, headers=headers, method='POST' if data is not None else 'GET')
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, resp.read().decode(), resp.headers.get('Set-Cookie','')

st, body, setc = http('http://127.0.0.1:3099/stats/api/login', json.dumps({'user':env['VISITLY_ADMIN_USER'],'password':env['VISITLY_ADMIN_PASSWORD']}).encode())
cookie = setc.split(';')[0]
st, body, _ = http('http://127.0.0.1:3099/stats/api/overview?ts=1', cookie=cookie)
d = json.loads(body)
print('humans today', d['totals']['today'])
print('day', d['day']['totals'])
print('tops', [(p.get('path'), p.get('views')) for p in d['day']['top_pages'][:5]])
st, body, _ = http('http://127.0.0.1:3099/stats/api/overview?bots=true&ts=1', cookie=cookie)
d2 = json.loads(body)
print('bots today', d2['totals']['today'])
today = (datetime.now(timezone.utc) + timedelta(hours=3, minutes=30)).strftime('%Y-%m-%d')
sql = (
    "SELECT day, SUM(pageviews), SUM(bot_pageviews), SUM(requests), COUNT(DISTINCT ip) "
    "FROM visits GROUP BY day ORDER BY day;"
)
print(subprocess.check_output(['docker','exec','-i','visitly-pg','psql','-U','visitly','-d','visitly','-c',sql], universal_newlines=True))
print(subprocess.check_output(['docker','exec','-i','visitly-pg','psql','-U','visitly','-d','visitly','-c',
    "SELECT COUNT(DISTINCT ip), COALESCE(SUM(pv),0) FROM ("
    " SELECT day, ip, SUM(pageviews) pv FROM visits WHERE day='%s' AND human=1 "
    " GROUP BY day, ip HAVING SUM(pageviews)<=120) e;" % today
], universal_newlines=True))
PY
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('62.60.212.159', username='root', password='6886NcZrGf', timeout=30, allow_agent=False, look_for_keys=False)
_, o, e = c.exec_command(REMOTE, timeout=60)
print(o.read().decode())
print(e.read().decode()[:2000])
c.close()
