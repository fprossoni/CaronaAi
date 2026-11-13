"""Re-export all models so Alembic and other modules can import from one place."""

from app.models.address import UserAddress
from app.models.chat import ChatMessage, Conversation
from app.models.match import Match, MatchStatus
from app.models.rating import Block, Rating
from app.models.report import Report
from app.models.ride import CAMPUS_COORDS, UFRGS_CAMPUS, Ride, RideStatus
from app.models.user import EmailVerificationToken, Gender, User

__all__ = [
    "CAMPUS_COORDS",
    "UFRGS_CAMPUS",
    "Block",
    "ChatMessage",
    "Conversation",
    "EmailVerificationToken",
    "Gender",
    "Match",
    "MatchStatus",
    "Rating",
    "Report",
    "Ride",
    "RideStatus",
    "User",
    "UserAddress",
]
