"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-11-10
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "visits",
        sa.Column("day", sa.String(length=10), nullable=False),
        sa.Column("hour", sa.String(length=13), nullable=False),
        sa.Column("ip", sa.String(length=32), nullable=False),
        sa.Column("human", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pageviews", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("bot_pageviews", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("requests", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("day", "hour", "ip", name="pk_visits"),
    )
    op.create_index("visits_ip", "visits", ["ip"])
    op.create_index("visits_ip_day", "visits", ["ip", "day"])
    op.create_index("visits_day_human", "visits", ["day", "human"])

    op.create_table(
        "ip_paths",
        sa.Column("day", sa.String(length=10), nullable=False),
        sa.Column("ip", sa.String(length=32), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("views", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("day", "ip", "path", name="pk_ip_paths"),
    )

    op.create_table(
        "ip_refs",
        sa.Column("day", sa.String(length=10), nullable=False),
        sa.Column("ip", sa.String(length=32), nullable=False),
        sa.Column("referer", sa.Text(), nullable=False),
        sa.Column("views", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("day", "ip", "referer", name="pk_ip_refs"),
    )

    op.create_table(
        "meta",
        sa.Column("k", sa.String(length=64), nullable=False),
        sa.Column("v", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("k", name="pk_meta"),
    )


def downgrade() -> None:
    op.drop_table("meta")
    op.drop_table("ip_refs")
    op.drop_table("ip_paths")
    op.drop_index("visits_day_human", table_name="visits")
    op.drop_index("visits_ip_day", table_name="visits")
    op.drop_index("visits_ip", table_name="visits")
    op.drop_table("visits")
