import paramiko

REMOTE = r"""
cd /root/stats/Visitly && docker compose -p visitly --profile collector run --rm --no-deps collector python -m collector.main --purge-backfill
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
print("starting purge-backfill...")
_, o, e = c.exec_command(REMOTE, timeout=1800)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR", err[-4000:])
print("EXIT", o.channel.recv_exit_status())
c.close()
