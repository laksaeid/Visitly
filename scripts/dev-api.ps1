$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$env:PYTHONPATH = "$Root\apps\api;$Root\apps\collector;$Root\packages\visitly_core\src"
& "$Root\.venv\Scripts\uvicorn.exe" app.main:app --app-dir "$Root\apps\api" --host 127.0.0.1 --port 3099 --reload
