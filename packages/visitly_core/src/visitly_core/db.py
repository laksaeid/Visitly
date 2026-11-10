"""SQLAlchemy engine helpers and ORM models."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import (
    Integer,
    MetaData,
    String,
    Text,
    create_engine,
    text,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class Visit(Base):
    __tablename__ = "visits"

    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    hour: Mapped[str] = mapped_column(String(13), primary_key=True)
    ip: Mapped[str] = mapped_column(String(32), primary_key=True)
    human: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pageviews: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bot_pageviews: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    requests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class IpPath(Base):
    __tablename__ = "ip_paths"

    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    ip: Mapped[str] = mapped_column(String(32), primary_key=True)
    path: Mapped[str] = mapped_column(Text, primary_key=True)
    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class IpRef(Base):
    __tablename__ = "ip_refs"

    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    ip: Mapped[str] = mapped_column(String(32), primary_key=True)
    referer: Mapped[str] = mapped_column(Text, primary_key=True)
    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class MetaKV(Base):
    __tablename__ = "meta"

    k: Mapped[str] = mapped_column(String(64), primary_key=True)
    v: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


def make_engine(database_url: str, *, echo: bool = False) -> Engine:
    return create_engine(database_url, pool_pre_ping=True, echo=echo)


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def meta_get(session: Session, key: str) -> Optional[str]:
    row = session.execute(
        text("SELECT v FROM meta WHERE k = :k"), {"k": key}
    ).fetchone()
    return row[0] if row else None


def meta_set(session: Session, key: str, value: str) -> None:
    session.execute(
        text(
            """
            INSERT INTO meta(k, v) VALUES(:k, :v)
            ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v
            """
        ),
        {"k": key, "v": value},
    )


def one(session: Session, sql: str, params: Optional[dict] = None):
    row = session.execute(text(sql), params or {}).fetchone()
    return row[0] if row else 0


def ensure_schema(engine: Engine) -> None:
    """Create tables + indexes without Alembic (bootstrap / tests)."""
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS visits_ip ON visits(ip)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS visits_ip_day ON visits(ip, day)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS visits_day_human ON visits(day, human)"
        ))
