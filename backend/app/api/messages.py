"""Chat access is derived from current ride/match status on every request."""

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from app.api.deps import DbSession, VerifiedUser
from app.models.chat import ChatMessage, Conversation
from app.models.match import Match, MatchStatus
from app.models.ride import Ride
from app.schemas.chat import (
    ConversationCreate,
    ConversationPublic,
    MessageCreate,
    MessagePublic,
)
from app.services.match_rules import LIVE_RIDE_STATUSES, is_blocked_between

router = APIRouter(prefix="/messages", tags=["messages"])


def _participants(ride):
    return {m.passenger_id: m.passenger for m in ride.matches if m.status == MatchStatus.ACCEPTED}


def _allowed(db, ride, user_id, passenger_id=None):
    passengers = _participants(ride)
    if not passengers or (user_id != ride.driver_id and user_id not in passengers):
        return False
    if passenger_id is not None:
        return (passenger_id in passengers and user_id in (ride.driver_id, passenger_id)
                and not is_blocked_between(db, ride.driver_id, passenger_id))
    return True


def _public(conversation):
    ride = conversation.ride
    passengers = _participants(ride)
    members = [ride.driver]
    if conversation.passenger_id is None:
        members.extend(passengers.values())
    else:
        members.append(passengers[conversation.passenger_id])
    return ConversationPublic(
        id=conversation.id, ride_id=ride.id,
        kind="group" if conversation.passenger_id is None else "private",
        driver_id=ride.driver_id, passenger_id=conversation.passenger_id,
        origin_label=ride.origin_label, destination_label=ride.destination_label,
        departure_at=ride.departure_at, participants=members,
    )


def _authorized(db, conversation_id, user_id, *, lock=False):
    conversation = db.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(404, "Conversa indisponível")
    # Same ride lock used by accept/cancel/complete; serializes writes with closure.
    ride = db.get(Ride, conversation.ride_id, with_for_update=lock)
    if not _allowed(db, ride, user_id, conversation.passenger_id):
        raise HTTPException(403, "Você não participa desta conversa")
    if ride.status not in LIVE_RIDE_STATUSES:
        raise HTTPException(409, "Esta carona foi encerrada. A conversa não está mais ativa.")
    return conversation


@router.get("", response_model=list[ConversationPublic])
def list_conversations(db: DbSession, current_user: VerifiedUser):
    accepted = select(Match.ride_id).where(
        Match.passenger_id == current_user.id, Match.status == MatchStatus.ACCEPTED,
    )
    conversations = db.scalars(
        select(Conversation).join(Ride).where(
            Ride.status.in_(LIVE_RIDE_STATUSES),
            or_(Ride.driver_id == current_user.id, Ride.id.in_(accepted)),
            or_(Conversation.passenger_id.is_(None), Conversation.passenger_id == current_user.id,
                Ride.driver_id == current_user.id),
        ).options(
            joinedload(Conversation.ride).joinedload(Ride.driver),
            joinedload(Conversation.ride).selectinload(Ride.matches).joinedload(Match.passenger),
        ).order_by(Conversation.id.desc())
    ).all()
    return [_public(c) for c in conversations if _allowed(db, c.ride, current_user.id, c.passenger_id)]


@router.post("", response_model=ConversationPublic)
def open_conversation(body: ConversationCreate, db: DbSession, current_user: VerifiedUser):
    ride = db.get(Ride, body.ride_id, with_for_update=True)
    if ride is None:
        raise HTTPException(404, "Carona não encontrada")
    if not _allowed(db, ride, current_user.id, body.passenger_id):
        raise HTTPException(403, "Mensagens disponíveis apenas para participantes confirmados")
    if ride.status not in LIVE_RIDE_STATUSES:
        raise HTTPException(409, "Esta carona foi encerrada")
    scope = "group" if body.passenger_id is None else f"passenger:{body.passenger_id}"
    conversation = db.scalar(select(Conversation).where(
        Conversation.ride_id == ride.id, Conversation.scope == scope,
    ))
    if conversation is None:
        conversation = Conversation(ride_id=ride.id, scope=scope, passenger_id=body.passenger_id)
        db.add(conversation)
        db.flush()
    result = _public(conversation)
    db.commit()
    return result


@router.get("/{conversation_id}/items", response_model=list[MessagePublic])
def list_messages(
    conversation_id: int, db: DbSession, current_user: VerifiedUser,
    after: int | None = Query(default=None, ge=0),
    before: int | None = Query(default=None, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
):
    _authorized(db, conversation_id, current_user.id)
    if after is not None and before is not None:
        raise HTTPException(400, "Use apenas um cursor por vez")
    query = select(ChatMessage).where(ChatMessage.conversation_id == conversation_id)
    if after is not None:
        query = query.where(ChatMessage.id > after).order_by(ChatMessage.id)
    else:
        if before is not None:
            query = query.where(ChatMessage.id < before)
        query = query.order_by(ChatMessage.id.desc())
    items = list(db.scalars(query.options(joinedload(ChatMessage.sender)).limit(limit)))
    return items if after is not None else list(reversed(items))


@router.post("/{conversation_id}/items", response_model=MessagePublic, status_code=201)
def send_message(conversation_id: int, body: MessageCreate, db: DbSession, current_user: VerifiedUser):
    _authorized(db, conversation_id, current_user.id, lock=True)
    message = ChatMessage(conversation_id=conversation_id, sender_id=current_user.id, body=body.body)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
