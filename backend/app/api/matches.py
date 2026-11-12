"""Matches router — /matches/*

Multi-matching flow:
  1. Passenger searches and sends a "matching" to as many rides as they want
     (POST /matches/batch). All requests share a batch_id.
  2. Each driver sees the passenger's public profile and accepts/rejects.
  3. On the first acceptance the passenger's related pending requests are
     withdrawn (SUPERSEDED) and disappear from the other drivers' lists.
"""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from sqlalchemy import select

from app.api.deps import DbSession, VerifiedUser
from app.core.campuses import CAMPUS_COORDS, CAMPUS_REQUIRED_MESSAGE, campus_at, campus_label
from app.core.config import settings
from app.models.match import Match, MatchStatus
from app.models.ride import Ride, RideStatus
from app.models.user import User
from app.schemas.match import (
    MatchActionRequest,
    MatchBatchRequest,
    MatchBatchResult,
    MatchBatchSkipped,
    MatchConfirmed,
    MatchForDriver,
    MatchPublic,
    MatchRequest,
    MatchWithRide,
)
from app.schemas.ride import RidePublic
from app.services.addresses import get_owned_address
from app.services.geocoding import geocode_address
from app.services.match_rules import (
    find_confirmed_conflict,
    request_rejection_reason,
    supersede_related_requests,
)
from app.services.matching import (
    IncompatibleCampusError, calculate_ride_candidate, confirmed_matches, remove_cancelled_stop, save_route_plan,
)
from app.services.osrm import InvalidRouteError

router = APIRouter(prefix="/matches", tags=["matches"])


