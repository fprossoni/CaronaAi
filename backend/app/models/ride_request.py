import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class RideRequest(Base):
    __tablename__ = "ride_requests"

    id = Column(Integer, primary_key=True, index=True)
    ride_id = Column(Integer, ForeignKey("rides.id"), nullable=False)
    passenger_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Ponto de encontro: Substituído temporariamente por String para SQLite
    ponto_encontro_geom = Column(String, nullable=True)
    
    status = Column(String, default="pendente") # pendente, aprovada, recusada
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    ride = relationship("Ride", back_populates="requests")
    passenger = relationship("User", back_populates="ride_requests")
