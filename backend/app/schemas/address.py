"""Pydantic schemas for user personal addresses and geocoding."""

from datetime import datetime

from pydantic import BaseModel, field_validator


class AddressBase(BaseModel):
    label: str = "Casa"
    street: str
    number: str
    complement: str | None = None
    neighborhood: str | None = None
    postal_code: str
    city: str = "Porto Alegre"
    state: str = "RS"
    country: str = "Brasil"

    @field_validator("postal_code")
    @classmethod
    def format_postal_code(cls, v: str) -> str:
        clean = "".join(filter(str.isdigit, v))
        if len(clean) == 8:
            return f"{clean[:5]}-{clean[5:]}"
        return v.strip()


class AddressCreate(AddressBase):
    pass


class AddressPublic(AddressBase):
    id: int
    user_id: int
    lat: float
    lng: float
    created_at: datetime
    full_address: str | None = None

    model_config = {"from_attributes": True}


class CepLookupResponse(BaseModel):
    postal_code: str
    street: str
    neighborhood: str
    city: str
    state: str
    country: str


class GeocodeRequest(BaseModel):
    street: str
    number: str
    postal_code: str | None = None
    city: str = "Porto Alegre"
    state: str = "RS"
    country: str = "Brasil"


class GeocodeResponse(BaseModel):
    lat: float
    lng: float
    neighborhood: str | None = None
    display_name: str
