"""Users router — /users/*"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, VerifiedUser
from app.models.rating import Block
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportPublic
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

    existing = db.execute(
        select(Block)
        .where(Block.blocker_id == current_user.id)
        .where(Block.blocked_id == user_id)
    ).scalar_one_or_none()
    if not existing:
        db.add(Block(blocker_id=current_user.id, blocked_id=user_id))
        db.commit()
    return {"message": "User blocked"}


@router.delete("/{user_id}/block", status_code=200)
def unblock_user(user_id: int, current_user: VerifiedUser, db: DbSession) -> dict:
    """Unblock a previously blocked user."""
    block = db.execute(
        select(Block)
        .where(Block.blocker_id == current_user.id)
        .where(Block.blocked_id == user_id)
    ).scalar_one_or_none()
    if block:
        db.delete(block)
        db.commit()
    return {"message": "User unblocked"}


# ─── Reports / Complaints ────────────────────────────────────────────────────

@router.get("/me/reports", response_model=list[ReportPublic])
def get_my_reports(current_user: VerifiedUser, db: DbSession) -> list[ReportPublic]:
    """Reports the current user has filed, most recent first."""
    reports = db.execute(
        select(Report)
        .where(Report.reporter_id == current_user.id)
        .order_by(Report.created_at.desc())
    ).scalars().all()
    return [
        ReportPublic(
            id=report.id,
            reporter_id=report.reporter_id,
            reported_id=report.reported_id,
            reported_name=report.reported.name if report.reported else None,
            ride_id=report.ride_id,
            match_id=report.match_id,
            reason=report.reason,
            details=report.details,
            status=report.status,
            created_at=report.created_at,
        )
        for report in reports
    ]


@router.post("/{user_id}/report", status_code=201)
def report_user(
    user_id: int,
    body: ReportCreate,
    current_user: VerifiedUser,
    db: DbSession,
) -> dict:
    """File a moderation report against another user, optionally blocking them."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    target = db.get(User, user_id)
    if not target or not target.is_active:
        raise HTTPException(status_code=404, detail="User not found")

    report = Report(
        reporter_id=current_user.id,
        reported_id=user_id,
        ride_id=body.ride_id,
        match_id=body.match_id,
        reason=body.reason,
        details=body.details,
        status="pending",
    )
    db.add(report)

    if body.block:
        existing = db.execute(
            select(Block)
            .where(Block.blocker_id == current_user.id)
            .where(Block.blocked_id == user_id)
        ).scalar_one_or_none()
        if not existing:
            db.add(Block(blocker_id=current_user.id, blocked_id=user_id))

    db.commit()
    db.refresh(report)
    return {"message": "Report submitted", "report_id": report.id}
