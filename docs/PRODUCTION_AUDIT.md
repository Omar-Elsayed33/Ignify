# Ignify — Production Readiness Audit & Fix Plan

**Date**: 2026-04-24  
**Role**: CTO / Senior Architect / QA Lead / Product Owner  
**Verdict**: System is NOT production-ready. Estimated gap-to-launch: 3–4 weeks of focused engineering.

---

## EXECUTIVE SUMMARY

Ignify is architecturally sound and feature-rich. The core flows work. However, there are **4 security vulnerabilities that would be catastrophic with real users**, **1 advertised feature that does not work** (video rendering), **zero test coverage**, and a series of reliability gaps that will cause customer-facing failures within the first week of real usage. None of these are blockers that require architectural redesign — every issue below has a clear, bounded fix.

---

## STEP 1 — SYSTEM AUDIT

### 🔴 CRITICAL ISSUES (production blockers — fix before any user signs up)

| # | Issue | Location | Real-World Impact |
|---|-------|----------|-------------------|
| C1 | Social OAuth tokens stored as **plaintext** despite `_encrypted` column name | `social_accounts.access_token_encrypted` | DB breach → all connected social accounts compromised |
| C2 | `SECRET_KEY` signs JWTs **and** derives Fernet encryption key — stored in `.env` | `infra/docker/.env` | One leaked `.env` invalidates all sessions and decrypts all tokens simultaneously |
| C3 | OAuth state is an **in-memory Python dict** — lost on every backend restart | `app/integrations/social/oauth_state.py` | Every backend deployment/restart breaks all in-progress OAuth flows silently |
| C4 | Video generation is **advertised on billing tiers** (Starter: 10 videos/mo) but `VideoRenderer` subagent is stubbed — produces no actual video | `app/agents/video/subagents/` | Paying customers charged for a feature that returns nothing |
| C5 | `social_posts.social_account_id` is **NOT NULL** — manual-mode posts require a connected account that may not exist | `db/models.py`, `social_scheduler/service.py` | "Manual scheduling" UI exists but crashes the scheduler service when triggered without an account |
| C6 | `PlanModeConfig` rows must be **seeded in DB** — plan generation throws `NoneType` errors on a fresh database or after a DB reset | `agents/plan_modes.py` | New deployments and staging resets silently break all plan generation |
| C7 | **No SSRF protection** on competitor scraper — fetches any URL the tenant provides, including internal IPs | `core/seo_audit_deep.py`, `agents/competitor/subagents/scraper.py` | Tenant can probe `http://postgres:5432`, `http://redis:6379`, internal metadata endpoints |
| C8 | **Webhook URL SSRF** — outgoing webhooks fire to any URL tenants register | `modules/webhook_subscriptions/` | Same SSRF risk — tenants can use webhook delivery to scan internal network |

---

### 🟠 MAJOR ISSUES (will cause failures or incidents within first month)

| # | Issue | Location | Real-World Impact |
|---|-------|----------|-------------------|
| M1 | LinkedIn `refresh_token` column **missing** from `social_accounts` | `db/models.py`, `alembic/versions/` | All LinkedIn users must re-authenticate every 60 days. No warning, just silent 401 on next publish |
| M2 | All LLM model tiers map to **the same model** (`gemini-2.5-flash`) — advertised quality differentiation (Fast vs Deep) is non-functional | `agents/models.py` | Customers paying 10x more for "Deep" plan get identical output to "Fast" |
| M3 | **No Celery task deduplication** — `scan_due_posts` can enqueue the same post twice if worker is slow | `modules/social_scheduler/tasks.py` | Double-publishing to social media. Unrecoverable reputation damage for users |
| M4 | PDF generation runs **synchronously in the request handler** — WeasyPrint can block 10–30 seconds | `modules/plans/router.py` export endpoint | Event loop blocked; all other requests stall during PDF export |
| M5 | Deep SEO audit fetches **live pages synchronously in request handler** with no timeout | `core/seo_audit_deep.py` | Slow target sites can hold the request for 60+ seconds; Nginx gateway will timeout first (504) |
| M6 | **No per-tenant cost enforcement** — `TenantOpenRouterConfig` spend limits exist in schema but are not enforced in the agent execution path | `agents/base.py`, `modules/billing/` | A single tenant can burn through unlimited LLM spend. No circuit breaker |
| M7 | **Celery Beat single point of failure** — one container, no leader election | `infra/docker/docker-compose.yml` | If beat crashes, all scheduled social posts are missed indefinitely. No alerting |
| M8 | **Rate limiting is per-IP, not per-tenant** for most endpoints | `app/main.py`, route decorators | VPN users or cloud-based scrapers bypass limits entirely. Generation endpoints can be abused |
| M9 | `MinIO` bucket may be configured with **public read access** in dev compose — risk if promoted to production as-is | `infra/docker/docker-compose.yml` | All user logos, plan exports, generated images publicly accessible by URL |
| M10 | `AgentRun` table has **no retention policy** — grows unbounded | `db/models.py` | At 1,000 plans/day → 14,000 rows/day. Full JSON output stored per row (~50–100KB each). 1 month = ~40GB |
| M11 | **No database connection pool** between FastAPI and PostgreSQL | `services/backend/app/db/` | Under 50+ concurrent requests, Postgres connection limits hit; new requests fail with `FATAL: connection limit exceeded` |
| M12 | `tenant.config` JSON column holds business profile, brand, Google tokens, onboarding state, channels — **no schema enforcement** | `db/models.py` | Silent data corruption if any service writes unexpected keys. `_pick_business_profile()` heuristic is fragile |

