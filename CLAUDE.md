# Ignify — Project Guide for Claude

Ignify is an AI-powered marketing SaaS platform (forked from URTWIN). Built with FastAPI + Next.js 15 + LangGraph + OpenRouter, running in Docker.

This file is the canonical project brief. Read it at the start of every session.

Last updated: 2026-04-17 (post-wave-3 expansion)

---

## 1. Architecture at a Glance

```
d:/Ignify/
├── services/backend/              # FastAPI + SQLAlchemy 2 (async) + LangGraph
│   ├── app/
│   │   ├── agents/                # LangGraph agents (per-domain pipelines)
│   │   │   ├── base.py              # BaseAgent state machine
│   │   │   ├── registry.py          # get_agent(name)
│   │   │   ├── plan_modes.py        # fast/medium/deep mode → model mapping
│   │   │   ├── checkpointer.py      # LangGraph checkpoint persistence
│   │   │   ├── tracing.py           # OpenTelemetry stub
│   │   │   ├── strategy/subagents/  # 14-agent marketing-plan pipeline
│   │   │   ├── content/subagents/   # copywriter, blogger, caption_writer, translator, brand_guard
│   │   │   ├── creative/subagents/  # prompt_engineer, style_picker, brand_guard, image_generator
│   │   │   ├── video/subagents/     # script, scenes, voice, captions, renderer
│   │   │   ├── analytics/subagents/ # metrics, insights, report
│   │   │   ├── inbox/subagents/     # classifier, responder, escalator, kb_retriever
│   │   │   ├── seo/ ads/ competitor/ lead/
│   │   │
│   │   ├── integrations/social/   # Per-platform connectors (Protocol-based)
│   │   │   ├── base.py              # SocialConnector Protocol, TokenBundle, upsert_account
│   │   │   ├── registry.py          # {SocialPlatform → connector instance}
│   │   │   ├── oauth_state.py       # in-memory state store (10-min TTL)
│   │   │   └── meta | linkedin | x | youtube | tiktok | snapchat .py
│   │   │
│   │   ├── modules/               # feature modules (router + service + schemas)
│   │   │   ├── auth/              # register/login/me + PATCH /auth/me + data-export + audit-log
│   │   │   ├── tenants/ users/ team/ admin/
│   │   │   ├── plans/             # MarketingPlan CRUD + generate + pdf_import + context + seed-sample
│   │   │   ├── plan_versioning/   # snapshots / rollback (NEW wave 3)
│   │   │   ├── plan_share/        # rotating read-only tokens + public GET route (NEW wave 3)
│   │   │   ├── content/ content_gen/ content_templates/ experiments/
│   │   │   ├── creative/ creative_gen/ video_gen/ media/
│   │   │   ├── social/ social_scheduler/ channels/
│   │   │   ├── seo/               # audits + integrations (GSC/GA4)
│   │   │   ├── ads/ campaigns/ leads/ public_leads/
│   │   │   ├── analytics/ analytics_dashboard/
│   │   │   ├── competitors/ research/
│   │   │   ├── billing/           # Stripe, Paymob, PayTabs, Geidea + credits
│   │   │   ├── tenant_settings/   # business, brand, channels + NEW workflow (approval_required)
│   │   │   ├── onboarding/ white_label/
│   │   │   ├── ai_assistant/ assistant/ inbox/
│   │   │   ├── notifications/ integrations/ webhooks/ knowledge/ geo/ ops/
│   │   │   ├── feedback/          # /feedback/nps + /feedback/cancellation-reason (NEW wave 2)
│   │   │   ├── referrals/         # per-user code + redeem + convert (NEW wave 3)
│   │   │   ├── api_keys/          # tenant programmatic access keys (NEW wave 3)
│   │   │   ├── webhook_subscriptions/  # outgoing webhooks + HMAC signing (NEW wave 3)
│   │   │
│   │   ├── db/models.py           # 64+ SQLAlchemy models (added MarketingPlanSnapshot, Referral, ApiKey, Webhook)
│   │   ├── core/                  # security, llm, pdf, seo_audit, rate_limit, storage, …
│   │   │   ├── crypto.py            # Fernet encrypt/decrypt for social tokens (wave 1)
│   │   │   ├── logging_config.py    # structlog JSON + contextvars (wave 3)
│   │   │   ├── seo_audit_deep.py    # Multi-page crawl + LLM recommendations
│   │   │   └── (+ pdf, pdf_charts, meta_ads, embeddings, rbac, gating, …)
│   │   └── main.py                # FastAPI app + router registration
│   │
│   ├── alembic/versions/          # 14 migrations, latest: n4i5j6k7l8m9 (snapshots, referrals, api_keys, webhooks, nullable social_account_id)
│   └── scripts/smoke_test.py      # basic integration test (no unit-test suite yet)
│
├── dashboard/                     # Next.js 15 (App Router) + next-intl v3.25
│   ├── src/app/[locale]/
│   │   ├── (auth)/                # login, register (+ ?ref= capture), verify
│   │   ├── plans/public/[token]/  # NEW — unauthenticated read-only plan view (wave 3)
│   │   └── (dashboard)/
│   │       ├── dashboard/         # home (first-plan hero, weekly digest, action-needed, skip-ahead pill)
│   │       ├── onboarding/        # business / brand / channels / plan (+ progress bar)
│   │       ├── plans/             # list, [id], new, import (PDF), [id]/versions (NEW)
│   │       ├── content-gen/ content/ creative/generate/ video/generate/
│   │       ├── scheduler/         # week+month grid, new, accounts (OAuth)
│   │       ├── seo/my-site/       # Deep audit + GSC/GA4 integration UI
│   │       ├── competitors/ campaigns/ ads/ leads/
│   │       ├── analytics/ inbox/ conversations/ channels/
│   │       ├── team/ billing/ integrations/ notifications/
│   │       ├── changelog/ legal/privacy/ legal/terms/  # NEW
│   │       ├── settings/          # personal + business-profile + channels + team + white-label
│   │       │   + security + referrals + api-keys + webhooks  # NEW wave 2-3
│   │       ├── profile/ assistant/ help/
│   │
│   ├── src/components/            # Sidebar, DashboardHeader, Card, Button, DataTable, …
│   ├── src/lib/api.ts             # auth-aware fetch wrapper (handles FormData)
│   └── messages/{ar,en}.json      # i18n (ar is primary)
│
├── infra/docker/                  # docker-compose.yml
│                                  # postgres · redis · minio · backend · worker · worker-beat · dashboard · website
└── docs/
    ├── 00_ignify_full_project_plan.md
    ├── EXECUTION_PLAN.md · LAUNCH_CHECKLIST.md
    ├── SOCIAL_DEPENDENCIES.md     # scheduler + external API ownership + cost model
    ├── SOCIAL_PLATFORM_SETUP.md   # OAuth registration per platform
    ├── model-compare/             # LLM benchmark reports + pricing
    └── ENHANCEMENT_PLAN.md        # (see section 12) — roadmap for UX + business
```

