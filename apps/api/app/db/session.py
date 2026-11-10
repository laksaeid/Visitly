from __future__ import annotations

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from visitly_core.db import make_engine, make_session_factory

_settings = get_settings()
engine: Engine = make_engine(_settings.database_url)
SessionLocal: sessionmaker[Session] = make_session_factory(engine)