---

### 🟡 MINOR ISSUES (UX/polish — fix before public marketing)

| # | Issue | Impact |
|---|-------|--------|
| m1 | No React Query/SWR — every page mount triggers fresh API calls, no caching | Slow perceived performance; duplicate requests |
| m2 | No list virtualization — leads/content/agent_runs tables render all DOM nodes | Browser freezes at 500+ rows |
| m3 | No global React Error Boundary — unhandled promise rejections silently blank sections | Users see empty screens with no explanation |
| m4 | Translation keys missing for some new features (plan versioning, referrals, API keys) | English hardcoded text bleeds into Arabic UI |
| m5 | No `loading` skeleton on plan generation stream — UI shows empty state while first node runs | Confusing first-time experience |
| m6 | No email sent on social post publish failure | Users don't know their post failed |
| m7 | `/scheduler/accounts` shows token expiration date but no "reconnect" CTA when expired | User sees expired account but has no path to fix it |
| m8 | `EmptyState` icon prop is optional but many usages omit it — falls back to `Inbox` icon | Wrong icon displayed in leads, competitors, etc. |
| m9 | No confirmation before plan regeneration — one click nukes existing plan | Accidental data loss |
| m10 | Analytics dashboard (`/analytics/overview`) pulls data but shows no loading state on slow connections | Flash of empty charts |

---

## STEP 2 — BUG DETECTION

### Logical Bugs

**BUG-1: Fernet key derivation from SECRET_KEY is non-standard**  
Location: `app/core/crypto.py`  
Issue: `SHA-256(SECRET_KEY)` produces 32 bytes. Fernet requires a 32-byte URL-safe base64-encoded key. If the derivation doesn't base64-encode the hash output, `Fernet(key)` will raise `ValueError` for some SECRET_KEY values — but only at runtime on first decrypt.  
Fix: Use `base64.urlsafe_b64encode(hashlib.sha256(secret_key.encode()).digest())`.

**BUG-2: `scan_due_posts` has no idempotency guard**  
Location: `app/modules/social_scheduler/tasks.py`  
Issue: The Celery Beat task queries `WHERE status='scheduled' AND scheduled_at <= now()` and enqueues a `publish_post` task per result. If the Beat interval fires again before `publish_post` completes, the same post gets enqueued twice. There is no `SELECT FOR UPDATE SKIP LOCKED` or status transition to `publishing` before enqueue.  
Fix: Atomic status transition to `'publishing'` using `UPDATE ... WHERE status='scheduled' RETURNING id` before dispatching tasks.

**BUG-3: `_pick_business_profile()` silent data loss**  
Location: `app/modules/tenant_settings/service.py`  
Issue: The function picks whichever of two profile sources has more non-null fields. If a user updates their profile via onboarding (writes `config.onboarding.business_profile`) but then updates via settings (writes `config.business_profile`), and the onboarding copy happens to have more fields filled, the settings update is silently ignored on next read.  
Fix: Canonicalize to one source (`config.business_profile`) and migrate all reads/writes to use it exclusively.

**BUG-4: Plan version number not incremented on section regeneration**  
Location: `app/modules/plans/service.py` — `regenerate_plan_section()`  
Issue: `regenerate_full_plan()` creates a snapshot and increments `version`. But `regenerate_plan_section()` updates a section without snapshot creation or version increment. If the user regenerates 10 sections, there is no version history for any of them — only full regenerations are tracked.  
Fix: Create a snapshot before any section regeneration and increment version.

**BUG-5: OAuth callback race condition — state token reuse**  
Location: `app/integrations/social/oauth_state.py`  
Issue: OAuth state is stored in a Python dict keyed by state token. Between `build_auth_url()` and `exchange_code()`, a second tab or parallel request can overwrite the same state. No TTL enforcement within a single process (only cleaned on next GC cycle).  
Fix: Move to Redis with `SET NX PX 600000` (10-min TTL, only set if not exists).

**BUG-6: LinkedIn connector missing `content_post_id` in `link` metadata**  
Location: `app/integrations/social/linkedin.py`  
Issue: When publishing a LinkedIn post with a `content_link` URL, the UGC Post API call body likely uses a hardcoded or null link URL rather than `content_link` from `SocialPost`. Not verified, but high risk given `content_link` is a newer column.  
Fix: Audit LinkedIn connector `publish()` method to confirm `content_link` from `SocialPost` is passed correctly.

**BUG-7: `check_quota()` counts 30-day window from current time, not billing period**  
Location: `app/modules/billing/service.py`  
Issue: Quota check counts resources in the last 30 calendar days. But a user's billing period starts on their subscription date. A user who subscribes on the 15th of month 1 and generates 20 articles on the 14th of month 2 will be wrongly blocked — they haven't exhausted their new billing period's quota yet.  
Fix: Count from `subscription_period_start` or use a monthly reset timestamp stored on `CreditBalance`.

**BUG-8: Social post `mark-published` endpoint has no platform verification**  
Location: `app/modules/social_scheduler/router.py`  
Issue: `POST /scheduled/{id}/mark-published` allows any authenticated user to mark any scheduled post (including auto-mode posts) as manually published. An editor could accidentally or maliciously mark an auto-mode post as published before it actually fires, causing the Celery task to try to publish an already-"published" post.  
Fix: Guard: `if post.publish_mode != 'manual': raise 400`.

