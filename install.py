#!/usr/bin/env python3
"""Visitly installer entrypoint.

Usage:
  python install.py
  python install.py --yes
  python install.py --from api
  python install.py --only verify
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "apps"))

from installer.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