def _point_wkt(lat: float, lng: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


def _unconfirmed_for_driver(match: Match) -> MatchConfirmed:
    result = MatchPublic.model_validate(match)
    result.pickup_label = match.pickup_region
    result.dropoff_label = None
    return MatchConfirmed(**result.model_dump())


async def _resolve_pickup_address(
    db: DbSession,
    passenger_id: int,
    body: MatchRequest | MatchBatchRequest,
) -> tuple[float, float, str, str, str | None, str | None, str | None, str | None, str | None, str | None]:
    """Resolves coordinates and address details.

    Returns:
        (lat, lng, pickup_label, pickup_region, street, number, complement, postal_code, neighborhood, city)
    """
    if body.pickup_campus_id is not None:
        lat, lng = CAMPUS_COORDS[body.pickup_campus_id]
        label = campus_label(body.pickup_campus_id)
        return lat, lng, label, label, None, None, None, None, None, None
    if body.pickup_address_id is not None:
        addr = get_owned_address(db, body.pickup_address_id, passenger_id)
        return (
            addr.lat,
            addr.lng,
            body.pickup_label or addr.full_address,
            body.pickup_region or addr.neighborhood or addr.city,
            addr.street,
            addr.number,
            addr.complement,
            addr.postal_code,
            addr.neighborhood,
            addr.city,
        )
    elif body.custom_address is not None:
        try:
            lat, lng, neighborhood, _ = await geocode_address(
                street=body.custom_address.street,
                number=body.custom_address.number,
                city=body.custom_address.city,
                state=body.custom_address.state,
                country=body.custom_address.country,
                postal_code=body.custom_address.postal_code,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        region = neighborhood or body.custom_address.neighborhood or body.custom_address.city
        label = f"{body.custom_address.street}, {body.custom_address.number}"
        return (
            lat,
            lng,
            body.pickup_label or label,
            body.pickup_region or region,
            body.custom_address.street,
            body.custom_address.number,
            body.custom_address.complement,
            body.custom_address.postal_code,
            neighborhood or body.custom_address.neighborhood,
            body.custom_address.city,
        )
    elif body.pickup_lat is not None and body.pickup_lng is not None:
        return (
            body.pickup_lat,
            body.pickup_lng,
            body.pickup_label or "Ponto de origem",
            body.pickup_region or "Região próxima",
            None,
            None,
            None,
            None,
            None,
            None,
        )
    else:
        raise HTTPException(status_code=400, detail="Informe um endereço salvo ou endereço físico para a origem")


async def _build_match(
    db: DbSession,
    ride: Ride,
    passenger_id: int,
    body: MatchRequest | MatchBatchRequest,
    batch_id: str | None,
) -> Match:
    (
        pickup_lat,
        pickup_lng,
        pickup_label,
        pickup_region,
        street,
        number,
        complement,
        postal_code,
        neighborhood,
        city,
    ) = await _resolve_pickup_address(db, passenger_id, body)

    dropoff_lat, dropoff_lng, dropoff_label = body.dropoff_lat, body.dropoff_lng, body.dropoff_label
    if body.dropoff_campus_id is not None:
        dropoff_lat, dropoff_lng = CAMPUS_COORDS[body.dropoff_campus_id]
        dropoff_label = campus_label(body.dropoff_campus_id)
    elif body.dropoff_address_id is not None:
        address = get_owned_address(db, body.dropoff_address_id, passenger_id)
        dropoff_lat, dropoff_lng, dropoff_label = address.lat, address.lng, body.dropoff_label or address.full_address
    if dropoff_lat is None or dropoff_lng is None:
        raise HTTPException(status_code=400, detail="Informe as coordenadas completas do destino.")
    if not (campus_at((pickup_lat, pickup_lng)) or campus_at((dropoff_lat, dropoff_lng))):
        raise HTTPException(status_code=400, detail=CAMPUS_REQUIRED_MESSAGE)
    try:
        candidate = await calculate_ride_candidate(
            ride, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, confirmed=confirmed_matches(db, ride),
        )
    except InvalidRouteError as exc:
        raise HTTPException(status_code=400, detail="Não foi possível calcular a rota até o ponto de origem.") from exc
    except IncompatibleCampusError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    reason = candidate.rejection_reason(body.pickup_after, body.pickup_before)
    if reason:
        raise HTTPException(status_code=400, detail=reason)
    return Match(
        ride_id=ride.id,
        passenger_id=passenger_id,
        batch_id=batch_id,
        pickup_point=_point_wkt(pickup_lat, pickup_lng),
        dropoff_point=_point_wkt(dropoff_lat, dropoff_lng),
        pickup_label=pickup_label,
        dropoff_label=dropoff_label,
        pickup_region=pickup_region,
        pickup_street=street,
        pickup_number=number,
        pickup_complement=complement,
        pickup_postal_code=postal_code,
        pickup_neighborhood=neighborhood,
        pickup_city=city,
        detour_meters=candidate.detour_meters,
        detour_seconds=candidate.detour_seconds,
        pickup_after=body.pickup_after,
        pickup_before=body.pickup_before,
    )


@router.post("/", response_model=MatchPublic, status_code=status.HTTP_201_CREATED)
async def request_match(
    body: MatchRequest,
    current_user: VerifiedUser,
    db: DbSession,
) -> Match:
    """Passenger requests a match with a single driver's ride."""
    ride = db.get(Ride, body.ride_id)
    reason = request_rejection_reason(db, ride, current_user)
    if reason:
        code = 404 if ride is None else 400
        raise HTTPException(status_code=code, detail=reason)

    match = await _build_match(db, ride, current_user.id, body, batch_id=None)
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


@router.post("/batch", response_model=MatchBatchResult, status_code=status.HTTP_201_CREATED)
async def request_match_batch(
    body: MatchBatchRequest,
    current_user: VerifiedUser,
    db: DbSession,
) -> MatchBatchResult:
    """Passenger sends a "matching" to several rides at once.

    Rides that can't be requested are reported in `skipped` instead of failing
    the whole batch.
    """
    batch_id = str(uuid.uuid4())
    created: list[Match] = []
    skipped: list[MatchBatchSkipped] = []

    for ride_id in dict.fromkeys(body.ride_ids):  # dedupe, keep order
        ride = db.get(Ride, ride_id)
        reason = request_rejection_reason(db, ride, current_user)
        if reason:
            skipped.append(MatchBatchSkipped(ride_id=ride_id, reason=reason))
            continue
        try:
            match = await _build_match(db, ride, current_user.id, body, batch_id=batch_id)
        except HTTPException as exc:
            skipped.append(MatchBatchSkipped(ride_id=ride_id, reason=str(exc.detail)))
            continue
        except Exception:
            skipped.append(MatchBatchSkipped(ride_id=ride_id, reason="Erro ao calcular a rota"))
            continue
        db.add(match)
        created.append(match)

    if not created:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=skipped[0].reason if len(skipped) == 1 else "Nenhuma das caronas selecionadas pôde ser solicitada",
        )

    db.commit()
    for m in created:
        db.refresh(m)

    return MatchBatchResult(
        batch_id=batch_id,
        created=[MatchPublic.model_validate(m) for m in created],
        skipped=skipped,
    )


@router.get("/my", response_model=list[MatchWithRide])
def get_my_matches(current_user: VerifiedUser, db: DbSession) -> list[MatchWithRide]:
    """Get all matches for the current passenger, with ride summary."""
    matches = db.execute(
        select(Match)
        .where(Match.passenger_id == current_user.id)
        .order_by(Match.created_at.desc())
    ).scalars().all()

    results: list[MatchWithRide] = []
    for match in matches:
        result = MatchWithRide.model_validate(match)
        result.ride = RidePublic.model_validate(match.ride)
        results.append(result)
    return results


@router.get("/ride/{ride_id}", response_model=list[MatchForDriver])
def get_ride_matches(ride_id: int, current_user: VerifiedUser, db: DbSession) -> list[MatchForDriver]:
    """Driver views match requests (pending) and confirmed passengers (accepted) for their ride.

    Pending requests come ordered by smallest detour first. Requests withdrawn
    because the passenger was confirmed elsewhere (SUPERSEDED) are not listed.
    Detailed address fields are only populated for ACCEPTED matches.
    """
    ride = db.get(Ride, ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ride")

    matches = db.execute(
        select(Match)
        .where(Match.ride_id == ride_id)
        .where(Match.status.in_([MatchStatus.PENDING, MatchStatus.ACCEPTED]))
        .order_by(Match.detour_meters.asc(), Match.created_at.asc())
    ).scalars().all()

    results: list[MatchForDriver] = []
    for m in matches:
        driver_view = MatchForDriver.model_validate(m)
        if m.status == MatchStatus.ACCEPTED:
            driver_view.pickup_street = m.pickup_street
            driver_view.pickup_number = m.pickup_number
            driver_view.pickup_complement = m.pickup_complement
            driver_view.pickup_postal_code = m.pickup_postal_code
            driver_view.pickup_neighborhood = m.pickup_neighborhood
            driver_view.pickup_city = m.pickup_city
            driver_view.passenger_phone = m.passenger.phone if m.passenger else None
        else:
            driver_view.pickup_street = None
            driver_view.pickup_number = None
            driver_view.pickup_complement = None
            driver_view.pickup_postal_code = None
            driver_view.pickup_neighborhood = None
            driver_view.pickup_city = None
            driver_view.passenger_phone = None
        results.append(driver_view)

    return results


@router.patch("/{match_id}/respond", response_model=MatchConfirmed)
async def respond_to_match(
    match_id: int,
    body: MatchActionRequest,
    current_user: VerifiedUser,
    db: DbSession,
) -> MatchConfirmed:
    """Driver accepts or rejects a match request."""
    if body.action not in ("accept", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'accept' or 'reject'")

    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Lock the ride row so concurrent accepts can't oversell seats
    ride = db.get(Ride, match.ride_id, with_for_update=True)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
    if ride.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ride")

    if match.status == MatchStatus.SUPERSEDED:
        raise HTTPException(status_code=409, detail="Este passageiro já confirmou outra carona")
    if match.status != MatchStatus.PENDING:
        raise HTTPException(status_code=400, detail="Match is no longer pending")

    match.responded_at = datetime.now(UTC)

    if body.action == "accept":
        if ride.status not in (RideStatus.ACTIVE, RideStatus.FULL):
            raise HTTPException(409, "Esta carona não aceita mais confirmações")
        if ride.available_seats <= 0:
            raise HTTPException(status_code=400, detail="No seats available")

        # Lock the passenger row: serialises simultaneous accepts from
        # different drivers for the same passenger.
        db.get(User, match.passenger_id, with_for_update=True)
        db.refresh(match)
        if match.status != MatchStatus.PENDING:
            db.rollback()
            raise HTTPException(status_code=409, detail="Este passageiro já confirmou outra carona")

        if match.dropoff_point is None or ride.origin_point is None or ride.destination_point is None:
            raise HTTPException(409, "Peça ao passageiro que envie uma nova solicitação com origem e destino.")
        pickup_shape = to_shape(match.pickup_point)
        dropoff_shape = to_shape(match.dropoff_point)
        if find_confirmed_conflict(db, match.passenger_id, ride.departure_at, exclude_match_id=match.id):
            # Passenger already has a confirmed ride at a similar time
            match.status = MatchStatus.SUPERSEDED
            match.responded_at = datetime.now(UTC)
            db.commit()
            raise HTTPException(status_code=409, detail="Este passageiro já confirmou outra carona em horário próximo")

        confirmed = confirmed_matches(db, ride)
        try:
            candidate = await calculate_ride_candidate(
                ride, pickup_shape.y, pickup_shape.x, dropoff_shape.y, dropoff_shape.x,
                confirmed=confirmed, with_geometry=True,
            )
        except IncompatibleCampusError as exc:
            raise HTTPException(409, str(exc)) from exc
        except InvalidRouteError as exc:
            raise HTTPException(409, "Não foi possível incluir essa parada na rota da carona.") from exc
        plan = candidate.plan
        assert plan is not None
        if len(plan.points) > 2 and plan.route.geometry is None:
            raise HTTPException(503, "O serviço de rotas está indisponível. Tente confirmar a carona novamente.")
        reason = candidate.rejection_reason(
            match.pickup_after or ride.departure_at,
            match.pickup_before or ride.departure_at + timedelta(seconds=settings.MATCH_MAX_PICKUP_DELAY_SECONDS),
        )
        if reason:
            raise HTTPException(409, reason)
        for passenger_match in confirmed:
            if passenger_match.pickup_after is None or passenger_match.pickup_before is None:
                continue
            point = to_shape(passenger_match.pickup_point)
            arrival = plan.arrival(ride, (point.y, point.x))
            if not passenger_match.pickup_after <= arrival <= passenger_match.pickup_before:
                raise HTTPException(409, "A nova parada alteraria o horário combinado com outro passageiro.")

        save_route_plan(ride, plan)
        match.detour_meters = candidate.detour_meters
        match.detour_seconds = candidate.detour_seconds
        match.status = MatchStatus.ACCEPTED
        match.responded_at = datetime.now(UTC)
        ride.available_seats -= 1
        if ride.available_seats == 0:
            ride.status = RideStatus.FULL

        # Complete match → withdraw the passenger's related requests so the
        # other drivers stop seeing them.
        supersede_related_requests(db, match)

        db.commit()
        db.refresh(match)

        # Build MatchConfirmed with full info revealed
        passenger = match.passenger

        return MatchConfirmed(
            id=match.id,
            ride_id=match.ride_id,
            status=match.status,
            detour_meters=match.detour_meters,
            detour_seconds=match.detour_seconds,
            pickup_label=match.pickup_label,
            dropoff_label=match.dropoff_label,
            pickup_region=match.pickup_region,
            created_at=match.created_at,
            responded_at=match.responded_at,
            # Full info revealed after acceptance
            driver_phone=current_user.phone,
            pickup_lat=pickup_shape.y,
            pickup_lng=pickup_shape.x,
            dropoff_lat=dropoff_shape.y,
            dropoff_lng=dropoff_shape.x,
            passenger_phone=passenger.phone,
            pickup_street=match.pickup_street,
            pickup_number=match.pickup_number,
            pickup_complement=match.pickup_complement,
            pickup_postal_code=match.pickup_postal_code,
            pickup_neighborhood=match.pickup_neighborhood,
            pickup_city=match.pickup_city,
        )

    else:  # reject
        match.status = MatchStatus.REJECTED
        db.commit()
        db.refresh(match)
        return _unconfirmed_for_driver(match)


@router.patch("/{match_id}/cancel")
async def cancel_match(match_id: int, current_user: VerifiedUser, db: DbSession) -> dict:
    """Passenger cancels their own pending or accepted match."""
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.passenger_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your match")
    ride = db.get(Ride, match.ride_id, with_for_update=True)
    db.refresh(match)
    if not ride or ride.status not in (RideStatus.ACTIVE, RideStatus.FULL, RideStatus.IN_PROGRESS):
        raise HTTPException(409, "Esta carona já foi encerrada")
    if match.status not in (MatchStatus.PENDING, MatchStatus.ACCEPTED):
        raise HTTPException(status_code=400, detail="Cannot cancel this match")

    if match.status == MatchStatus.ACCEPTED:
        remaining = [item for item in confirmed_matches(db, ride) if item.id != match.id]
        await remove_cancelled_stop(ride, remaining)
        ride.available_seats += 1
        if ride.status == RideStatus.FULL:
            ride.status = RideStatus.ACTIVE

    match.status = MatchStatus.CANCELLED
    db.commit()
    return {"message": "Match cancelled"}


@router.get("/{match_id}", response_model=MatchConfirmed)
def get_match(match_id: int, current_user: VerifiedUser, db: DbSession) -> MatchConfirmed:
    """Get match details. Full info only returned if ACCEPTED."""
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    ride = db.get(Ride, match.ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
    is_driver = ride.driver_id == current_user.id
    is_passenger = match.passenger_id == current_user.id

    if not (is_driver or is_passenger):
        raise HTTPException(status_code=403, detail="Access denied")

    if is_driver and match.status != MatchStatus.ACCEPTED:
        return _unconfirmed_for_driver(match)

    result = MatchConfirmed.model_validate(match)

    # Only reveal exact location if match is accepted
    if match.status == MatchStatus.ACCEPTED:
        pickup_shape = to_shape(match.pickup_point)
        result.pickup_lat = pickup_shape.y
        result.pickup_lng = pickup_shape.x
        if match.dropoff_point is not None:
            dropoff_shape = to_shape(match.dropoff_point)
            result.dropoff_lat = dropoff_shape.y
            result.dropoff_lng = dropoff_shape.x
        result.passenger_phone = match.passenger.phone
        result.driver_phone = ride.driver.phone
        result.pickup_street = match.pickup_street
        result.pickup_number = match.pickup_number
        result.pickup_complement = match.pickup_complement
        result.pickup_postal_code = match.pickup_postal_code
        result.pickup_neighborhood = match.pickup_neighborhood
        result.pickup_city = match.pickup_city

    return result