---

## 2. Tech Stack Essentials

- **Backend**: Python 3.12, FastAPI 0.115, SQLAlchemy 2 (async), Alembic, asyncpg, Pydantic 2.10
- **AI**: OpenRouter as unified LLM gateway. Access via `anthropic/…`, `openai/…`, `google/…`
- **Agents**: LangGraph 0.2.60 — StrategyAgent (14 sub-agents), content (5), creative (4), video (6), analytics (3), inbox (5), seo/ads/competitor/lead
- **DB**: PostgreSQL 16 with pgvector (knowledge chunks + embeddings)
- **Queue**: Celery 5.4 + Redis (social publish, analytics aggregation, email)
- **Storage**: MinIO (S3-compatible) for images/videos/PDFs
- **Media**: Replicate (image gen), ElevenLabs (voice), Pillow, WeasyPrint (PDF), pypdf (read)
- **Frontend**: Next.js 15.1, React 19, TypeScript, Tailwind 4 (Material Design 3 tokens), Radix UI, Lucide, Recharts
- **State**: Zustand `auth.store` (user, tenant, tokens)
- **i18n**: next-intl v3.25 (`ar` default, `en` secondary)
- **Billing**: Stripe · Paymob (EG) · PayTabs (MENA) · Geidea + internal credits ledger
- **Observability**: Sentry SDK (optional)

---

## 3. Known Architectural Quirks

