import json
import logging
import os

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class ProductionConfigError(RuntimeError):
    """Raised when the backend is about to start in production with unsafe config.

    Fail-loud at startup is strictly better than fail-at-first-request. The
    alternative — booting with a dev-default SECRET_KEY and encrypting all
    subsequent tokens with a compromised key — is a silent disaster.
    """


# Values that must NOT be present in production. If SECRET_KEY, a DB URL, etc.
# matches one of these sentinels while DEBUG=false, we refuse to start.
_DEV_SENTINEL_VALUES: frozenset[str] = frozenset({
    "change-me-in-production-super-secret-key",
    "test-secret-key-for-unit-tests-do-not-use-in-prod-" + "x" * 16,
    "ignify_dev_2024",
})


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
    # OPENROUTER_MANAGER_KEY: the "provisioning" key that creates/manages sub-keys.
    #   Must be a key with "Manage keys" permission on your OpenRouter account.
    #   Used only by the provisioning API — never sent to tenants.
    # OPENROUTER_API_KEY: fallback key used when a tenant has no provisioned sub-key yet
    #   (e.g. legacy accounts, admin accounts without their own sub-key).
    OPENROUTER_MANAGER_KEY: str = ""
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

    # LinkedIn OAuth (Sign In with LinkedIn v2 + w_member_social for publishing)
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    LINKEDIN_REDIRECT_URI: str = "http://localhost:8000/api/v1/social-scheduler/oauth/linkedin/callback"

    # X (Twitter) — OAuth 2.0 w/ PKCE
    X_CLIENT_ID: str = ""
    X_CLIENT_SECRET: str = ""
    X_REDIRECT_URI: str = "http://localhost:8000/api/v1/social-scheduler/oauth/x/callback"

    # YouTube — Google OAuth (separate app from SEO integration to isolate scopes)
    YOUTUBE_CLIENT_ID: str = ""
    YOUTUBE_CLIENT_SECRET: str = ""
    YOUTUBE_REDIRECT_URI: str = "http://localhost:8000/api/v1/social-scheduler/oauth/youtube/callback"

    # TikTok — Content Posting API
    TIKTOK_CLIENT_KEY: str = ""
    TIKTOK_CLIENT_SECRET: str = ""
    TIKTOK_REDIRECT_URI: str = "http://localhost:8000/api/v1/social-scheduler/oauth/tiktok/callback"

    # Snapchat — Login Kit (OAuth only; no public posting API for Stories)
    SNAPCHAT_CLIENT_ID: str = ""
    SNAPCHAT_CLIENT_SECRET: str = ""
    SNAPCHAT_REDIRECT_URI: str = "http://localhost:8000/api/v1/social-scheduler/oauth/snapchat/callback"

    # Google OAuth (Search Console + Analytics 4)
    GOOGLE_OAUTH_CLIENT_ID: str = ""
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""
    GOOGLE_OAUTH_REDIRECT_URI: str = "http://localhost:8000/api/v1/seo/integrations/oauth/google/callback"
    GOOGLE_OAUTH_POST_REDIRECT: str = "http://localhost:3000/ar/seo/my-site"

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

    # Encryption — dedicated key for token-at-rest encryption, decoupled from
    # SECRET_KEY (which signs JWTs). Introduced in Phase 2 P2-2 so SECRET_KEY
    # can be rotated without decrypting/re-encrypting every OAuth token.
    # When empty, the Fernet key is derived from SECRET_KEY (Phase 1 behavior)
    # for backward compatibility.
    ENCRYPTION_KEY: str = ""

    # Minimum entropy floor for SECRET_KEY in production.
    # 32 ASCII chars ≈ 256 bits of entropy (if random).
    _SECRET_KEY_MIN_LENGTH: int = 32

    @property
    def cors_origins_list(self) -> list[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    def validate_production(self) -> list[str]:
        """Return a list of problems with the current config for production use.

        Empty list means the config is safe. Non-empty means we should refuse
        to boot (or at minimum log warnings). Called from `assert_safe_to_boot()`.
        """
        problems: list[str] = []

        # SECRET_KEY must be set, long enough, and not a dev sentinel.
        if not self.SECRET_KEY or self.SECRET_KEY in _DEV_SENTINEL_VALUES:
            problems.append(
                "SECRET_KEY is unset or matches a known dev/test sentinel — "
                "generate a 64-char random value"
            )
        elif len(self.SECRET_KEY) < self._SECRET_KEY_MIN_LENGTH:
            problems.append(
                f"SECRET_KEY is {len(self.SECRET_KEY)} chars — "
                f"must be at least {self._SECRET_KEY_MIN_LENGTH}"
            )

        # DATABASE_URL must be set and not point at a dev container name.
        if not self.DATABASE_URL:
            problems.append("DATABASE_URL is unset")
        elif "ignify_dev_2024" in self.DATABASE_URL:
            problems.append(
                "DATABASE_URL contains the dev password 'ignify_dev_2024' — "
                "rotate the DB password before production"
            )

        # Required runtime dependencies.
        if not self.REDIS_URL:
            problems.append("REDIS_URL is unset")
        if not self.OPENROUTER_API_KEY:
            problems.append("OPENROUTER_API_KEY is unset — all AI features will 500")
        if not self.CORS_ORIGINS or self.CORS_ORIGINS == "[]":
            problems.append("CORS_ORIGINS is empty — dashboard will be blocked")

        # If email verification is required, we must be able to send mail.
        if self.EMAIL_VERIFICATION_REQUIRED and not self.SMTP_HOST:
            problems.append(
                "EMAIL_VERIFICATION_REQUIRED=true but SMTP_HOST is unset — "
                "users cannot verify their email and will be locked out"
            )

        # Sentry is not strictly required, but in prod we warn (problem-level)
        # if it's missing — silent errors in prod are worse than a noisy startup.
        if not self.SENTRY_DSN:
            problems.append(
                "SENTRY_DSN is unset — production errors will be invisible"
            )

        return problems

    def assert_safe_to_boot(self) -> None:
        """Fail loudly at startup if the production config is unsafe.

        Skipped when DEBUG=true (dev mode). In production, any problem listed
        by `validate_production()` raises `ProductionConfigError`. The Sentry
        problem is only a warning since it degrades observability but doesn't
        create a security or availability risk.
        """
        if self.DEBUG:
            return
        problems = self.validate_production()
        if not problems:
            logger.info("production config validated — no problems found")
            return

        # Separate critical (boot-blocking) from warning-level.
        fatal = [p for p in problems if "SENTRY_DSN is unset" not in p]
        warnings = [p for p in problems if "SENTRY_DSN is unset" in p]
        for w in warnings:
            logger.warning("production config warning: %s", w)
        if fatal:
            formatted = "\n  - " + "\n  - ".join(fatal)
            raise ProductionConfigError(
                f"Refusing to boot in production with unsafe config:{formatted}\n\n"
                f"Set DEBUG=true to bypass this check for local testing."
            )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": True}


settings = Settings()

# Run validation at import time so any misconfigured deployment fails at
# container start, not at first request. In dev (DEBUG=true) this is a no-op.
# Skipped if IGNIFY_SKIP_PROD_CHECK=1 is set — reserved for ops tooling like
# alembic migrations that need to load config but don't run the server.
if not os.environ.get("IGNIFY_SKIP_PROD_CHECK"):
    settings.assert_safe_to_boot()
