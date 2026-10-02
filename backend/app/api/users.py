"""Users router — /users/*"""

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, DbSession, VerifiedUser
from app.models.rating import Block
from app.models.user import User
from app.schemas.user import ProfileUpdate, UserPrivate, UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPrivate)
def get_my_profile(current_user: CurrentUser) -> User:
    """Return full profile of the authenticated user."""
    return current_user


@router.patch("/me", response_model=UserPrivate)
def update_my_profile(
    body: ProfileUpdate,
    current_user: VerifiedUser,
    db: DbSession,
) -> User:
    """Update the current user's profile."""
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: int, db: DbSession, current_user: VerifiedUser) -> User:
    """Get public profile of another user."""
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ─── Block/Unblock ───────────────────────────────────────────────────────────

@router.post("/{user_id}/block", status_code=201)
def block_user(user_id: int, current_user: VerifiedUser, db: DbSession) -> dict:
    """Block another user."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    existing = db.get(Block, {"blocker_id": current_user.id, "blocked_id": user_id})
    if not existing:
        db.add(Block(blocker_id=current_user.id, blocked_id=user_id))
        db.commit()
    return {"message": "User blocked"}


@router.delete("/{user_id}/block", status_code=200)
def unblock_user(user_id: int, current_user: VerifiedUser, db: DbSession) -> dict:
    """Unblock a previously blocked user."""
    from sqlalchemy import select
    block = db.execute(
        select(Block)
        .where(Block.blocker_id == current_user.id)
        .where(Block.blocked_id == user_id)
    ).scalar_one_or_none()
    if block:
        db.delete(block)
        db.commit()
    return {"message": "User unblocked"}
