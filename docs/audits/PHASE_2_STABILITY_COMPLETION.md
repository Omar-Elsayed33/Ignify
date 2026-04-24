# Phase 2 — Stability & Infra Readiness: Completion Report

**Date**: 2026-04-24  
**Scope**: P2-1 through P2-7  
**Status**: **IMPLEMENTATION COMPLETE.** All gate criteria met.

---

## TL;DR

| Gate Criterion | Result |
|----------------|--------|
| Backend tests pass | ✅ **146/146** (Phase 1: 107 + Phase 2: 39 new) |
| Frontend TypeScript passes | ✅ **0 errors** (Phase 0 baseline: 16) |
| Frontend build passes | ✅ **Next.js build succeeds** (Phase 0 baseline: BROKEN) |
| Docker health checks pass | ✅ `/ops/live` 200, `/ops/ready` 200 (DB+Redis+MinIO), `/ops/status` includes worker |
| Smoke test passes | ✅ **7/7** with `--skip-plan` (Phase 0 baseline: 4/7 with 3 subscription-gate failures) |

---

## P2-1 — Production Environment Validation

**Problem**: Backend booted silently with default dev values (`SECRET_KEY=change-me-...`, `ignify_dev_2024` DB password). A misconfigured production deploy would run for weeks before anyone noticed.

**Changes** (`app/core/config.py`):
- New `Settings.validate_production()` — returns a list of problems with current config (dev-sentinel `SECRET_KEY`, short `SECRET_KEY`, dev DB password, missing OpenRouter, empty CORS, SMTP-less email verification, missing Sentry).
- New `Settings.assert_safe_to_boot()` — raises `ProductionConfigError` listing all fatal problems at once. Sentry-missing is demoted to a warning (observability degradation is not a boot blocker).
- Import-time call at module load, gated by `DEBUG=True` and by `IGNIFY_SKIP_PROD_CHECK=1` (for tooling like alembic that needs to load config without the server).

**Tests**: `tests/unit/test_config_validation.py` — 13 tests covering sentinel rejection, length floor, dev-password detection, email/SMTP coupling, Sentry warning vs fatal, and DEBUG bypass.

---

## P2-2 — Fernet Key Rotation (ENCRYPTION_KEY)

**Problem**: Phase 1 derived the Fernet key from `SECRET_KEY`. Rotating `SECRET_KEY` (e.g., after a suspected compromise) would simultaneously invalidate all JWTs (acceptable) AND render every encrypted token undecryptable (catastrophic).

**Changes** (`app/core/crypto.py`):
- New `ENCRYPTION_KEY` setting. When set, it's used for Fernet derivation; when empty, falls back to `SECRET_KEY` (Phase 1 compatibility).
- New `ENCRYPTION_KEY_PREVIOUS` env var — comma-separated list of prior keys. Uses `MultiFernet` so decryption tries all keys but encryption uses only the primary.
- New `rotate_encryption(stored)` helper — re-encrypts under the current primary if the value decrypts with a previous key. Enables lazy rotation: read once → rotate → save. No big-bang migration.

**Rotation playbook** (for future ops):
1. Generate new key. Set `ENCRYPTION_KEY_PREVIOUS=<old key>` and `ENCRYPTION_KEY=<new key>`. Deploy.
2. All reads work; new writes use the new key. Old ciphertext decrypts via previous.
3. Run a background sweep invoking `rotate_encryption()` per row (scheduled in Phase 3).
4. Once sweep completes, drop `ENCRYPTION_KEY_PREVIOUS`.

**Tests**: `tests/unit/test_crypto_rotation.py` — 7 tests: key selection precedence, rotation with previous key, sanity check that rotation actually requires the previous key, `rotate_encryption()` behavior, Phase-1-compatibility path.

---

## P2-3 — Health / Readiness Checks

**Problem**: `/ops/ready` checked DB + Redis only — missed MinIO. `/ops/status` leaked provider configuration to anonymous callers. No worker health signal.

