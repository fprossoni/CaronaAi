import json

from pydantic import PositiveFloat, PositiveInt, field_validator
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
    DEV_ACCOUNTS_ENABLED: bool = False
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database
    # When running outside Docker (e.g. uvicorn locally), the DB is reachable
    # on localhost:5433 because docker-compose maps container 5432 → host 5433.
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5433/carona_ai"

    # OSRM
    OSRM_URL: str = "http://localhost:5000"
    OSRM_MAX_DETOUR_METERS: PositiveInt = 10000
    OSRM_MAX_DETOUR_SECONDS: PositiveInt = 7200
    OSRM_PREFILER_BUFFER_METERS: PositiveInt = 10000
    MATCH_MAX_PICKUP_DELAY_SECONDS: PositiveInt = 7200

    MATCH_TIME_TOLERANCE_SECONDS: PositiveInt = 7200
    MATCH_AGREED_TOLERANCE_SECONDS: PositiveInt = 300
    MATCH_TIME_WEIGHT: PositiveFloat = 0.45
    MATCH_DISTANCE_WEIGHT: PositiveFloat = 0.40
    MATCH_DURATION_WEIGHT: PositiveFloat = 0.15
    MATCH_TIME_SCALE_SECONDS: PositiveFloat = 600
    MATCH_DISTANCE_SCALE_METERS: PositiveFloat = 2000
    MATCH_DURATION_SCALE_SECONDS: PositiveFloat = 300

    # Matching — when a passenger's request is accepted, their other pending
    # requests (same batch / same origin+destination) whose ride departs within
    # ± this window are withdrawn so other drivers stop seeing them.
    MATCH_CONFLICT_WINDOW_MINUTES: int = 30

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

