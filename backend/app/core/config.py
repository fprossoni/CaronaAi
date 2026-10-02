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
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/carona_ai"

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

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
