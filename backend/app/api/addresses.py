"""Addresses router — /addresses/*"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, VerifiedUser
from app.models.address import UserAddress
from app.schemas.address import (
    AddressCreate,
    AddressPublic,
    CepLookupResponse,
    GeocodeRequest,
    GeocodeResponse,
)
from app.services.geocoding import geocode_address, lookup_cep

router = APIRouter(prefix="/addresses", tags=["addresses"])


@router.get("/cep/{cep}", response_model=CepLookupResponse)
async def get_cep_info(cep: str, current_user: VerifiedUser) -> CepLookupResponse:
    """Lookup street and neighborhood by Brazilian postal code (ViaCEP)."""
    data = await lookup_cep(cep)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CEP não encontrado ou inválido",
        )
    return CepLookupResponse(**data)


@router.post("/geocode", response_model=GeocodeResponse)
async def geocode_single_address(
    body: GeocodeRequest,
    current_user: VerifiedUser,
) -> GeocodeResponse:
    """Geocode physical address to coordinates via Nominatim."""
    try:
        lat, lng, neighborhood, display_name = await geocode_address(
            street=body.street,
            number=body.number,
            city=body.city,
            state=body.state,
            country=body.country,
            postal_code=body.postal_code,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return GeocodeResponse(
        lat=lat,
        lng=lng,
        neighborhood=neighborhood,
        display_name=display_name,
    )


@router.get("/", response_model=list[AddressPublic])
def list_my_addresses(current_user: VerifiedUser, db: DbSession) -> list[UserAddress]:
    """List saved personal addresses of the authenticated user."""
    addresses = db.execute(
        select(UserAddress)
        .where(UserAddress.user_id == current_user.id)
        .order_by(UserAddress.created_at.asc())
    ).scalars().all()
    return list(addresses)


@router.post("/", response_model=AddressPublic, status_code=status.HTTP_201_CREATED)
async def create_address(
    body: AddressCreate,
    current_user: VerifiedUser,
    db: DbSession,
) -> UserAddress:
    """Save a personal address for the user, computing coordinates via Nominatim."""
    try:
        lat, lng, neighborhood, _ = await geocode_address(
            street=body.street,
            number=body.number,
            city=body.city,
            state=body.state,
            country=body.country,
            postal_code=body.postal_code,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    addr = UserAddress(
        user_id=current_user.id,
        label=body.label,
        street=body.street,
        number=body.number,
        complement=body.complement,
        neighborhood=body.neighborhood or neighborhood,
        postal_code=body.postal_code,
        city=body.city,
        state=body.state,
        country=body.country,
        lat=lat,
        lng=lng,
    )
    db.add(addr)
    db.commit()
    db.refresh(addr)
    return addr


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: int,
    current_user: VerifiedUser,
    db: DbSession,
) -> None:
    """Delete a saved personal address."""
    addr = db.get(UserAddress, address_id)
    if not addr or addr.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endereço não encontrado")
    db.delete(addr)
    db.commit()