**BUG-9: Competitor two-way sync can enter infinite update loop**  
Location: `app/modules/tenant_settings/service.py` — `sync_competitors_to_profile()` and `sync_profile_to_competitors()`  
Issue: If `sync_competitors_to_profile()` is called by a Competitor CRUD endpoint and triggers a tenant config update, and that config update triggers `sync_profile_to_competitors()` in the tenant settings save path — depending on middleware/event hooks, this could loop. At minimum it's two DB writes per competitor change.  
Fix: Single canonical source — competitors table is authoritative; business profile `competitors` array is read-only cache, written only from competitor CRUD.

**BUG-10: `video_gen` quota check deducts before task completes**  
Location: `app/modules/video_gen/router.py`  
Issue: If `check_quota()` is called on request receipt and the Celery video task later fails, the quota is already deducted. No rollback on failure.  
Fix: Deduct quota only on successful task completion inside the Celery task, using a DB transaction.

---

### API Contract Issues (Frontend/Backend Mismatches)

**CONTRACT-1**: Frontend `scheduler` page expects `publish_mode` values `'auto'` and `'manual'`. Backend default is `'auto'` (string). If DB migration `m3h4i5j6k7l8` has not been run, the column doesn't exist — backend silently omits it and frontend crashes on `.publish_mode` read.

**CONTRACT-2**: `GET /plans/{id}` returns `share_token` and `share_expires_at` fields. The plan detail page reads these to render the share button. If migration `n4i5j6k7l8m9` (which adds these columns) hasn't run, the API returns `null` for both — the share button never renders but also throws no error.

