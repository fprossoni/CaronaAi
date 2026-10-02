"""Re-export all models so Alembic and other modules can import from one place."""

from app.models.match import Match, MatchStatus
from app.models.rating import Block, Rating
from app.models.ride import CAMPUS_COORDS, UFRGS_CAMPUS, Ride, RideStatus
from app.models.user import EmailVerificationToken, Gender, User

__all__ = [
    "CAMPUS_COORDS",
    "UFRGS_CAMPUS",
    "Block",
    "EmailVerificationToken",
    "Gender",
    "Match",
    "MatchStatus",
    "Rating",
    "Ride",
    "RideStatus",
    "User",
]
