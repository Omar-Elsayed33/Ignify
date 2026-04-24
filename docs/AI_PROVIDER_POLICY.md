# AI Provider Policy — Ignify

**Last updated**: 2026-04-25 (Phase 11 — `standardize-openrouter-provider-and-key-naming`)

This document is the single source of truth for which AI providers Ignify is allowed to call, how tenant keys are provisioned, and what the long-term direction is.

---

## 1. Hard rule: text generation is OpenRouter-only

All LLM text generation (plan strategy, content copy, campaign planning, SEO analysis, creative briefs, prompt engineering, competitor analysis, AI assistant, guardrail review, etc.) MUST route through OpenRouter via the centralized `app.core.llm.get_llm` / `app.core.llm.get_llm_for_tenant` / `app.core.llm_json.llm_json` helpers.

### What this means in code

```python
# ✅ Correct
from app.core.llm import get_llm_for_tenant
llm = await get_llm_for_tenant(model="openai/gpt-4o", tenant_id=tid, db=db)

# ✅ Also correct — JSON helper
from app.core.llm_json import llm_json
plan = await llm_json(db, tid, system=..., user=..., model="anthropic/claude-sonnet-4-5")

# ❌ FORBIDDEN
from openai import OpenAI
from anthropic import Anthropic
import google.generativeai as genai
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
```

`ChatOpenAI` from `langchain_openai` IS allowed ONLY when instantiated with `base_url=settings.OPENROUTER_BASE_URL` and an OpenRouter API key — because OpenRouter is OpenAI-API-compatible. The centralized `get_llm()` helper already does this; callers should not construct `ChatOpenAI` themselves.

### Model naming

Use OpenRouter's canonical slugs (`provider/model-id`):

| Traditional name | OpenRouter ID |
|------------------|---------------|
| GPT-4o | `openai/gpt-4o` |
| Claude Sonnet 4.5 | `anthropic/claude-sonnet-4-5` |
| Gemini 2.5 Flash | `google/gemini-2.5-flash` |
| GPT-4o mini | `openai/gpt-4o-mini` |

A bare model name without `/` is auto-prefixed with `openai/` by `campaigns/router.py` and `seo/router.py` so admin-configured legacy model strings still work — but new code should always use the full OpenRouter ID.

---

## 2. OpenRouter key architecture

Three distinct keys. Don't mix them up:

| Key | Purpose | Where it lives |
|-----|---------|----------------|
| **Manager / Provisioning key** | Creates and manages tenant sub-keys | `OPENROUTER_MANAGER_KEY` env var. Used only by `app.core.openrouter_provisioning`. Never reused for inference. |
| **Master / Platform fallback** | Inference when a tenant has no provisioned sub-key yet | `OPENROUTER_API_KEY` env var. Used by `get_llm` when tenant config has no `openrouter_key_encrypted`. |
| **Tenant sub-key** | Per-tenant inference with monthly cap | `TenantOpenRouterConfig.openrouter_key_encrypted` (Fernet-encrypted). Created via the manager key; used by `get_llm_for_tenant`. |

### Sub-key naming rule (Phase 11)

OpenRouter sub-keys are named **exactly the tenant UUID** — nothing else:

```python
# app/core/openrouter_provisioning.py
def build_key_name(tenant_id: str) -> str:
    return str(tenant_id)  # canonical; no prefix, no truncation
```

Consequences:
- The OpenRouter dashboard shows `550e8400-e29b-41d4-a716-446655440000` as the key name.
- Our DB's `tenant_id` column and OpenRouter's key name are identical strings — trivial joining.
- No leak of company name or business identity to OpenRouter's metadata.
- No ambiguity between tenants (UUID is globally unique; `ignify-550e8400` prefix was unnecessary namespacing).

