from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RideRequestBase(BaseModel):
    ride_id: int

class RideRequestCreate(RideRequestBase):
    pass

class RideRequestResponse(RideRequestBase):
    id: int
    passenger_id: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
