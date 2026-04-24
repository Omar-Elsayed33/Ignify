"""P2-1: Production config validation.

Verifies `settings.validate_production()` catches the most common unsafe
deployment states, and `assert_safe_to_boot()` refuses to start the app.

DEBUG=true bypasses all checks (dev workflow).
"""
from __future__ import annotations

import pytest

from app.core.config import ProductionConfigError, Settings


pytestmark = pytest.mark.unit


def _make_settings(**overrides) -> Settings:
    """Build a Settings instance from explicit kwargs, bypassing .env."""
    defaults = dict(
        DEBUG=False,
        SECRET_KEY="a" * 64,  # safe placeholder
        DATABASE_URL="postgresql+asyncpg://user:secure_pw@db.prod.internal/ignify",
        REDIS_URL="redis://redis.prod.internal:6379/0",
        OPENROUTER_API_KEY="sk-or-live-abc",
        CORS_ORIGINS='["https://app.ignify.ai"]',
        SENTRY_DSN="https://abc@o.sentry.io/1",
    )
    defaults.update(overrides)
    return Settings(**defaults)


class TestValidateProduction:
    def test_safe_config_reports_no_problems(self):
        s = _make_settings()
        assert s.validate_production() == []

    def test_dev_sentinel_secret_key_rejected(self):
        s = _make_settings(SECRET_KEY="change-me-in-production-super-secret-key")
        problems = s.validate_production()
        assert any("SECRET_KEY" in p for p in problems)

    def test_empty_secret_key_rejected(self):
        s = _make_settings(SECRET_KEY="")
        problems = s.validate_production()
        assert any("SECRET_KEY" in p for p in problems)

    def test_short_secret_key_rejected(self):
        s = _make_settings(SECRET_KEY="too-short")
        problems = s.validate_production()
        assert any("SECRET_KEY" in p and "least" in p for p in problems)

    def test_dev_db_password_rejected(self):
        s = _make_settings(
            DATABASE_URL="postgresql+asyncpg://ignify:ignify_dev_2024@db/ignify"
        )
        problems = s.validate_production()
        assert any("DATABASE_URL" in p and "ignify_dev_2024" in p for p in problems)

    def test_missing_openrouter_rejected(self):
        s = _make_settings(OPENROUTER_API_KEY="")
        assert any("OPENROUTER_API_KEY" in p for p in s.validate_production())

    def test_empty_cors_rejected(self):
        s = _make_settings(CORS_ORIGINS="[]")
        assert any("CORS_ORIGINS" in p for p in s.validate_production())

    def test_email_verification_without_smtp_rejected(self):
        s = _make_settings(EMAIL_VERIFICATION_REQUIRED=True, SMTP_HOST="")
        problems = s.validate_production()
        assert any("EMAIL_VERIFICATION_REQUIRED" in p for p in problems)

    def test_missing_sentry_warns_but_permits_boot(self):
        s = _make_settings(SENTRY_DSN="")
        problems = s.validate_production()
        assert any("SENTRY_DSN" in p for p in problems)
        # Verify boot is still allowed even though Sentry is missing.
        # (assert_safe_to_boot treats SENTRY_DSN as a warning, not fatal.)
        s.assert_safe_to_boot()


class TestAssertSafeToBoot:
    def test_debug_mode_bypasses_all_checks(self):
        s = _make_settings(
            DEBUG=True,
            SECRET_KEY="change-me-in-production-super-secret-key",
            DATABASE_URL="",  # would otherwise be fatal
            OPENROUTER_API_KEY="",
        )
        # Should NOT raise, even with multiple problems.
        s.assert_safe_to_boot()

    def test_fatal_problem_raises_production_config_error(self):
        s = _make_settings(SECRET_KEY="change-me-in-production-super-secret-key")
        with pytest.raises(ProductionConfigError) as exc_info:
            s.assert_safe_to_boot()
        assert "SECRET_KEY" in str(exc_info.value)

    def test_only_sentry_missing_does_not_raise(self):
        s = _make_settings(SENTRY_DSN="")
        # Sentry alone is a warning, not a blocker — must not raise.
        s.assert_safe_to_boot()

    def test_multiple_problems_all_reported(self):
        s = _make_settings(
            SECRET_KEY="",
            OPENROUTER_API_KEY="",
            CORS_ORIGINS="[]",
        )
        with pytest.raises(ProductionConfigError) as exc_info:
            s.assert_safe_to_boot()
        msg = str(exc_info.value)
        # All three listed in the error — ops gets full picture in one shot.
        assert "SECRET_KEY" in msg
        assert "OPENROUTER_API_KEY" in msg
        assert "CORS_ORIGINS" in msg
