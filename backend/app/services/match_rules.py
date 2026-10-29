"""Business rules for multi-request matching.

A passenger can send a "matching" to many rides at once (a *batch*). Several
drivers may therefore be looking at the same passenger simultaneously. As soon
as one driver accepts (a *complete match*), the passenger's related pending
requests are withdrawn (status SUPERSEDED) so the other drivers stop seeing
them.

Related = same batch OR same pickup/dropoff labels, AND the ride departs within
± settings.MATCH_CONFLICT_WINDOW_MINUTES of the confirmed ride.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from geoalchemy2.shape import to_shape
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.match import Match, MatchStatus
from app.models.rating import Block
from app.models.ride import Ride, RideStatus
from app.models.user import Gender, User
from app.services.osrm import get_route

ACTIVE_MATCH_STATUSES = (MatchStatus.PENDING, MatchStatus.ACCEPTED)
LIVE_RIDE_STATUSES = (RideStatus.ACTIVE, RideStatus.FULL, RideStatus.IN_PROGRESS)


def conflict_window() -> timedelta:
    return timedelta(minutes=settings.MATCH_CONFLICT_WINDOW_MINUTES)


def _departure_window_clause(departure_at: datetime):
    window = conflict_window()
    return and_(
        Ride.departure_at >= departure_at - window,
        Ride.departure_at <= departure_at + window,
    )


def find_confirmed_conflict(
    db: Session,
    passenger_id: int,
    departure_at: datetime,
    exclude_match_id: int | None = None,
) -> Match | None:
    """An ACCEPTED match of the passenger whose ride departs close to `departure_at`."""
    query = (
        select(Match)
        .join(Ride, Ride.id == Match.ride_id)
        .where(Match.passenger_id == passenger_id)
        .where(Match.status == MatchStatus.ACCEPTED)
        .where(Ride.status.in_(LIVE_RIDE_STATUSES))
        .where(_departure_window_clause(departure_at))
    )
    if exclude_match_id is not None:
        query = query.where(Match.id != exclude_match_id)
    return db.execute(query.limit(1)).scalar_one_or_none()


def supersede_related_requests(db: Session, accepted: Match) -> list[Match]:
    """Withdraw the passenger's other pending requests related to `accepted`.

    Does not commit — caller owns the transaction.
    """
    related = [
        and_(
            Match.pickup_label == accepted.pickup_label,
            Match.dropoff_label.is_(None) if accepted.dropoff_label is None
            else Match.dropoff_label == accepted.dropoff_label,
        )
    ]
    if accepted.batch_id:
        related.append(Match.batch_id == accepted.batch_id)

    pending = db.execute(
        select(Match)
        .join(Ride, Ride.id == Match.ride_id)
        .where(Match.passenger_id == accepted.passenger_id)
        .where(Match.id != accepted.id)
        .where(Match.status == MatchStatus.PENDING)
        .where(_departure_window_clause(accepted.ride.departure_at))
        .where(or_(*related))
    ).scalars().all()

    now = datetime.now(UTC)
    for m in pending:
        m.status = MatchStatus.SUPERSEDED
        m.responded_at = now
    return list(pending)


def is_blocked_between(db: Session, user_a: int, user_b: int) -> bool:
    return db.execute(
        select(Block.id).where(
            or_(
                and_(Block.blocker_id == user_a, Block.blocked_id == user_b),
                and_(Block.blocker_id == user_b, Block.blocked_id == user_a),
            )
        ).limit(1)
    ).first() is not None


def request_rejection_reason(db: Session, ride: Ride | None, passenger: User) -> str | None:
    """Why `passenger` cannot request `ride` right now (None = allowed)."""
    if ride is None:
        return "Carona não encontrada"
    if ride.driver_id == passenger.id:
        return "Você não pode pedir a sua própria carona"
    if ride.status != RideStatus.ACTIVE:
        return "Carona não está mais aceitando passageiros"
    if ride.available_seats <= 0:
        return "Sem vagas disponíveis"
    if ride.departure_at <= datetime.now(UTC):
        return "Carona já partiu"
    if ride.women_only and passenger.gender != Gender.FEMALE:
        return "Carona exclusiva para mulheres"
    if is_blocked_between(db, ride.driver_id, passenger.id):
        return "Carona indisponível"

    existing = db.execute(
        select(Match.id)
        .where(Match.ride_id == ride.id)
        .where(Match.passenger_id == passenger.id)
        .where(Match.status.in_(ACTIVE_MATCH_STATUSES))
        .limit(1)
    ).first()
    if existing:
        return "Você já tem uma solicitação ativa para esta carona"

    if find_confirmed_conflict(db, passenger.id, ride.departure_at):
        return "Você já tem uma carona confirmada em horário próximo"
    return None


async def compute_detour(
    ride: Ride,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float | None,
    dropoff_lng: float | None,
) -> tuple[float, float]:
    """(detour_meters, detour_seconds) added to the driver's route by this passenger."""
    origin = to_shape(ride.origin_point)
    dest = to_shape(ride.destination_point)
    waypoints = [(origin.y, origin.x), (pickup_lat, pickup_lng)]
    if dropoff_lat is not None and dropoff_lng is not None:
        waypoints.append((dropoff_lat, dropoff_lng))
    waypoints.append((dest.y, dest.x))

    route = await get_route(waypoints)
    return (
        max(0.0, route.distance_meters - ride.route_distance_meters),
        max(0.0, route.duration_seconds - ride.route_duration_seconds),
    )
