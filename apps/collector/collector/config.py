from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from visitly_core.settings import RuntimeConfig, parse_hosts, set_runtime_config


class CollectorSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql+psycopg://visitly:visitly_dev_change_me@localhost:5432/visitly",
        alias="DATABASE_URL",
    )
    log_source: str = Field(default="file", alias="VISITLY_LOG_SOURCE")
    log_path: str = Field(
        default="/var/log/nginx/access.log",
        alias="VISITLY_LOG_PATH",
    )
    docker_container: str = Field(
        default="nginx",
        alias="VISITLY_DOCKER_CONTAINER",
    )
    lock_path: str = Field(default="./collect.lock", alias="VISITLY_LOCK_PATH")
    site_hosts: str = Field(default="", alias="VISITLY_SITE_HOSTS")
    timezone: str = Field(default="UTC", alias="VISITLY_TIMEZONE")
    site_name: str = Field(default="Visitly", alias="VISITLY_SITE_NAME")
    human_day_cap: int = Field(default=120, alias="VISITLY_HUMAN_DAY_CAP")

    def apply_runtime(self) -> None:
        set_runtime_config(RuntimeConfig(
            site_hosts=parse_hosts(self.site_hosts),
            timezone=self.timezone,
            human_day_cap=self.human_day_cap,
            site_name=self.site_name,
        ))


@lru_cache
def get_settings() -> CollectorSettings:
    settings = CollectorSettings()
    settings.apply_runtime()
    return settings
