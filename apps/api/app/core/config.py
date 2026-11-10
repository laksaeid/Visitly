from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from visitly_core.settings import RuntimeConfig, parse_hosts, set_runtime_config


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql+psycopg://visitly:visitly_dev_change_me@localhost:5432/visitly",
        alias="DATABASE_URL",
    )
    host: str = Field(default="127.0.0.1", alias="VISITLY_HOST")
    port: int = Field(default=3099, alias="VISITLY_PORT")
    user: str = Field(default="admin", alias="VISITLY_ADMIN_USER")
    password: str = Field(default="change-me", alias="VISITLY_ADMIN_PASSWORD")
    session_secret: str = Field(
        default="change-me-to-a-long-random-string",
        alias="VISITLY_SESSION_SECRET",
    )
    cookie_name: str = Field(default="visitly_sess", alias="VISITLY_COOKIE_NAME")
    session_ttl_seconds: int = Field(
        default=7 * 24 * 3600,
        alias="VISITLY_SESSION_TTL_SECONDS",
    )
    base_path: str = Field(default="/stats", alias="VISITLY_BASE_PATH")
    cors_origins: str = Field(
        default="http://localhost:5173",
        alias="VISITLY_CORS_ORIGINS",
    )
    site_name: str = Field(default="Visitly", alias="VISITLY_SITE_NAME")
    site_hosts: str = Field(default="", alias="VISITLY_SITE_HOSTS")
    timezone: str = Field(default="UTC", alias="VISITLY_TIMEZONE")
    locale: str = Field(default="en", alias="VISITLY_LOCALE")
    human_day_cap: int = Field(default=120, alias="VISITLY_HUMAN_DAY_CAP")

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def apply_runtime(self) -> None:
        set_runtime_config(RuntimeConfig(
            site_hosts=parse_hosts(self.site_hosts),
            timezone=self.timezone,
            human_day_cap=self.human_day_cap,
            site_name=self.site_name,
        ))


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.apply_runtime()
    return settings