**Changes** (`app/modules/ops/router.py`):
- `/ops/ready` now checks **DB + Redis + MinIO** (matches the hard dependencies of any request path that serves HTTP).
- `/ops/status` now includes a **worker** block (`{status, worker_count}`) using `celery_app.control.inspect().ping()` via `asyncio.to_thread` to avoid blocking the event loop.
- `/ops/status` is now **guarded by `OPS_STATUS_TOKEN`** env var in production:
  - `DEBUG=true` → always allowed.
  - `DEBUG=false` + `OPS_STATUS_TOKEN` unset → allowed (avoid making diagnostic endpoint unreachable via misconfig), but logged.
  - `DEBUG=false` + `OPS_STATUS_TOKEN` set → must match `X-Ops-Token` header.
- `/ops/live` and `/ops/ready` remain unauthenticated (k8s probes can't easily set headers).
- Deliberately **does NOT** include worker in `/ops/ready` — a worker outage should not take the API pod out of rotation.

**Live verification**:
```json
{
  "db": "ok", "redis": "ok", "minio": "ok",
  "worker": {"status": "ok", "worker_count": 1},
  "providers": {...}
}
```

**Tests**: `tests/unit/test_ops_health.py` — 14 tests covering liveness shape, readiness 503 on each subsystem failure, status auth matrix (DEBUG bypass / unset token / wrong token / correct token / missing token), and worker check states (no workers / responding / broker error).

---

## P2-4 — Celery Reliability

**Problem**: No task-level time limits, no retry strategy, and the atomic-claim fix in Phase 1 had a latent issue: a worker crashing after claim but before publish left rows stuck in `publishing` state forever.

**Changes**:

### `app/worker.py`
Added to `celery_app.conf.update(...)`:
- `task_time_limit=300` + `task_soft_time_limit=240` — hard cap on any task.
- `broker_connection_retry_on_startup=True` + `broker_connection_retry=True` + `broker_connection_max_retries=5` — survives broker blips at boot.
- `task_reject_on_worker_lost=True` — redelivery on worker crash.
- `result_expires=86400` — keep results 24h for post-mortem without bloating Redis.
- New Beat entry: `reap-stuck-publishing` → `ignify.reap_stuck_publishing` every 5 min.

### `app/modules/social_scheduler/tasks.py`
- `publish_scheduled_post` now has:
  - `autoretry_for=(ConnectionError, TimeoutError)`, `retry_backoff=True`, `retry_backoff_max=600`, `retry_jitter=True`, `max_retries=3` — automatic retry for transient errors with jittered exponential backoff. Non-transient exceptions (bad token, deleted page) still set `status=failed` via the existing try/except path and do not retry.
  - `time_limit=180` + `soft_time_limit=120` — per-task cap tighter than the global default.
- `_scan_due()` atomic claim now additionally sets `publishing_started_at=now` alongside the status transition. This timestamp is the watchdog's input.
- New watchdog task `reap_stuck_publishing` — single `UPDATE ... WHERE status='publishing' AND publishing_started_at < now - 15min RETURNING id` that moves stuck rows back to `failed`. Idempotent; second run is a no-op.

### `app/db/models.py` + migration `s9t0u1v2w3x4`
- `social_posts.publishing_started_at` column added (nullable). Stamped on every successful claim.

**Tests**: `tests/integration/test_stuck_publishing_reaper.py` — 5 live-DB tests:
- Old `publishing` row (30 min) → reaped → `failed`.
- Recent `publishing` row (2 min) → untouched.
- `publishing` row without timestamp → untouched (defensive: don't touch rows we can't reason about).
- `published` and `scheduled` rows → never reaped.
- Double-run idempotency.

All Phase 1 scheduler race tests still pass (regression check).

---

## P2-5 — Next.js 15 `params` Promise API

**Problem**: Next.js 15 changed page props `params` from a plain object to `Promise<...>`. `npm run build` failed with:
> `Type '{ params: { locale: string; }; }' does not satisfy the constraint 'PageProps'. ... missing properties from type 'Promise<any>': then, catch, finally`

**Changes**:
- `dashboard/src/app/[locale]/(dashboard)/profile/page.tsx` — migrated to `async` + `params: Promise<{locale: string}>` + `await params`.
- `dashboard/src/app/[locale]/(dashboard)/settings/brand/page.tsx` — same.

Only 2 files in the codebase used the old signature. Verified via `grep -rln "params:\s*{"` across `dashboard/src/app`.

---

## P2-6 — TypeScript Errors

**Problem**: 16 errors across 10 files blocked `npx tsc --noEmit` and `npm run build`.

**Root causes + fixes**:

| File | Error | Fix |
|------|-------|-----|
| `components/DataTable.tsx` | Constraint `T extends Record<string, unknown>` rejected typed interfaces | Loosened to `T extends object`; internal index accesses cast at use site |
| 7 pages casting `as unknown as Record<string, unknown>[]` | Caused `Record[]` → `TypedRow[]` mismatch | Removed the casts; DataTable now infers `T` from columns |
| `settings/security/page.tsx` | `api.del` — method doesn't exist | Changed to `api.delete`. Also extended `api.delete` signature to accept a body (DELETE with JSON body is valid HTTP) |
| `components/AIUsageWidget.tsx` | `api<T>(...)` — called as a function | Changed to `api.get<T>(...)` |
| `seo/page.tsx` | `key: "actions" as keyof SEOKeyword` — but "actions" isn't a key of SEOKeyword | Removed the bogus cast; key is `string` in `Column<T>` |
| `plans/[id]/page.tsx` | 5 duplicate object literal keys (`day`, `channel`, `format`, `topic`, `cta`) | Removed the duplicate block at the bottom of the translations map |
| `help/[topic]/page.tsx` | Regex `s` flag requires ES2018+ | Bumped `tsconfig.json` `"target"` from ES2017 → ES2018 (widely supported everywhere) |

**Verification**: `npx tsc --noEmit` exits with 0 output. `npm run build` succeeds.

---

## P2-7 — Smoke Test Subscription Gate

**Problem**: `scripts/smoke_test.py` predated the subscription gate (migration `p6q7r8s9t0u1`). 3 of 7 baseline steps failed with HTTP 402 because the smoke tenant had `subscription_active=false`.

**Changes** (`scripts/smoke_test.py`):
- New `activate_subscription()` step inserted between `register` and `onboarding`:
  1. Fetch `/auth/me` → extract `tenant_id`.
  2. Log in as seeded superadmin `admin@ignify.com / Admin@2024`.
  3. `PUT /admin/tenants/{tenant_id}/subscription` with `{"subscription_active": true}`.
- If the superadmin doesn't exist, raises a clear error rather than silently skipping — nudges ops to re-seed.

**Results** (live):
```
 ✓ health                                        46 ms
 ✓ register                                      743 ms
 ✓ activate subscription (admin)                 429 ms   ← new
 ✓ onboarding                                    64 ms
 ✓ ai-usage balance                              10 ms
 ✓ deep SEO audit                                14937 ms  ← was 402 in baseline
 ✓ integrations status                           71 ms    ← was 402 in baseline

 7 passed, 0 failed
```

Plan-generation steps are skipped via `--skip-plan` because they require live OpenRouter calls (~3 minutes). The gate is proven open; the path is exercised.

---

## Phase 2 Smoke Checklist

| # | Check | Command | Result |
|---|-------|---------|--------|
| S1 | Migrations at head | `alembic current` | ✅ `s9t0u1v2w3x4 (head)` |
| S2 | `/ops/live` | `curl /ops/live` | ✅ 200 |
| S3 | `/ops/ready` all deps green | `curl /ops/ready` | ✅ 200, `{db, redis, minio}` all ok |
| S4 | `/ops/status` includes worker | `curl /ops/status` | ✅ worker.status=ok, worker_count=1 |
| S5 | Full backend test suite | `pytest tests/ -q` | ✅ 146/146 |
| S6 | TypeScript clean | `npx tsc --noEmit` | ✅ 0 errors |
| S7 | Dashboard build | `npm run build` | ✅ success |
| S8 | Smoke test (fast path) | `python -m scripts.smoke_test --skip-plan` | ✅ 7/7 |
| S9 | All containers up | `docker ps` | ✅ 9 containers up |

---

## Files Changed in Phase 2

### New files (5)
- `services/backend/alembic/versions/s9t0u1v2w3x4_social_post_publishing_started_at.py`
- `services/backend/tests/unit/test_config_validation.py`
- `services/backend/tests/unit/test_crypto_rotation.py`
- `services/backend/tests/unit/test_ops_health.py`
- `services/backend/tests/integration/test_stuck_publishing_reaper.py`
- `docs/audits/PHASE_2_STABILITY_COMPLETION.md` (this file)

### Modified backend files
- `services/backend/app/core/config.py` — `ENCRYPTION_KEY`, `validate_production()`, `assert_safe_to_boot()`, import-time validation
- `services/backend/app/core/crypto.py` — MultiFernet with ENCRYPTION_KEY + ENCRYPTION_KEY_PREVIOUS, `rotate_encryption()` helper
- `services/backend/app/modules/ops/router.py` — worker health, MinIO in readiness, `OPS_STATUS_TOKEN` gate on `/ops/status`
- `services/backend/app/worker.py` — task time limits, broker retry, reap-stuck-publishing in Beat schedule
- `services/backend/app/modules/social_scheduler/tasks.py` — task-level retry/timeout, `publishing_started_at` stamp, `reap_stuck_publishing` watchdog
- `services/backend/app/db/models.py` — `SocialPost.publishing_started_at` column
- `services/backend/scripts/smoke_test.py` — admin subscription activation step

### Modified dashboard files
- `dashboard/tsconfig.json` — target ES2018
- `dashboard/src/lib/api.ts` — `api.delete` accepts body
- `dashboard/src/components/DataTable.tsx` — generic constraint loosened, index casts at use sites
- `dashboard/src/components/AIUsageWidget.tsx` — `api.get(...)` not `api(...)`
- `dashboard/src/app/[locale]/(dashboard)/profile/page.tsx` — Next.js 15 Promise params
- `dashboard/src/app/[locale]/(dashboard)/settings/brand/page.tsx` — Next.js 15 Promise params
- `dashboard/src/app/[locale]/(dashboard)/settings/security/page.tsx` — `api.del` → `api.delete`
- `dashboard/src/app/[locale]/(dashboard)/plans/[id]/page.tsx` — removed 5 duplicate object keys
- `dashboard/src/app/[locale]/(dashboard)/seo/page.tsx` — removed bogus `keyof` cast, removed DataTable cast
- 6 other pages — removed `as unknown as Record<string, unknown>[]` casts

### Migrations added (1)
- `s9t0u1v2w3x4_social_post_publishing_started_at.py`

---

## Test Count Progress

| Phase | Unit | Integration | Total |
|-------|------|------------|-------|
| Phase 0 baseline | 0 | 0 | 0 |
| Phase 1 close | 100 | 7 | 107 |
| **Phase 2 close** | **134** | **12** | **146** |

New in Phase 2 (39 tests):
- `test_config_validation.py` (13)
- `test_crypto_rotation.py` (7)
- `test_ops_health.py` (14)
- `test_stuck_publishing_reaper.py` (5)

---

## Known Limitations / Follow-Ups for Later Phases

| Item | Phase | Notes |
|------|-------|-------|
| Background sweep that calls `rotate_encryption()` on every encrypted row | Phase 3 | Low-priority until a key rotation actually happens |
| Celery Beat still a single point of failure | Phase 3 | Would need `celery-redbeat` + Redis-backed leader election for multi-replica Beat |
| Webhook dispatch is inline in FastAPI handler | Phase 3 | Move to Celery; now possible since we have the reliability patterns |
| Plan-generation smoke test still needs `--skip-plan` for CI | Phase 3 | A mock LLM mode or a pre-canned plan response would fix this |
| Worker metrics exposure (Prometheus) | Phase 4 | Once monitoring stack is wired |

---

## Gate Status

**Gate: OPEN.**

All 5 explicit gate criteria met:
- ✅ Backend tests pass (146/146)
- ✅ Frontend TypeScript passes (0 errors)
- ✅ Frontend build passes (Next.js build succeeds)
- ✅ Docker health checks pass (`/ops/live`, `/ops/ready`, `/ops/status` all 200)
- ✅ Smoke test passes (7/7 with `--skip-plan`; plan-step intentionally deferred to Phase 3)

Ready to commit `phase-2-stability-infra-readiness` and proceed to Phase 3.

---

*Phase 2 complete. 146 tests passing. Build clean. Smoke test green.*
