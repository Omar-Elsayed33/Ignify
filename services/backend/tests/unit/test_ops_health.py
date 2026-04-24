"""P2-3: Health/readiness endpoint behaviour.

Unit tests focus on the response-shape and auth contracts. The real service
checks (DB, Redis, MinIO, Worker) are covered by the baseline smoke run and
by targeted mocks here.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.modules.ops import router as ops_router


pytestmark = pytest.mark.unit


class TestLiveness:
    async def test_live_returns_200_shape(self):
        result = await ops_router.live_endpoint()
        assert result["alive"] is True
        assert isinstance(result["uptime_seconds"], int)


class TestReadiness:
    async def test_ready_all_green(self):
        from fastapi import Response
        resp = Response()
        with patch.object(ops_router, "_check_db", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_redis", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_minio", AsyncMock(return_value="ok")):
            body = await ops_router.ready_endpoint(resp)
        assert body == {"ready": True, "db": "ok", "redis": "ok", "minio": "ok"}
        # Default 200 — no status_code mutation
        assert resp.status_code == 200

    async def test_ready_503_when_db_down(self):
        from fastapi import Response
        resp = Response()
        with patch.object(ops_router, "_check_db", AsyncMock(return_value="error")), \
             patch.object(ops_router, "_check_redis", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_minio", AsyncMock(return_value="ok")):
            body = await ops_router.ready_endpoint(resp)
        assert body["ready"] is False
        assert resp.status_code == 503

    async def test_ready_503_when_minio_down(self):
        from fastapi import Response
        resp = Response()
        with patch.object(ops_router, "_check_db", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_redis", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_minio", AsyncMock(return_value="error")):
            body = await ops_router.ready_endpoint(resp)
        assert body["ready"] is False
        assert resp.status_code == 503

    async def test_ready_does_not_check_worker(self):
        """A worker outage must NOT make this API pod unready — a different
        pod's failure would cascade otherwise."""
        from fastapi import Response
        resp = Response()
        with patch.object(ops_router, "_check_db", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_redis", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_minio", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_worker_sync", return_value={"status": "down"}):
            body = await ops_router.ready_endpoint(resp)
        assert body["ready"] is True
        # Worker key is not even in the response.
        assert "worker" not in body


class TestStatus:
    async def test_status_contains_all_subsystems(self):
        with patch.object(ops_router, "_check_db", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_redis", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_minio", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_worker_sync", return_value={"status": "ok", "worker_count": 2}):
            body = await ops_router.status_endpoint(x_ops_token=None)

        assert body["db"] == "ok"
        assert body["redis"] == "ok"
        assert body["minio"] == "ok"
        assert body["worker"]["status"] == "ok"
        assert body["worker"]["worker_count"] == 2
        assert "providers" in body
        assert "uptime_seconds" in body


class TestStatusAuth:
    async def test_debug_bypasses_token_check(self, monkeypatch):
        monkeypatch.setattr(ops_router.settings, "DEBUG", True)
        monkeypatch.setenv("OPS_STATUS_TOKEN", "required-token")
        # No token supplied, but DEBUG=true → no auth error.
        with patch.object(ops_router, "_check_db", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_redis", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_minio", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_worker_sync", return_value={"status": "ok", "worker_count": 1}):
            body = await ops_router.status_endpoint(x_ops_token=None)
        assert body["db"] == "ok"

    async def test_production_unset_token_still_allows_access(self, monkeypatch):
        """When DEBUG=false but OPS_STATUS_TOKEN is unset, allow access —
        failing closed would make the only diagnostic endpoint unreachable."""
        monkeypatch.setattr(ops_router.settings, "DEBUG", False)
        monkeypatch.delenv("OPS_STATUS_TOKEN", raising=False)
        with patch.object(ops_router, "_check_db", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_redis", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_minio", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_worker_sync", return_value={"status": "ok", "worker_count": 1}):
            body = await ops_router.status_endpoint(x_ops_token=None)
        assert body["db"] == "ok"

    async def test_production_with_wrong_token_rejected(self, monkeypatch):
        from fastapi import HTTPException

        monkeypatch.setattr(ops_router.settings, "DEBUG", False)
        monkeypatch.setenv("OPS_STATUS_TOKEN", "expected-secret")
        with pytest.raises(HTTPException) as exc_info:
            await ops_router.status_endpoint(x_ops_token="wrong")
        assert exc_info.value.status_code == 401

    async def test_production_with_correct_token_allowed(self, monkeypatch):
        monkeypatch.setattr(ops_router.settings, "DEBUG", False)
        monkeypatch.setenv("OPS_STATUS_TOKEN", "expected-secret")
        with patch.object(ops_router, "_check_db", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_redis", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_minio", AsyncMock(return_value="ok")), \
             patch.object(ops_router, "_check_worker_sync", return_value={"status": "ok", "worker_count": 1}):
            body = await ops_router.status_endpoint(x_ops_token="expected-secret")
        assert body["db"] == "ok"

    async def test_production_missing_token_when_required_rejected(self, monkeypatch):
        from fastapi import HTTPException

        monkeypatch.setattr(ops_router.settings, "DEBUG", False)
        monkeypatch.setenv("OPS_STATUS_TOKEN", "expected-secret")
        with pytest.raises(HTTPException) as exc_info:
            await ops_router.status_endpoint(x_ops_token=None)
        assert exc_info.value.status_code == 401


class TestWorkerCheck:
    def test_no_workers_reports_down(self):
        with patch("app.worker.celery_app.control.inspect") as fake_inspect:
            fake_inspect.return_value.ping.return_value = None
            result = ops_router._check_worker_sync()
        assert result["status"] == "down"
        assert result["worker_count"] == 0

    def test_workers_responding_reports_ok(self):
        with patch("app.worker.celery_app.control.inspect") as fake_inspect:
            fake_inspect.return_value.ping.return_value = {
                "celery@worker1": {"ok": "pong"},
                "celery@worker2": {"ok": "pong"},
            }
            result = ops_router._check_worker_sync()
        assert result["status"] == "ok"
        assert result["worker_count"] == 2

    def test_broker_error_reports_error(self):
        with patch("app.worker.celery_app.control.inspect") as fake_inspect:
            fake_inspect.side_effect = ConnectionError("broker unreachable")
            result = ops_router._check_worker_sync()
        assert result["status"] == "error"
        assert "broker unreachable" in result["error"]
