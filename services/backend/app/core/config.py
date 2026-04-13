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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # LLM Gateway — OpenRouter is the single gateway for all models
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_SITE_URL: str = "https://ignify.ai"
    OPENROUTER_APP_NAME: str = "Ignify"

    # Media providers
    REPLICATE_API_TOKEN: str = ""
    ELEVENLABS_API_KEY: str = ""

    # Storage
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "ignify"
    MINIO_SECRET_KEY: str = "ignify_minio_2024"
    MINIO_BUCKET: str = "ignify-assets"
    MINIO_PUBLIC_HOST: str = "localhost:9000"

    # Email / Frontend
    FRONTEND_URL: str = "http://localhost:3000"
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "Ignify <no-reply@ignify.ai>"
    EMAIL_VERIFICATION_REQUIRED: bool = False

    # CORS - accepts JSON string or comma-separated
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:3010"]'

    # AI Providers
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Meta (Facebook/Instagram) OAuth
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_REDIRECT_URI: str = "http://localhost:8000/api/v1/social-scheduler/oauth/meta/callback"

    # Billing - Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""

    # Billing - Paymob (Egypt)
    PAYMOB_API_KEY: str = ""
    PAYMOB_INTEGRATION_ID: str = ""
    PAYMOB_IFRAME_ID: str = ""
    PAYMOB_HMAC_SECRET: str = ""

    # Billing - PayTabs (MENA)
    PAYTABS_PROFILE_ID: str = ""
    PAYTABS_SERVER_KEY: str = ""
    PAYTABS_REGION: str = "EGY"  # EGY, SAU, ARE, JOR, OMN, GLOBAL
    PAYTABS_BASE_URL: str = "https://secure-egypt.paytabs.com"  # region-dependent

    # Billing - Geidea (MENA Pay by Link)
    GEIDEA_PUBLIC_KEY: str = ""
    GEIDEA_API_PASSWORD: str = ""
    GEIDEA_MERCHANT_ID: str = ""
    GEIDEA_BASE_URL: str = "https://api.merchant.geidea.net"

    # Billing - URLs
    BILLING_SUCCESS_URL: str = "http://localhost:3000/billing/success"
    BILLING_CANCEL_URL: str = "http://localhost:3000/billing/cancel"
    BILLING_CALLBACK_BASE: str = "http://localhost:8000"

    # Observability
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    LOG_LEVEL: str = "INFO"

    # Webhooks
    META_WEBHOOK_VERIFY_TOKEN: str = "ignify-webhook-verify-token-change-me"

    # SEO / SERP providers (all optional — stub mode when none configured)
    SERPER_API_KEY: str = ""
    DATAFORSEO_LOGIN: str = ""
    DATAFORSEO_PASSWORD: str = ""
    GOOGLE_CSE_ID: str = ""
    GOOGLE_CSE_API_KEY: str = ""

    # Agno runtime (used by existing seo/competitor AI endpoints)
    AGNO_RUNTIME_URL: str = "http://localhost:8010"

    @property
    def cors_origins_list(self) -> list[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": True}


settings = Settings()
