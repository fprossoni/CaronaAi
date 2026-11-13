"""Persistent test accounts backed by the regular user and authentication models."""

from hashlib import sha256
from secrets import token_urlsafe
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, hash_password
from app.models.user import Gender, User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserPrivate


def require_dev_accounts() -> None:
    if not settings.DEV_ACCOUNTS_ENABLED:
        raise HTTPException(status_code=404, detail="Contas de teste desativadas nesta API.")


def owner_hash(workspace: Annotated[UUID, Header(alias="X-Dev-Workspace")]) -> str:
    return sha256(workspace.bytes).hexdigest()


DevOwner = Annotated[str, Depends(owner_hash)]
router = APIRouter(prefix="/dev/accounts", tags=["dev"], dependencies=[Depends(require_dev_accounts)])


class DevAccountCreate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    gender: Gender


class DevAccountSummary(BaseModel):
    id: int
    name: str
    gender: Gender | None
    is_driver: bool

    model_config = ConfigDict(from_attributes=True)


class DevSession(TokenResponse):
    user: UserPrivate


def session_for(user: User) -> DevSession:
    return DevSession(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        user=UserPrivate.model_validate(user),
    )


@router.get("", response_model=list[DevAccountSummary])
def list_accounts(owner: DevOwner, db: DbSession) -> list[User]:
    return list(db.scalars(
        select(User).where(User.dev_owner_hash == owner, User.is_active.is_(True)).order_by(User.id)
    ))


@router.post("", response_model=DevSession, status_code=status.HTTP_201_CREATED)
def create_account(body: DevAccountCreate, owner: DevOwner, db: DbSession) -> DevSession:
    user = User(
        name=body.name,
        gender=body.gender,
        email=f"teste-{uuid4().hex}@carona.invalid",
        hashed_password=hash_password(token_urlsafe(32)),
        is_verified=True,
        dev_owner_hash=owner,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return session_for(user)


@router.post("/{account_id}/session", response_model=DevSession)
def switch_account(account_id: int, owner: DevOwner, db: DbSession) -> DevSession:
    user = db.get(User, account_id)
    if not user or not user.is_active or user.dev_owner_hash != owner:
        raise HTTPException(status_code=404, detail="Conta de teste não encontrada neste navegador.")
    return session_for(user)
