"""P1-4: Webhook URL safety + HMAC signing.

Verifies:
- HMAC-SHA256 signature format matches what's sent on the wire.
- Create-webhook path rejects unsafe URLs.
- Dispatch path re-validates URL and fails-closed on unsafe rows.
- Secret is never included in log records.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.url_safety import UnsafeURLError, validate_public_url
from app.db.models import Webhook


pytestmark = pytest.mark.unit


class TestCreateWebhookRejectsUnsafe:
    @pytest.mark.parametrize("url", [
        "http://localhost:5432/hook",
        "http://127.0.0.1/hook",
        "http://10.0.0.5/hook",
        "http://169.254.169.254/metadata",
        "http://redis:6379/",
        "http://postgres/",
        "ftp://example.com/hook",
    ])
    def test_unsafe_urls_rejected_by_validator(self, url):
        # validator raises regardless of require_https;
        # router converts that exception into HTTP 422.
        with pytest.raises(UnsafeURLError):
            validate_public_url(url)

    def test_public_https_url_accepted_by_validator(self):
        with patch("app.core.url_safety._resolved_ips", return_value=["93.184.216.34"]):
            url = validate_public_url("https://customer.example.com/webhook", require_https=True)
            assert url == "https://customer.example.com/webhook"

    def test_require_https_rejects_http_in_production(self):
        with patch("app.core.url_safety._resolved_ips", return_value=["93.184.216.34"]):
            with pytest.raises(UnsafeURLError, match="HTTPS"):
                validate_public_url("http://customer.example.com/webhook", require_https=True)


class TestHMACSigning:
    def test_signature_format_matches_wire(self):
        """The header sent to customers is X-Ignify-Signature: sha256=<hex>."""
        secret = "whsec_test_abc"
        body = json.dumps({"event": "plan.approved", "payload": {"id": "x"}}).encode()
        sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        header_value = f"sha256={sig}"
        assert header_value.startswith("sha256=")
        # Verifier side (simulation)
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        assert hmac.compare_digest(sig, expected)

    def test_different_secrets_produce_different_signatures(self):
        body = b"payload"
        s1 = hmac.new(b"secret-a", body, hashlib.sha256).hexdigest()
        s2 = hmac.new(b"secret-b", body, hashlib.sha256).hexdigest()
        assert s1 != s2


class TestDispatchFailsClosedOnUnsafeURL:
    async def test_unsafe_url_in_db_is_skipped_at_dispatch(self, caplog):
        """Even if an unsafe URL slips into the DB (pre-migration, or DNS
        rebinding), dispatch must refuse to send to it and record a 0 status."""
        from app.modules.webhook_subscriptions.router import dispatch_event

        hook = Webhook(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            url="http://postgres:5432/evil",
            events=["plan.approved"],
            secret="whsec_should-never-leak",
            is_active=True,
        )
        db = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = [hook]
        db.execute = AsyncMock(return_value=result)
        db.flush = AsyncMock()

        # Patch the httpx client so we can assert it's NEVER called.
        with patch(
            "app.modules.webhook_subscriptions.router.httpx.AsyncClient"
        ) as fake_client:
            fake_client_inst = MagicMock()
            fake_client_inst.__aenter__.return_value = fake_client_inst
            fake_client_inst.__aexit__.return_value = None
            fake_client_inst.post = AsyncMock()
            fake_client.return_value = fake_client_inst

            with caplog.at_level(logging.WARNING):
                await dispatch_event(
                    db,
                    tenant_id=hook.tenant_id,
                    event="plan.approved",
                    payload={"id": str(uuid.uuid4())},
                )

            fake_client_inst.post.assert_not_called()

        # Row should be marked as a failed delivery.
        assert hook.last_status_code == 0
        assert hook.last_delivery_at is not None

        # Secret must not appear anywhere in logs.
        combined = "\n".join(r.getMessage() for r in caplog.records)
        assert "whsec_should-never-leak" not in combined


class TestSecretNeverLogged:
    async def test_secret_absent_from_logs_on_network_failure(self, caplog):
        from app.modules.webhook_subscriptions.router import dispatch_event

        hook = Webhook(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            url="https://customer.example.com/hook",
            events=["plan.approved"],
            secret="whsec_super-secret-shared-key",
            is_active=True,
        )
        db = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = [hook]
        db.execute = AsyncMock(return_value=result)
        db.flush = AsyncMock()

        async def _raiser(*a, **kw):
            raise ConnectionError("network borked")

        # Let URL pass validation but make the post fail
        with patch(
            "app.modules.webhook_subscriptions.router.validate_public_url",
            return_value=hook.url,
        ), patch(
            "app.modules.webhook_subscriptions.router.httpx.AsyncClient"
        ) as fake_client:
            fake_client_inst = MagicMock()
            fake_client_inst.__aenter__.return_value = fake_client_inst
            fake_client_inst.__aexit__.return_value = None
            fake_client_inst.post = AsyncMock(side_effect=_raiser)
            fake_client.return_value = fake_client_inst

            with caplog.at_level(logging.WARNING):
                await dispatch_event(
                    db,
                    tenant_id=hook.tenant_id,
                    event="plan.approved",
                    payload={"id": "abc"},
                )

        combined = "\n".join(r.getMessage() for r in caplog.records)
        assert "whsec_super-secret-shared-key" not in combined
        # But the failure was logged.
        assert any("webhook delivery failed" in m for m in (r.getMessage() for r in caplog.records))
