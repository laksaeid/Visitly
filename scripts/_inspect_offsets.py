import paramiko

REMOTE = r"""
python3 <<'PY'
import subprocess, sqlite3, json
from pathlib import Path

def sh(cmd):
    return subprocess.check_output(cmd, shell=True, universal_newlines=True)

print('--- meta postgres ---')
print(sh("docker exec -i visitly-pg psql -U visitly -d visitly -c \"SELECT * FROM meta;\""))
print('--- meta sqlite ---')
con = sqlite3.connect('/root/hamerz-stats/stats.db')
print(con.execute('select * from meta').fetchall())
print('--- nginx edge log path ---')
print(sh("docker inspect -f '{{.LogPath}}' hamerz-nginx-edge"))
log = sh("docker inspect -f '{{.LogPath}}' hamerz-nginx-edge").strip()
print('log size', sh("ls -lh %s" % log))
print('log lines approx', sh("wc -l %s" % log))
print('--- sample live lines ---')
print(sh("tail -n 3 %s | sed 's/\\\\u003e/>/g' | head -c 2000" % log))
# decode docker json log
import codecs
for line in sh("tail -n 2 %s" % log).splitlines():
    try:
        obj = json.loads(line)
        print('LOG', obj.get('log','')[:300])
    except Exception as e:
        print('raw', line[:200], e)
print('--- visitly containers ---')
print(sh("docker ps --filter name=visitly --format '{{.Names}} {{.Status}}'"))
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
_, o, e = c.exec_command(REMOTE, timeout=120)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR", err[:3000])
c.close()