**MarketingPlan model — columns vs embedded fields.**
Not every plan section is its own DB column. These ARE columns:
`goals, personas, channels, calendar, kpis, market_analysis, ad_strategy,
positioning, customer_journey, offer, funnel, conversion, retention,
growth_loops, execution_roadmap, budget_monthly_usd, primary_goal, plan_mode, status, version`

These are NOT columns — they live inside `market_analysis` JSON or elsewhere:
- `swot` → `market_analysis.swot`
- `trends` → `market_analysis.trends`
- `competitors` → `market_analysis.competitors` + separate `Competitor` DB table
- `language` → NOT persisted on plan (passed per-request)

**Competitors live in two places, kept in sync:**
- `Competitor` DB table (scoped by tenant)
- `tenant.config.business_profile.competitors` (array of names)
- Syncing happens both ways via `tenant_settings.service.sync_competitors_to_profile` and `sync_profile_to_competitors`.

**Business profile lives in `tenant.config` JSONB:**
- Both `config.business_profile` (flat) and `config.onboarding.business_profile` (nested) are written.
- `_pick_business_profile()` picks whichever has more populated fields.
- Schema is `BusinessProfile` at [tenant_settings/schemas.py](services/backend/app/modules/tenant_settings/schemas.py) — includes `phone` and `business_email`.

**Plan-mode configs in DB:**
- `plan_mode_configs` table maps `(mode, subagent_name) → model`.
- Seeded with fast/medium/deep defaults for all 14 subagents.

**Social connectors live in [app/integrations/social/](services/backend/app/integrations/social/):**
- Uniform `SocialConnector` Protocol (`build_auth_url`, `exchange_code`, `publish`, `refresh`).
- Registry maps `SocialPlatform` → instance; `service.py` + Celery `tasks.py` delegate to it.
- Routes are generic: `/social-scheduler/oauth/{platform}/start` and `/callback`.
- Adding a new platform = one file + one line in `registry.py` + env vars in `config.py`.
- `GET /social-scheduler/connectors` reports which platforms are present + whether OAuth is configured on the server.
- **Platform status** (publish capability):
  - ✅ **Meta** (FB/IG Graph v19) — fully working
  - ✅ **LinkedIn** (API v2) — working, 60-day token TTL, `refresh_token` column TODO
  - ⚠️ **X/Twitter** (OAuth2+PKCE) — publishing requires $200/mo Basic tier
  - ⚠️ **YouTube** (Data API v3) — multipart upload (≤256 MB); resumable-upload TODO
  - ⚠️ **TikTok** (Content API v2) — sandbox only until app review approved
  - ❌ **Snapchat** — OAuth works, `publish()` raises `NotImplementedError` (no public API)

**Dual OAuth clients for Google:**
- `YOUTUBE_CLIENT_ID/SECRET` — YouTube publishing (scheduler)
- `GOOGLE_OAUTH_CLIENT_ID/SECRET` — Search Console + GA4 (seo/my-site)
- Intentional separation so YouTube scopes and analytics scopes don't collide.

**Token storage is currently plaintext** in `social_accounts.access_token_encrypted` despite the column name — encryption TODO before going live with real tenants.

---

## 4. Plan Generation — 14-Agent Pipeline

Pipeline order: market → audience → positioning → journey → offer → funnel → channels → conversion → retention → growth_loops → calendar → kpis → ads → execution_roadmap

- **fast mode**: gemini-2.5-flash, ~$0.012/plan, 3.2 min
- **medium mode**: gpt-4o, ~$0.38/plan, 2.6 min
- **deep mode**: claude-sonnet-4.5, ~$0.59/plan, 3.3 min
- Do NOT use opus-4.6 (scores lower at 250× cost) or gpt-5.2 (misses personas).
- See [docs/model-compare/MASTER_COMPARISON.md](docs/model-compare/MASTER_COMPARISON.md) + `PLAN_MODE_PRICING.md`.

**Customer pricing (subscription):** Starter $29/mo (20 fast), Pro $99/mo (30 medium + 10 fast), Agency $299/mo (50 deep + 50 medium).

---

## 5. Active Feature Map (what's live, what's stubbed)