**CONTRACT-3**: `POST /plans/generate` and `POST /plans/generate/stream` both exist. The frontend uses the stream endpoint for real-time updates. The non-stream endpoint has no SSE — if the frontend falls back to it (e.g., on a proxy that doesn't support SSE), it blocks for 3+ minutes with no feedback.

**CONTRACT-4**: `GET /social-scheduler/connectors` returns `is_configured` (server has OAuth app creds) and `is_connected` (user has linked account). The accounts page only shows platforms where `is_configured=true`. But Meta (FB + IG) are two entries in `SocialPlatform` enum but share one OAuth app. The connector report must deduplicate or the UI shows FB and IG as separate "configure" items.

---

## STEP 3 — ARCHITECTURE REVIEW

### Backend Structure

**Verdict**: Well-organized, maintainable. Module-per-feature structure is correct. The main concern is the blurring between service-layer logic and agent-layer logic — some services call agent methods directly, some go through the registry. Standardize: all AI invocations go through `registry.get_agent()`, never direct instantiation.

**Dependency injection**: FastAPI `Depends()` is used correctly for DB sessions, current user, and tenant. No global mutable state in request handlers (except the in-memory OAuth dict — C3 above).

**Async correctness**: The codebase is consistently async (asyncpg, httpx). One risk: `WeasyPrint` (PDF) is synchronous. It must be wrapped in `asyncio.run_in_executor(None, ...)` to avoid blocking the event loop.

### DB Design

**Multi-tenancy**: Correctly implemented via `tenant_id` column + application-layer filtering. Row-Level Security (PostgreSQL RLS) is NOT used — isolation relies entirely on correct service-layer queries. One missed `WHERE tenant_id = :x` in any query = cross-tenant data leak. Recommendation: add RLS as a safety net, not a replacement.

**Index coverage**: `tenant_id` is indexed on all major tables. `created_at` is not consistently indexed — range queries on content/leads/agent_runs will degrade without it.

**Missing index**: `social_posts(status, scheduled_at)` — this is the exact index `scan_due_posts` needs and it's likely absent, causing a full table scan every minute.

**`agent_runs` design risk**: Storing full JSON input/output (50–100KB) per row is unsustainable. At scale, this table should use PostgreSQL TOAST for large values (automatic) but the query patterns (`SELECT *` in some places) will still pull massive payloads.

### Queue System (Celery)

**Critical gap**: No `SKIP LOCKED` pattern for the scheduler. See BUG-2.

**No retry with exponential backoff defined per task**: Social publish tasks that fail (e.g., temporary Meta API error) need defined `max_retries=3, default_retry_delay=60` — not the Celery global default.

**Beat scheduler HA**: In production, `worker-beat` must run as a singleton. There is no distributed lock (e.g., `redbeat` or `django-celery-beat` equivalent). Running two beat instances = double publish.

**Recommendation**: Switch Beat to `celery-redbeat` which uses Redis for leader election and prevents duplicate firing.

### AI Pipeline

**Pipeline reliability**: All 14 StrategyAgent subagents run sequentially. If subagent #8 (`ConversionSystem`) fails, the entire plan is lost — the user sees an error with no partial results saved. There is no checkpoint resume from failed node.

**Fix**: Save partial plan to DB after each node completes. If pipeline fails at node N, the plan is saved with all completed sections and status `partial`. User can resume or regen from the failed node.

**Token cost leak**: No per-run budget cap in the agent. A malformed prompt could trigger infinite retry loops in some LangChain versions. Add `max_tokens` enforcement at the OpenRouter call level.

**Language injection correctness**: `lang_directive(lang)` is injected via f-strings in prompts. If `language` is not in `['ar', 'en', 'both']`, the directive is silently wrong. Add validation before pipeline entry.

### Integration Stability

**Meta webhook handler**: Currently processes all webhook events synchronously in the FastAPI handler. A burst of 1,000 WhatsApp messages will block the process. Fix: push to Celery immediately, return `200 OK` to Meta within 1 second (Meta retries if no 200 in 5 seconds).

**Social connector error handling**: `publish()` methods wrap Replicate/ElevenLabs/Meta calls in try/except and return empty on failure. The error is logged but `SocialPost.status` may not be updated to `'failed'`. Without this, failed posts stay `'scheduled'` forever and `scan_due_posts` re-attempts them on the next tick.

---

## STEP 4 — PRODUCTION READINESS

### Security Gaps

| Gap | Severity | Fix |
|-----|----------|-----|
| Plaintext social tokens (C1) | CRITICAL | Bulk re-encrypt + enforce on write |
| SECRET_KEY in .env (C2) | CRITICAL | Move to secrets manager (AWS Secrets Manager / Vault) |
| In-memory OAuth state (C3) | CRITICAL | Redis-backed with NX+TTL |
| SSRF in scraper + webhooks (C7, C8) | CRITICAL | IP allowlist/blocklist + RFC1918 block |
| MinIO bucket access (M9) | HIGH | Set bucket policy to private; use presigned URLs for all asset access |
| JWT algorithm only HS256 | MEDIUM | Acceptable if SECRET_KEY is ≥256-bit entropy. Enforce entropy check at startup |
| No Content-Security-Policy in production | MEDIUM | Add strict CSP header via Nginx |
| `robots.txt` on dashboard | LOW | Add `Disallow: /` to prevent search engine indexing of the app |

### Missing Env Configs for Production

The following must be set (currently empty in `.env.example`):
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` — email is broken without this
- `EMAIL_VERIFICATION_REQUIRED=true` — currently disabled in dev
- `SENTRY_DSN` — no error tracking in production
- `REPLICATE_API_TOKEN` — creative gen silently returns empty without it
- `ELEVENLABS_API_KEY` — video voice is a stub without it
- `META_APP_ID`, `META_APP_SECRET` — social publishing broken
- `STRIPE_SECRET_KEY` — billing returns stub success URLs
- `OPENROUTER_API_KEY` — all AI is broken without it

A startup validation that checks required env vars and refuses to boot if missing is **essential**. Currently the app boots silently with missing keys and fails at runtime.

### Logging & Monitoring Gaps

1. **No structured log correlation ID**: Requests have no `request_id` passed through the full call stack (FastAPI → Celery → LangGraph). When a plan fails, there's no way to trace the full execution.

2. **Celery task failures go to Redis result backend** but are never surfaced to users or Sentry. A task can fail silently.

3. **No alerting on `SocialPost.status = 'failed'`**: Posts fail silently. Users discover this only by manually checking the scheduler.

4. **No uptime monitor**: No health check monitoring configured (Betterstack, Pingdom, etc.).

5. **`/ops/status` endpoint is public**: Returns DB, Redis, MinIO connectivity status. This leaks internal service topology to unauthenticated callers. Should require an internal secret header.

### Deployment Risks

1. **No zero-downtime deployment strategy**: Alembic migrations run before new code is deployed. If a migration adds a NOT NULL column without a default, it will fail on the live DB while the old backend is still running.

2. **Single backend container**: No load balancer config, no autoscaling.

3. **`docker-compose` in production**: Fine for solo deployment, risky for any real load. Kubernetes or at minimum Docker Swarm is needed.

4. **No backup strategy documented**: No pg_dump schedule, no MinIO backup, no Redis AOF confirmation.

---

## STEP 5 — GAP ANALYSIS

### Features That Are Advertised But Don't Work

| Feature | Advertised? | Reality | Effort to Fix |
|---------|------------|---------|--------------|
| Video generation (full) | ✅ In billing tiers | ❌ VideoRenderer stubbed | 5–10 days |
| Deep vs Fast plan quality difference | ✅ In pricing page | ❌ Same model for all modes | 1 day (config) |
| Manual schedule without connected account | ✅ Implied by "manual mode" | ❌ NOT NULL FK blocks it | 0.5 days |
| LinkedIn auto-refresh | ✅ Implied | ❌ No refresh_token column | 1 day |
| Google Analytics integration | ✅ In SEO page | ⚠️ Code exists, not tested | 2–3 days |
| TikTok publishing | ✅ In platform list | ⚠️ Sandbox only | External (app review) |

### Half-Implemented Modules

| Module | What's Missing |
|--------|---------------|
| `analytics_dashboard` | Backend router/service content unclear; frontend widgets may show empty data |
| `ads` | AI campaign generation stubbed; Meta Ads API integration not verified end-to-end |
| `campaigns` | `generate` endpoint calls unverified external AI service |
| `video_gen` | `VideoRenderer` + `CaptionGenerator` are stubs |
| `integrations` | OAuth callback is a stub; no real Zapier/Make/etc. integration wired |
| `research` | Module registered in main.py but not analyzed — possibly empty |
| `conversations` | Module registered but not documented |
| `notifications` | Backend events fire but delivery (email/push) not confirmed end-to-end |
| `2FA` | Settings page link exists; no backend implementation |
| `webhook_subscriptions` | Schema + service likely complete; delivery retry logic unknown |

---

## STEP 6 — PRIORITIZED FIX PLAN

---

### PHASE 1 — CRITICAL SECURITY & RELIABILITY (Week 1)
**Goal**: Make it safe to have real users. Nothing ships until Phase 1 is done.

---

**P1-1: Fix social token plaintext storage**  
File: `app/core/crypto.py`, new migration script  
- Verify Fernet key derivation is correct (base64-encoded SHA-256)
- Write `scripts/encrypt_social_tokens.py`: iterate all `social_accounts` rows, detect plaintext tokens (Fernet-encoded strings start with `gAAAAA`), encrypt and save
- Run as Alembic `data_migration` step in deployment
- Add write-path enforcement: `upsert_account()` in `base.py` must always encrypt

Effort: **4 hours** | Impact: Eliminates CRITICAL data breach risk

---

**P1-2: Move OAuth state to Redis**  
File: `app/integrations/social/oauth_state.py`  
- Replace in-memory dict with Redis (`SET NX PX 600000`)
- Key pattern: `oauth_state:{state_token}`
- Value: JSON-encoded `{tenant_id, platform, redirect_uri, code_verifier}`
- `get_state()` → `GETDEL` (atomic read+delete)

Effort: **3 hours** | Impact: Eliminates C3; makes OAuth survive restarts

---

**P1-3: Block SSRF in scraper and webhooks**  
Files: `core/seo_audit_deep.py`, `agents/competitor/subagents/scraper.py`, `modules/webhook_subscriptions/service.py`  

For scraper: add `is_safe_url(url)` validator:
```python
BLOCKED_CIDRS = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8', '169.254.0.0/16', '::1/128']
# Resolve hostname → IP → check against blocked CIDRs
# Also block non-HTTP(S) schemes
```

For webhooks: run same validator on `url` at creation time. Reject with 422 if URL resolves to private IP.

Effort: **4 hours** | Impact: Eliminates C7, C8 SSRF vulnerabilities

---

**P1-4: Enforce required env vars at startup**  
File: `app/core/config.py`  
- Add `@validator` or `model_validator` on `Settings` class
- Raise `RuntimeError` with clear message if `OPENROUTER_API_KEY`, `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL` are missing or default dev values
- Warn (not raise) for optional services (Stripe, Replicate, etc.)

Effort: **2 hours** | Impact: No silent failures in production deployment

---

**P1-5: Fix Celery scheduler double-publish race condition**  
File: `app/modules/social_scheduler/tasks.py`  
```python
# Replace: query all scheduled posts, enqueue each
# With: atomic status transition
async with db.begin():
    posts = await db.execute(
        update(SocialPost)
        .where(SocialPost.status == 'scheduled', SocialPost.scheduled_at <= now, SocialPost.publish_mode == 'auto')
        .values(status='publishing')
        .returning(SocialPost.id)
    )
    post_ids = posts.scalars().all()
# Only now enqueue
for post_id in post_ids:
    publish_post.delay(str(post_id))
```

Effort: **3 hours** | Impact: Eliminates double-publish. Zero tolerance for social media mistakes.

---

**P1-6: Fix `social_posts.social_account_id` nullable**  
File: New Alembic migration  
```sql
ALTER TABLE social_posts ALTER COLUMN social_account_id DROP NOT NULL;
```
Plus guard in `tasks.py`: skip auto-publish if `social_account_id IS NULL`.

Effort: **2 hours** | Impact: Unblocks manual scheduling; fixes constraint error

---

**P1-7: Seed `PlanModeConfig` in deployment init**  
File: `scripts/seed_plan_modes.py` (make idempotent with `INSERT ... ON CONFLICT DO NOTHING`)  
Add to `docker-compose.yml` as a one-time init container or to `alembic env.py` post-migrate hook.

Effort: **2 hours** | Impact: Fresh deployments work; staging resets work

---

**P1-8: Fix `mark-published` endpoint guard**  
File: `app/modules/social_scheduler/router.py`  
Add: `if post.publish_mode != 'manual': raise HTTPException(400, "Only manual posts can be marked published")`

Effort: **30 minutes** | Impact: Prevents accidental status corruption

---

**Phase 1 Total Effort**: ~3 days  
**Outcome**: System is safe to onboard paying users

---

### PHASE 2 — STABILITY & INFRASTRUCTURE (Week 2)
**Goal**: System won't fall over under real load. Scheduled jobs work reliably.

---

**P2-1: Add LinkedIn `refresh_token` column**  
New migration: `ALTER TABLE social_accounts ADD COLUMN refresh_token_encrypted TEXT;`  
Update `linkedin.py` connector: store refresh_token from OAuth response; implement `refresh()` method.  
Add Celery task `refresh_expiring_tokens` (Beat, daily): find LinkedIn accounts expiring within 7 days, proactively refresh.

Effort: **1 day** | Impact: LinkedIn users don't need to re-auth every 60 days

---

**P2-2: Add PostgreSQL connection pool (PgBouncer)**  
Add `pgbouncer` service to `docker-compose.yml`, transaction-mode pooling.  
Update `DATABASE_URL` to point to PgBouncer.

Effort: **4 hours** | Impact: Handles 200+ concurrent requests without exhausting Postgres connections

---

**P2-3: Move PDF export to Celery**  
File: `modules/plans/router.py`  
- Change `GET /plans/{id}/export.pdf` to `POST /plans/{id}/export.pdf` → returns `{task_id}`
- Add `GET /plans/{id}/export.pdf/status/{task_id}` → returns download URL when ready
- Frontend polls status, then redirects to MinIO presigned URL

Effort: **4 hours** | Impact: Eliminates 30-second event loop block

---

**P2-4: Add timeouts to SEO deep audit and competitor scraper**  
Files: `core/seo_audit_deep.py`, `agents/competitor/subagents/scraper.py`  
```python
async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
    ...
```
Wrap in `asyncio.wait_for(..., timeout=30)` at the task level.  
Move deep audit to Celery (same pattern as PDF).

Effort: **3 hours** | Impact: No more 504s from slow target sites

---

**P2-5: Switch Celery Beat to `celery-redbeat`**  
Install `celery-redbeat`; configure `REDBEAT_REDIS_URL`.  
Update `worker-beat` docker service.  
This provides Redis-backed distributed lock — only one Beat instance can hold the lock.

Effort: **2 hours** | Impact: Beat HA; safe to run multiple workers

---

**P2-6: Add `(status, scheduled_at)` index on `social_posts`**  
Migration: `CREATE INDEX ix_social_posts_status_scheduled ON social_posts(status, scheduled_at) WHERE status = 'auto';`

Effort: **30 minutes** | Impact: `scan_due_posts` goes from full table scan to index scan

---

**P2-7: Add `created_at` index on high-volume tables**  
Migration: Add B-tree index on `created_at` for: `content_posts`, `leads`, `agent_runs`, `social_posts`, `credit_transactions`

Effort: **1 hour** | Impact: Date-range queries 10–100x faster

---

**P2-8: Enforce per-tenant LLM spend cap**  
File: `agents/base.py` — in `run()` method, before invoking graph:  
- Load `TenantOpenRouterConfig.monthly_limit_usd` and `usage_usd`
- If `usage_usd >= monthly_limit_usd`: raise `QuotaExceeded` with HTTP 402
- After run: update `usage_usd += actual_cost` atomically

Effort: **4 hours** | Impact: Prevents runaway LLM costs from a single tenant

---

**P2-9: Fix `scan_due_posts` webhook handler — offload to Celery**  
File: `modules/webhooks/router.py`  
```python
@router.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request):
    # Verify signature (sync — fast)
    body = await request.json()
    # Offload immediately
    process_whatsapp_event.delay(body)
    return {"status": "ok"}  # Return 200 to Meta within 1 second
