from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from .stages import (
    stage_api,
    stage_collector,
    stage_configure,
    stage_migrate,
    stage_nginx,
    stage_postgres,
    stage_preflight,
    stage_verify,
)
from .util import InstallContext, InstallError, say


STAGES = [
    ("preflight", stage_preflight),
    ("configure", stage_configure),
    ("postgres", stage_postgres),
    ("api", stage_api),
    ("migrate", stage_migrate),
    ("collector", stage_collector),
    ("nginx", stage_nginx),
    ("verify", stage_verify),
]


def find_repo_root(start: Path | None = None) -> Path:
    here = (start or Path.cwd()).resolve()
    for candidate in [here, *here.parents]:
        if (candidate / "docker-compose.yml").exists() and (candidate / "apps" / "api").exists():
            return candidate
    return here


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="visitly-install",
        description="Interactive Visitly installer — runs each stage until the stack is live.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Visitly repo root (default: auto-detect from cwd)",
    )
    parser.add_argument("-y", "--yes", action="store_true", help="Accept stage confirmations")
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="No prompts; reuse .env / defaults (implies --yes for continue prompts where needed)",
    )
    parser.add_argument("--skip-nginx", action="store_true", help="Skip nginx proxy stage")
    parser.add_argument(
        "--nginx-config",
        type=Path,
        default=None,
        help="Nginx site config to patch (with backup). Implies nginx stage.",
    )
    parser.add_argument("--skip-collector", action="store_true", help="Skip collector + cron")
    parser.add_argument("--skip-cron", action="store_true", help="Build/run collector but skip cron")
    parser.add_argument(
        "--only",
        choices=[name for name, _ in STAGES],
        help="Run a single stage (for resume/debug)",
    )
    parser.add_argument(
        "--from",
        dest="from_stage",
        choices=[name for name, _ in STAGES],
        help="Resume from this stage",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = find_repo_root(args.root)
    ctx = InstallContext(
        root=root,
        yes=bool(args.yes or args.non_interactive),
        non_interactive=bool(args.non_interactive),
        skip_nginx=bool(args.skip_nginx),
        skip_collector=bool(args.skip_collector),
        skip_cron=bool(args.skip_cron),
        nginx_config=args.nginx_config.resolve() if args.nginx_config else None,
    )

    say(f"Visitly installer v{__version__}")
    say(f"Root: {ctx.root}")

    selected = STAGES
    if args.only:
        selected = [(n, fn) for n, fn in STAGES if n == args.only]
    elif args.from_stage:
        idx = next(i for i, (n, _) in enumerate(STAGES) if n == args.from_stage)
        selected = STAGES[idx:]

    try:
        for name, fn in selected:
            fn(ctx)
    except KeyboardInterrupt:
        say()
        say("Install interrupted.")
        return 130
    except InstallError as exc:
        say()
        say(f"ERROR: {exc}")
        return 1

    say()
    say("All stages complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