### Fully working
- Multi-tenancy, auth (JWT + email verification), RBAC (owner/admin/editor/viewer/superadmin)
- Onboarding wizard (business → brand → channels → complete)
- Marketing plan generation (14 subagents, fast/medium/deep), PDF export, PDF import, section regen, full regen
- Content gen (articles/posts/captions, plan_id-aware)
- Creative gen (Replicate images, brand-guarded)
- Video gen (scripts + scenes, ElevenLabs voice, FFmpeg/Replicate assembly)
- Social scheduler (Celery-backed, auto/manual publish_mode, content_post linkage, week grid, accounts page with OAuth)
- SEO: per-page audit, deep multi-page audit + LLM recommendations, GSC + GA4 integration UI
- Competitors (CRUD + snapshot scraping, two-way sync with business_profile)
- Dashboard home, notifications, settings (personal + business + channels + team + white-label)
- Billing scaffolding (4 gateways + credits ledger)

### Partially shipped (needs finishing)
- **LinkedIn refresh tokens** — add `refresh_token` column to `social_accounts`, wire into connector
- **YouTube resumable upload** — large-video support (>256 MB)
- **Social token encryption** — rename-only today; real AES/KMS encryption is missing
- **Google SEO integrations end-to-end** — code paths built, round-trip not verified with real creds
- **TikTok content publishing** — works in sandbox; production needs app review

### Stubbed / minimal
- Unit tests (only `scripts/smoke_test.py`)
- `ads.agent` and some video sub-renderers have `pass` stubs
- Snapchat publishing (no public API; considered blocked, not a roadmap item)

---

## 6. Recently Completed Features (Session 2026-04-13 → 2026-04-17)

**Dashboard & navigation**
- Sidebar: clickable avatar popup (Edit Profile / Logout), Notifications link, Knowledge-Base removed.
- Settings rewritten to personal-profile page with quick-nav cards for business/channels/team/white-label. `PATCH /auth/me` added.
- Dashboard home cleaned (removed AI-Insight + Predictive-Model mocks), hero uses translated welcome, no username in H2.

**Onboarding**
- Plan step decoupled from generation — only calls `/onboarding/complete` and routes to dashboard.
- Channels selector: Website + Google Ads added at top.

**Marketing plans**
- SWOT renders as 2×2 colorful grid in Market tab.
- `RegenBtn` prompts for optional feedback note → `POST /plans/{id}/regenerate-section` with `note`.
- `POST /plans/{id}/regenerate` — full re-run with user note + prior-plan summary; status resets to draft.
- `business_profile.user_feedback` is injected so all 14 subagents pick it up via `{bp}` serialization.
- Approval-gate green panel links to `/content-gen?plan_id=`, `/creative/generate?plan_id=`, `/video/generate?plan_id=`.

**Plan context for generators**
- [plans/context.py](services/backend/app/modules/plans/context.py) `fetch_plan_context(...)` builds a compact context block (positioning + goals + personas + channels + offer + market summary).
- 3 generators accept `?plan_id=`, prefix brief with context; `metadata.plan_id` persisted on ContentPost.

**PDF import**
- [plans/pdf_import.py](services/backend/app/modules/plans/pdf_import.py) — `extract_pdf_text`, `analyze_plan_pdf` (LLM summary+strengths+weaknesses+improvements+detected_sections), `build_plan_from_pdf`.
- Endpoints: `POST /plans/pdf/analyze`, `POST /plans/pdf/import`.
- Page: `/plans/import` — upload → analysis → pick improvements → import as draft.

**Deep SEO audit**
- [core/seo_audit_deep.py](services/backend/app/core/seo_audit_deep.py) — homepage + up to 4 internal links in parallel, robots.txt + sitemap.xml checks, LLM pass (gpt-4o) returning 6–10 categorized recommendations (technical-seo / content / conversion / trust / technical) with priority + expected_impact + why + how.
- Endpoint: `POST /seo/audit/deep`. Persists `SEOAudit` row with `audit_type='deep'`.
- Frontend [seo/my-site/page.tsx](dashboard/src/app/[locale]/(dashboard)/seo/my-site/page.tsx) rewritten: hero, 4-card stat row, recommendations grid, site-issue cards, per-page drilldown, integration cards.

