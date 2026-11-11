from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.address import UserAddress


def get_owned_address(db: Session, address_id: int, user_id: int) -> UserAddress:
    address = db.get(UserAddress, address_id)
    if not address or address.user_id != user_id:
        raise HTTPException(status_code=404, detail="Endereço pessoal salvo não encontrado")
    return address
