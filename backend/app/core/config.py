import json

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    APP_NAME: str = "Carona Aí"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database
    # When running outside Docker (e.g. uvicorn locally), the DB is reachable
    # on localhost:5433 because docker-compose maps container 5432 → host 5433.
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5433/carona_ai"

    # OSRM
    OSRM_URL: str = "http://localhost:5000"
    OSRM_MAX_DETOUR_METERS: int = 3000   # 3 km
    OSRM_MAX_DETOUR_SECONDS: int = 900   # 15 min
    OSRM_PREFILER_BUFFER_METERS: int = 5000  # 5 km buffer for PostGIS pre-filter

    # Email (SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@caronaai.com"
    EMAIL_TOKEN_EXPIRE_MINUTES: int = 15

    # CORS — accepts either JSON array or comma-separated string:
    #   ["http://localhost:5173","http://localhost:3000"]  ← JSON (default)
    #   http://localhost:5173,http://localhost:3000        ← comma-separated
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: object) -> list[str]:
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                return json.loads(v)
            # comma-separated: "http://localhost:5173,http://localhost:3000"
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v  # let pydantic surface the error


settings = Settings()

