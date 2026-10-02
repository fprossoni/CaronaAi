"""SQLAlchemy ORM models for ratings and blocks."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Rating(Base):
    __tablename__ = "ratings"
    __table_args__ = (
        UniqueConstraint("rater_id", "match_id", name="uq_rating_per_match"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    rater_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    rated_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), index=True)
    stars: Mapped[int] = mapped_column(Integer, nullable=False)  # 1–5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    rater: Mapped["User"] = relationship("User", back_populates="ratings_given", foreign_keys=[rater_id])
    rated: Mapped["User"] = relationship("User", back_populates="ratings_received", foreign_keys=[rated_id])


class Block(Base):
    __tablename__ = "blocks"
    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_block"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    blocker_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    blocked_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    blocker: Mapped["User"] = relationship("User", back_populates="blocks_made", foreign_keys=[blocker_id])
    blocked: Mapped["User"] = relationship("User", back_populates="blocks_received", foreign_keys=[blocked_id])
