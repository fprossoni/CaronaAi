"""Pydantic schemas for moderation reports."""

from datetime import datetime

from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    reason: str = Field(min_length=3, max_length=120)
    details: str | None = Field(default=None, max_length=1000)
    ride_id: int | None = None
    match_id: int | None = None
    block: bool = False


class ReportPublic(BaseModel):
    id: int
    reporter_id: int
    reported_id: int
    reported_name: str | None = None
    ride_id: int | None = None
    match_id: int | None = None
    reason: str
    details: str | None = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
