"""SQLAlchemy ORM model for moderation reports."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    reported_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    ride_id: Mapped[int | None] = mapped_column(ForeignKey("rides.id"), nullable=True, index=True)
    match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"), nullable=True, index=True)

    reason: Mapped[str] = mapped_column(String(120))
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    reporter: Mapped["User"] = relationship("User", foreign_keys=[reporter_id])
    reported: Mapped["User"] = relationship("User", foreign_keys=[reported_id])