The `tenant_name` parameter of `provision_key()` is kept for the `label` field (OpenRouter's human-readable note in its UI) but does NOT affect the canonical `name`.

### Budget sync (Phase 7 + 11)

Per-tenant monthly dollar limit = `DEFAULT_PLANS[tier].limits.ai_budget_usd`, derived via `limit_for_plan(plan_slug)`. Synced to the OpenRouter sub-key's `limit` field on:

- Subscription activation (admin `set_tenant_subscription(active=True)`)
- Offline-payment approval
- Plan change (`set_tenant_plan`)
- Explicit admin re-provision

All three paths call `sync_tenant_budget_to_plan` → `update_tenant_plan_limit` → `update_key_limit` (OpenRouter `PUT /keys/{id}` with new limit).

---

## 3. Image generation: Replicate (interim, documented)

**Decision**: Image generation stays on Replicate for now.

### Why not OpenRouter

As of 2026-04, OpenRouter's image-model catalog is smaller and more expensive per unit than Replicate's. The existing Flux-Schnell / Flux-Dev / Flux-1.1-Pro routing (see `app/agents/creative/model_router.py`) is working well, cost-controlled (Phase 8), and budget-capped via `ai_budget.check()`.

### Migration path if / when we move

When OpenRouter image generation is ready:
1. Update `app/agents/creative/model_router.py` `_CATALOG` to map to OpenRouter image model slugs.
2. Replace `app/agents/creative/subagents/image_generator.py`'s `_call_replicate` with an OpenRouter images call (via a new `get_image_client` that mirrors `get_llm_for_tenant`).
3. Drop the `REPLICATE_API_TOKEN` env var and remove the `replicate` provider badge from `/ops/status`.
4. Keep the `cost_usd` tracking — `ai_budget.record()` already handles the ledger.

This is intentionally deferred. Attempting it before verifying OpenRouter image quality + availability would risk regressing creative output at scale.

### What IS required now

- Replicate calls continue to use the `REPLICATE_API_TOKEN` env var (not deprecated).
- The cost is recorded to the tenant's `ai_budget` ledger just like LLM spend — so the monthly cap works across both text and image.
- Image gen remains budget-gated via `ai_budget.check(feature="creative_gen.image")`.

---

## 4. Video generation: disabled

No policy change in Phase 11. Status unchanged from Phase 3:

- `POST /video-gen/generate` returns HTTP 503 with `code: video_generation_unavailable` unless `VIDEO_GEN_ENABLED=1`.
- `POST /video-gen/reel` returns HTTP 503 with `code: reel_slideshow_unavailable` unless `REEL_SLIDESHOW_ENABLED=1`.
- Both flags default to off. No quota consumed, no credit deducted.

When video renderer ships, it may use Replicate (image-to-video models), Runway, or an internal ffmpeg pipeline — not a policy question yet.

---

## 5. Embeddings: OpenAI direct (documented legacy)

`app/core/embeddings.py` uses `settings.OPENAI_API_KEY` for OpenAI embedding API calls (used by `knowledge_chunks` semantic search). This is **embeddings, not text generation** — the OpenRouter-only rule does not apply.

Rationale: OpenAI's `text-embedding-3-small` is $0.02 / 1M tokens, which is negligible compared to the LLM budget. Embeddings run asynchronously during knowledge-chunk import, not per-request, so per-tenant budget tracking would be overkill.

If OpenRouter adds first-class embedding support we may migrate. Until then, this is an acknowledged exception and NOT a blocker.

---

## 6. Deprecated env vars

Set to empty or leave unset. If set, the backend emits a WARN log at startup but still boots.

| Env var | Status | Used for |
|---------|--------|----------|
| `OPENAI_API_KEY` | Deprecated for text. Still used for embeddings. | Legacy — warn on boot |
| `ANTHROPIC_API_KEY` | DEPRECATED — do not set | — |
| `GOOGLE_API_KEY` | DEPRECATED — do not set | — |
| `GEMINI_API_KEY` | Never used. Remove if set. | — |
| `AGNO_RUNTIME_URL` | No longer needed after Phase 11. Was used by `campaigns/router.py` and `seo/router.py`. | — |

The warning strings are in `app/core/config.Settings.warn_deprecated_direct_providers`.

---

## 7. Required env vars (text generation)

| Env var | Required? | Purpose |
|---------|-----------|---------|
| `OPENROUTER_MANAGER_KEY` | Prod: Yes | Creates tenant sub-keys. Required for `provision_key()` to work. If empty, tenants fall back to the master key. |
| `OPENROUTER_API_KEY` | Yes | Master inference key. Fallback for tenants without sub-keys. |
| `OPENROUTER_BASE_URL` | Yes (default OK) | `https://openrouter.ai/api/v1` |
| `OPENROUTER_SITE_URL` | Yes | Passed as `HTTP-Referer` to OpenRouter — identifies your app. |
| `OPENROUTER_APP_NAME` | Yes | Passed as `X-Title` to OpenRouter — shows in their dashboard. |

---

## 8. Testing

The policy is enforced by three test families:

- `tests/unit/test_openrouter_key_naming.py` — `build_key_name(tid) == str(tid)` with no `ignify-` prefix, no truncation, identical across callers.
- `tests/integration/test_budget_sync_on_plan_change.py` — plan change flows through `update_tenant_plan_limit` → `update_key_limit` with the catalog's `ai_budget_usd`.
- `tests/unit/test_provider_audit.py` — grep-based regression check: no new code introduces a direct-provider SDK import outside of `app/core/llm.py` (OpenRouter via ChatOpenAI) and `app/core/embeddings.py` (OpenAI embeddings).

---

*If you're writing new code that calls an LLM and this doc isn't what you expected, check the source: `app/core/llm.py`, `app/core/llm_json.py`. Every text-generation path in Ignify goes through those two files.*