**Google Search Console + GA4 integration (built, needs real creds)**
- [seo/integrations.py](services/backend/app/modules/seo/integrations.py) — plain httpx (no google-* dependency).
- Storage: `tenant.config.google_integrations.{search_console,analytics}` holds tokens + `last_sync` + cached `sync_data`.
- In-memory OAuth state store (10-min TTL, same pattern as Meta OAuth).
- Scopes: `webmasters.readonly`, `analytics.readonly`, `openid`, `email`.
- Endpoints (all under `/seo/integrations`): status, connect, callback, disconnect, list+pick sites/properties, sync (last 28 days).
- Setup requirement (see Section 7 commands): set `GOOGLE_OAUTH_CLIENT_ID/SECRET` in `infra/docker/.env`.

**Scheduler ↔ content-gen linkage + manual/auto publish mode**
- Migration [m3h4i5j6k7l8](services/backend/alembic/versions/m3h4i5j6k7l8_social_post_content_link_publish_mode.py) added `content_post_id` (FK to content_posts, SET NULL) + `publish_mode` ('auto'|'manual', default 'auto') + `content_link` + `publish_status` to `social_posts`.
- `schedule_post` persists both fields. Manual mode can schedule without a connected account (falls back to a placeholder account row).
- Celery `scan_due_posts` filters `publish_mode == 'auto'` — manual posts never auto-publish.
- `POST /social-scheduler/scheduled/{id}/mark-published` — user confirms manual post, optionally attaches external URL.
- `list_scheduled` joins ContentPost titles and returns `content_post_id` + `content_post_title` + `publish_mode` per row.
- Page `/scheduler/new?content_post_id=…` prefills caption + platform from the linked ContentPost.
- `/scheduler` week grid shows content-post chip, publish-mode badge (⚡ auto / ✋ manual), and "نشرت" button on scheduled-manual posts.

**Competitors sync**
- Two-way sync between `/competitors` CRUD and `tenant.config.business_profile.competitors`.
- Enriched competitor-discovery prompt: passes `description`, `products`, `website` (not just name/industry).
- Placeholder filter (XYZ/ABC/example) server-side.

**Business profile**
- Fixed: `phone` and `business_email` are now in `BusinessProfile` Pydantic schema + `get_business_profile` return (were silently stripped before).

**EmptyState component**
- `icon` prop optional with `Inbox` fallback. Fixes runtime error in team page.

---

## 7. Common Tasks & Commands

```bash
# Run everything
cd /d/Ignify/infra/docker && docker compose up -d

# Restart single service (backend is volume-mounted; most changes reload live)
cd /d/Ignify/infra/docker && docker compose restart backend

# Install a new Python dep at runtime (until rebuild)
docker compose exec backend pip install <pkg>

# Run alembic migration
docker compose exec backend alembic upgrade head

# DB console
docker compose exec postgres psql -U ignify -d ignify

# Smoke test
docker compose exec backend python scripts/smoke_test.py
```

**Dashboard URL**: `http://localhost:3000` (`/ar/…` or `/en/…`)
**Backend URL**: `http://localhost:8000`
**Postgres**: `localhost:5432` (user `ignify`, pass `ignify_dev_2024`, db `ignify`)

---

## 8. User Preferences & Constraints

- **Language**: User writes in Arabic. All UI text should have Arabic translations. Default locale is `ar`.
- **Target audience**: End customer (business owner), not AI-literate. No A/B testing, no model picker, no "raw AI" controls. Users should just click "regenerate" and get something better.
- **Tone in code changes**: Minimal. Don't add features beyond what was asked. Don't add error handling for scenarios that can't happen. Don't leave TODOs or "backwards-compat" shims.
- **UI**: Material Design 3 tokens (`bg-surface-container-lowest`, `text-on-surface`, etc.). Brand gradient + shadows. RTL-aware with `rtl:rotate-180` on arrows.
- **Delegation**: When a feature has multiple large sub-parts, ship them one at a time, not in parallel. Each should be usable on its own.
- **DB reset**: Occasionally user says "need remove all data" — truncate tenant data (users, tenants, marketing_plans, etc.) but preserve seed tables (plans, plan_mode_configs, credit_pricing). Always confirm before running destructive SQL.

---

## 9. Files Referenced Often

