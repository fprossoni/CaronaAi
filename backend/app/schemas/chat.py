from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, PositiveInt, StringConstraints


class ConversationCreate(BaseModel):
    ride_id: PositiveInt
    # Omitted = group; private chats always identify the passenger, not the driver.
    passenger_id: PositiveInt | None = None


class ChatParticipant(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str | None


class ConversationPublic(BaseModel):
    id: int
    ride_id: int
    kind: Literal["group", "private"]
    driver_id: int
    passenger_id: int | None
    origin_label: str
    destination_label: str
    departure_at: datetime
    participants: list[ChatParticipant]


class MessageCreate(BaseModel):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class MessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    conversation_id: int
    sender_id: int
    sender: ChatParticipant
    body: str
    created_at: datetime