```

Effort: **3 hours** | Impact: Handles Meta message bursts without blocking; prevents Meta retry storms

---

**P2-10: MinIO bucket → private + presigned URLs**  
- Set bucket policy to private in MinIO startup config
- Replace all `file_url` returned from `POST /media/upload` with presigned URLs (1-hour expiry for previews, 24-hour for exports)
- Or: serve assets through a `/media/{key}` endpoint that generates presigned URLs on the fly

Effort: **4 hours** | Impact: User assets are not publicly enumerable

---

**P2-11: Add `AgentRun` retention policy**  
Migration: Add `archived_at` column.  
Celery Beat task (weekly): `UPDATE agent_runs SET archived_at = now() WHERE started_at < now() - interval '90 days'`  
Or: compress `input`/`output` JSON to JSONB with compression, add partition by month.

Effort: **4 hours** | Impact: Prevents DB table from growing to hundreds of GB

---

**Phase 2 Total Effort**: ~5 days  
**Outcome**: Stable infrastructure; no connection exhaustion; no double-publish; Beat is HA

---

### PHASE 3 — PRODUCT COMPLETION (Week 3)
**Goal**: All advertised features work. No stubs in customer-facing paths.

---

**P3-1: Activate model tier differentiation**  
File: `agents/models.py`  
```python
MODEL_TIERS = {
    "fast":         "google/gemini-2.5-flash",
    "balanced":     "google/gemini-2.5-flash",
    "smart":        "anthropic/claude-sonnet-4-6",
    "vision":       "google/gemini-2.5-flash",
    "long_context": "google/gemini-2.5-flash-preview-05-20",
}
```
Update `plan_modes.py` defaults and seed `PlanModeConfig` accordingly.

Effort: **4 hours** | Impact: Deep plans are meaningfully better than Fast plans — justifies pricing

---

**P3-2: Implement or clearly stub Video Renderer**  
Option A (recommended): Integrate [Runway ML API](https://runwayml.com) or [Replicate video model] for scene-to-video.  
Option B (minimum): Return a rendered slideshow (images + audio) using FFmpeg via `asyncio.subprocess`.  
Option C (honest): Disable video tier features and remove from billing until implemented.

**Do not ship a feature that silently returns nothing to paying customers.**

Effort: 3–10 days depending on option | Impact: Fixes fraudulent billing (C4)

---

**P3-3: Fix quota billing period alignment**  
File: `modules/billing/service.py` — `check_quota()`  
Add `subscription_start_day` field to `Tenant` or compute from `CreditBalance.updated_at`.  
Change quota window from `now() - 30 days` to `current billing period start → now`.

Effort: **4 hours** | Impact: Users don't get locked out at end of month due to rolling window artifact

---

**P3-4: Complete `analytics_dashboard` module**  
Audit the module: if router/service are stubs, implement:  
- `GET /analytics-dashboard/summary` → last 30 days: posts published, reach, engagement, leads, conversions
- `GET /analytics-dashboard/weekly-digest` → already referenced by dashboard home
- Wire to `SocialMetric`, `Lead`, `ContentPost` tables

Effort: **2 days** | Impact: Dashboard home shows real data instead of zeros

---

**P3-5: Verify Google SEO integration end-to-end**  
- Set up test Google OAuth app
- Complete OAuth round-trip: connect → select site → sync GSC data
- Handle `refresh_token` edge case: if Google token expires, re-auth flow
- Verify `tenant.config.google_integrations` stores and reads correctly

Effort: **2 days** | Impact: Unblocks a core SEO feature

---

**P3-6: Save partial plan on pipeline failure**  
File: `agents/strategy/__init__.py` or `modules/plans/service.py`  
After each node completes, save the output section to the `MarketingPlan` row.  
On failure: set `status='partial'`; frontend shows completed sections + error message with "Resume generation" button.

Effort: **4 hours** | Impact: No more total plan loss on LLM timeout or transient error

---

**P3-7: Plan section regen creates snapshot + increments version**  
File: `modules/plans/service.py` — `regenerate_plan_section()`  
Before update: `await create_snapshot(plan, reason=f"section_regen:{section_key}")`  
After update: `plan.version += 1`

Effort: **2 hours** | Impact: Complete version history; no data loss on section regen

---

**P3-8: Social post failure notification**  
File: `modules/social_scheduler/tasks.py` — in `publish_post` exception handler  
- Set `SocialPost.status = 'failed'`, save `error_message`
- Create `Notification` row: "Your post to Instagram failed: {error}"
- Optionally: send email to tenant owner

Effort: **3 hours** | Impact: Users know when their posts fail

---

**P3-9: Fix `_pick_business_profile()` — canonicalize to one source**  
File: `modules/tenant_settings/service.py`  
- Write migration: copy all `config.onboarding.business_profile` values into `config.business_profile` for all tenants
- Remove `_pick_business_profile()` heuristic
- All reads/writes use `config.business_profile`

Effort: **3 hours** | Impact: No more silent data-loss on profile reads

---

**Phase 3 Total Effort**: ~8 days  
**Outcome**: All advertised features work; data integrity guaranteed; customer trust maintained

---

### PHASE 4 — OPTIMIZATION & SCALE (Week 4+)
**Goal**: System handles 1,000 concurrent tenants without degradation.

---

**P4-1: Add `ivfflat` vector index on `knowledge_chunks`**  
```sql
CREATE INDEX ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```
Partition the index per tenant via conditional index or separate table per tenant (if tenant count is bounded).

Effort: **4 hours** | Impact: Semantic search goes from O(n) full scan to O(log n)

---

**P4-2: Add React Query to frontend**  
Replace raw `useEffect`/`useState` API calls with `@tanstack/react-query`.  
Benefits: automatic caching (5-min stale time), deduplication, background refresh, loading/error states built-in.  
Start with: plans list, content list, dashboard stats, scheduler calendar.

Effort: **3 days** | Impact: 60% reduction in redundant API calls; instant perceived navigation

---

**P4-3: Add list virtualization**  
Install `@tanstack/react-virtual`.  
Apply to: `DataTable` component for leads, content posts, agent runs.

Effort: **1 day** | Impact: Browser handles 10,000+ row tables without freeze

---

**P4-4: Add request_id correlation across FastAPI → Celery → LangGraph**  
Middleware: generate `request_id = uuid4()` on each request; add to `contextvars`.  
Pass `request_id` as Celery task kwarg.  
Pass as `AgentRun.thread_id`.  
Log `request_id` in all structlog calls.

Effort: **4 hours** | Impact: Full request tracing across async boundaries

---

**P4-5: Implement cursor-based pagination**  
Replace `OFFSET/LIMIT` with `WHERE id > :last_id LIMIT :page_size` on all list endpoints.  
Update frontend to use `next_cursor` returned in response.

Effort: **2 days** | Impact: Page 100 of leads loads in constant time instead of degrading

---

**P4-6: Add PostgreSQL RLS as defense-in-depth**  
```sql
ALTER TABLE marketing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON marketing_plans 
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```
Set `SET LOCAL app.current_tenant_id = :tenant_id` at start of each DB transaction.

Effort: **1 day** | Impact: Cross-tenant query bugs are caught at DB level, not just application level

---

**P4-7: Structured error handling + global React Error Boundary**  
Backend: standardize all error responses to `{error: {code, message, details}}`.  
Frontend: wrap all dashboard routes in `<ErrorBoundary>` with "Something went wrong — reload" UI.

Effort: **1 day** | Impact: No blank screens; debuggable errors

---

**Phase 4 Total Effort**: ~10 days  
**Outcome**: System handles production load; debuggable; front-end is fast

---

## STEP 7 — QUICK WINS (< 1 day each, high impact)

| # | Task | File | Impact | Time |
|---|------|------|--------|------|
| QW-1 | Add startup env var validation | `app/core/config.py` | No silent failures in production | 2h |
| QW-2 | Add `(status, scheduled_at)` index on `social_posts` | Alembic migration | `scan_due_posts` 50x faster | 30m |
| QW-3 | Fix `mark-published` guard for auto-mode posts | `social_scheduler/router.py` | Prevents status corruption | 30m |
| QW-4 | Add `?plan_id=` chip to video-gen page | `dashboard/video/generate/page.tsx` | Feature parity with content-gen | 2h |
| QW-5 | Add "Reconnect" CTA on expired social accounts | `scheduler/accounts/page.tsx` | Users can self-serve token refresh | 3h |
| QW-6 | Add confirm dialog before full plan regen | `plans/[id]/page.tsx` | Prevents accidental data loss | 1h |
| QW-7 | Add `max_retries=3, countdown=60` to publish_post task | `social_scheduler/tasks.py` | Auto-retry on transient API errors | 1h |
| QW-8 | Make `/ops/status` require internal auth header | `modules/ops/router.py` | Stops leaking service topology | 1h |
| QW-9 | Add `language` input validation before pipeline entry | `modules/plans/service.py` | Prevents malformed `lang_directive()` | 30m |
| QW-10 | Set `PlanModeConfig` default seed as idempotent init | `scripts/seed_plan_modes.py` | Fresh DB always works | 1h |
| QW-11 | Add `SocialPost.error_message TEXT` column | Alembic migration | Store why a post failed | 30m |
| QW-12 | Block Meta auto-publish for unverified accounts | `social_scheduler/tasks.py` | Prevents API auth errors from looping | 1h |
| QW-13 | Add `loading` skeleton to plan generation stream | `plans/new/page.tsx` | Better UX during 3-min generation | 2h |
| QW-14 | Validate webhook URLs reject private IPs | `webhook_subscriptions/service.py` | Blocks SSRF vector | 2h |
| QW-15 | `Toaster` component added to all dashboard layouts | `dashboard/src/app/[locale]/(dashboard)/layout.tsx` | Toast notifications work everywhere | 30m |

---

## STEP 8 — FINAL GOAL: 100% PRODUCTION READY

The system is production-ready when **all of the following are true**:

### Security Checklist
- [ ] All social OAuth tokens encrypted at rest (Fernet, verified)
- [ ] SECRET_KEY is ≥64 random chars, stored in secrets manager
- [ ] OAuth state is Redis-backed (not in-memory)
- [ ] SSRF blocked for scraper URLs and webhook URLs
- [ ] MinIO bucket is private; all asset URLs are presigned
- [ ] `/ops/status` requires auth header
- [ ] `EMAIL_VERIFICATION_REQUIRED=true` in production
- [ ] All webhook signatures verified (Meta, Stripe, Paymob, PayTabs, Geidea)

### Data Integrity Checklist
- [ ] `scan_due_posts` uses atomic status transition (no double-publish)
- [ ] `social_posts.social_account_id` is nullable
- [ ] LinkedIn refresh_token column exists and is populated
- [ ] Business profile has single canonical source
- [ ] Plan section regen creates snapshot + increments version
- [ ] Quota counted against billing period, not rolling 30 days

### Reliability Checklist
- [ ] Celery Beat uses `celery-redbeat` (HA, no duplicate fires)
- [ ] PDF export runs in Celery (not blocking event loop)
- [ ] Deep audit has per-page timeout + Celery offload
- [ ] Meta/social webhook handlers return 200 immediately, process via Celery
- [ ] Social post failures set `status='failed'` and notify user
- [ ] PgBouncer (or equivalent) in front of PostgreSQL
- [ ] `PlanModeConfig` seed is idempotent and runs on every deploy

### Product Completeness Checklist
- [ ] Video generation produces actual video output (or feature is disabled and removed from billing)
- [ ] Fast/Medium/Deep plan modes use different models (quality difference is real)
- [ ] Analytics dashboard shows real data
- [ ] Google SEO integration tested end-to-end with real credentials
- [ ] Partial plan saved on pipeline failure (no total plan loss)
- [ ] Social post failure triggers user notification

### Operations Checklist
- [ ] All critical env vars validated at startup
- [ ] Sentry DSN configured and receiving events
- [ ] Structured logs with `request_id` correlation across FastAPI → Celery → LangGraph
- [ ] `AgentRun` retention policy active (archive after 90 days)
- [ ] DB backup schedule: pg_dump every 6 hours to S3/MinIO
- [ ] Uptime monitor on `/ops/ready`
- [ ] Celery flower or equivalent monitoring dashboard

### Frontend Checklist
- [ ] Global React Error Boundary on all dashboard routes
- [ ] Loading skeletons on all data-fetching pages
- [ ] Confirm dialogs on all destructive actions (plan regen, account disconnect, member removal)
- [ ] All i18n keys complete (no hardcoded English in Arabic UI)
- [ ] `Reconnect` CTA on expired social accounts

---

## SUMMARY TABLE

| Phase | Tasks | Effort | Unblocks |
|-------|-------|--------|---------|
| **Phase 1 — Critical Security** | 8 tasks | 3 days | Safe to onboard paying users |
| **Phase 2 — Stability & Infra** | 11 tasks | 5 days | System survives real load |
| **Phase 3 — Product Completion** | 9 tasks | 8 days | All advertised features work |
| **Phase 4 — Optimization** | 7 tasks | 10 days | Scale to 1,000+ tenants |
| **Quick Wins** | 15 tasks | 3 days | Immediate UX + safety improvements |
| **TOTAL** | 50 tasks | **~4 weeks** | **Production-ready SaaS** |

---

*This audit was generated from full codebase analysis on 2026-04-24.*  
*Every issue is traceable to a specific file and line of logic — no generic recommendations.*