- [Sidebar](dashboard/src/components/Sidebar.tsx) — main nav, user popup, language switcher
- [plans/[id]/page.tsx](dashboard/src/app/[locale]/(dashboard)/plans/[id]/page.tsx) — plan detail, tabs, RegenBtn, approval gate
- [plans/router.py](services/backend/app/modules/plans/router.py) — plan endpoints
- [plans/service.py](services/backend/app/modules/plans/service.py) — generate_plan, regenerate_plan_section, regenerate_full_plan, _STRATEGIC_KEYS
- [plans/context.py](services/backend/app/modules/plans/context.py) — build_plan_context for cross-generator use
- [plans/pdf_import.py](services/backend/app/modules/plans/pdf_import.py) — PDF → plan pipeline
- [core/seo_audit_deep.py](services/backend/app/core/seo_audit_deep.py) — deep audit crawler + LLM recs
- [seo/integrations.py](services/backend/app/modules/seo/integrations.py) — GSC + GA4 OAuth/sync
- [social_scheduler/service.py](services/backend/app/modules/social_scheduler/service.py) — scheduler logic, publish_mode
- [social_scheduler/tasks.py](services/backend/app/modules/social_scheduler/tasks.py) — Celery scan_due_posts
- [integrations/social/registry.py](services/backend/app/integrations/social/registry.py) — connector registration
- [tenant_settings/service.py](services/backend/app/modules/tenant_settings/service.py) — business profile, brand, competitors sync
- [ai_assistant/service.py](services/backend/app/modules/ai_assistant/service.py) — website analyze, discover competitors, logo colors
- [db/models.py](services/backend/app/db/models.py) — all SQLAlchemy models
- [messages/ar.json](dashboard/messages/ar.json) — Arabic translations

---

## 10. Deferred Roadmap (Engineering — most to least urgent)

Ship one at a time, never in parallel.

1. **End-to-end test of Google integrations with real creds** — OAuth round-trip, first real GSC/GA4 sync, handling refresh-token edge cases and site-verification gotchas.
2. **Social token encryption at rest** — currently plaintext in a misleadingly-named column. Block before real tenants onboard.
3. **LinkedIn refresh token persistence** — migration + connector update so users don't have to re-OAuth every 60 days.
4. **YouTube resumable upload** — replace multipart so >256 MB videos work.
5. **True-manual scheduling without any connected account** — `social_posts.social_account_id` is NOT NULL today; needs FK-nullable migration + UI/worker adjustments.
6. **Non-Meta auto-publish in production** — LinkedIn / X / TikTok publish paths are coded but only Meta is battle-tested on real posts.
7. **Unit/integration test suite** — `scripts/smoke_test.py` is the only coverage today.

---

## 11. Testing a Full Flow

1. Register a new user at `/ar/register`.
2. Complete onboarding (business → brand → channels → "ابدأ رحلتك").
3. Create a plan at `/ar/plans/new` (fast mode).
4. Review the plan, optionally regenerate sections with feedback notes.
5. Click "Approve" → green content-generation panel appears.
6. Click "إنشاء مقالات" → content-gen page opens with `?plan_id=` chip.
7. Brief → generate → resulting ContentPost has `metadata.plan_id`.
8. From content-gen result, "جدولة النشر" → `/scheduler/new?content_post_id=…` prefilled.

OR (PDF import path):

1. Register → onboarding.
2. `/ar/plans` → "استيراد PDF" → upload existing marketing plan PDF.
3. Review AI analysis (summary, strengths, weaknesses, improvements).
4. Check which improvements to apply → "استيراد مع تطبيق التحسينات" → creates plan as draft.

---

## 12. Enhancement Plan (UX + Business)

See [docs/ENHANCEMENT_PLAN.md](docs/ENHANCEMENT_PLAN.md) for the full phased roadmap covering:
- UX improvements (empty-states, guided first-plan, toasts, skeletons, keyboard nav, mobile)
- Feature depth (approvals, versioning, analytics drill-down, inbox automation)
- Business model (tiering, credit packs, annual discounts, agency seats, referral, white-label upsell)
- Growth loops (public template gallery, shared plans, affiliate program)
- Reliability (encryption, tests, observability, rate-limiting)

That file is the canonical roadmap. This section is just a pointer — do not duplicate content here.
