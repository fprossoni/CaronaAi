"""Ratings router — /ratings/*"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import DbSession, VerifiedUser
from app.models.match import Match, MatchStatus
from app.models.rating import Rating
from app.models.user import User

router = APIRouter(prefix="/ratings", tags=["ratings"])


class RatingCreate(BaseModel):
    match_id: int
    rated_user_id: int
    stars: int
    comment: str | None = None


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_rating(body: RatingCreate, current_user: VerifiedUser, db: DbSession) -> dict:
    """Rate a user after a completed match."""
    if not (1 <= body.stars <= 5):
        raise HTTPException(status_code=400, detail="Stars must be between 1 and 5")

    match = db.get(Match, body.match_id)
    if not match or match.status != MatchStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Can only rate completed matches")

    # Ensure the rater was part of this match
    ride = match.ride
    if current_user.id not in (match.passenger_id, ride.driver_id):
        raise HTTPException(status_code=403, detail="You were not part of this match")

    # Ensure the rated user was also part of this match
    if body.rated_user_id not in (match.passenger_id, ride.driver_id):
        raise HTTPException(status_code=400, detail="Rated user was not part of this match")

    if body.rated_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot rate yourself")

    # Check for duplicate
    existing = db.execute(
        select(Rating)
        .where(Rating.rater_id == current_user.id)
        .where(Rating.match_id == body.match_id)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Already rated this match")

    rating = Rating(
        rater_id=current_user.id,
        rated_id=body.rated_user_id,
        match_id=body.match_id,
        stars=body.stars,
        comment=body.comment,
    )
    db.add(rating)

    # Update avg rating on the rated user
    rated_user = db.get(User, body.rated_user_id)
    if not rated_user:
        raise HTTPException(status_code=404, detail="Rated user not found")
        
    total = rated_user.avg_rating * rated_user.rating_count + body.stars
    rated_user.rating_count += 1
    rated_user.avg_rating = total / rated_user.rating_count

    db.commit()
    return {"message": "Rating submitted"}
