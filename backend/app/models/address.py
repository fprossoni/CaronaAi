"""SQLAlchemy ORM model for user personal saved addresses."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserAddress(Base):
    __tablename__ = "user_addresses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)

    # Friendly label, e.g. "Casa", "Trabalho", "Ap Centro"
    label: Mapped[str] = mapped_column(String(100), nullable=False)

    # Address breakdown
    street: Mapped[str] = mapped_column(String(200), nullable=False)
    number: Mapped[str] = mapped_column(String(50), nullable=False)
    complement: Mapped[str | None] = mapped_column(String(100), nullable=True)
    neighborhood: Mapped[str | None] = mapped_column(String(100), nullable=True) # Bairro
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False)         # CEP
    city: Mapped[str] = mapped_column(String(100), default="Porto Alegre", nullable=False)
    state: Mapped[str] = mapped_column(String(50), default="RS", nullable=False)
    country: Mapped[str] = mapped_column(String(50), default="Brasil", nullable=False)

    # Coordinates calculated via geocoding (Nominatim)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="addresses")

    @property
    def full_address(self) -> str:
        parts = [f"{self.street}, {self.number}"]
        if self.complement:
            parts.append(self.complement)
        if self.neighborhood:
            parts.append(self.neighborhood)
        parts.append(f"{self.city} - {self.state}")
        if self.postal_code:
            parts.append(f"CEP {self.postal_code}")
        return ", ".join(parts)
