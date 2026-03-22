import json
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Ignify"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://ignify:ignify_dev_2024@localhost:5432/ignify"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    SECRET_KEY: str = "change-me-in-production-super-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AI
    AGNO_RUNTIME_URL: str = "http://localhost:8001"

    # Storage
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "ignify"
    MINIO_SECRET_KEY: str = "ignify_minio_2024"
    MINIO_BUCKET: str = "ignify-assets"

    # CORS - accepts JSON string or comma-separated
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:3010"]'

    # AI Providers
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    @property
    def cors_origins_list(self) -> list[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": True}


settings = Settings()
