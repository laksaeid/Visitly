from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    user: str = Field(default="")
    password: str = Field(default="")


class OkResponse(BaseModel):
    ok: bool
    error: Optional[str] = None
    user: Optional[str] = None
    redirect: Optional[str] = None
