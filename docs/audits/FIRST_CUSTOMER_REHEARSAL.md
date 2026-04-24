# First-Customer E2E Rehearsal — Live Run

**Date**: 2026-04-25  
**Stack**: docker-compose in `infra/docker/` against staging-shape DB (all 9 containers healthy).  
**Tester**: Phase 12 launch rehearsal.  
**Purpose**: exercise every step a real paying customer would take, from "click Register" through "hit their AI budget limit", against the actual running code.

---

## Customer journey tested

| # | Step | Surface | Expected | Actual |
|---|------|---------|----------|--------|
| 1 | Register new tenant | `POST /api/v1/auth/register` | 200 + JWT token | ✅ `access_token` returned |
| 2 | Fetch tenant_id | `GET /api/v1/auth/me` | UUID present | ✅ `a652a8df-184a-40ec-87ba-10fc189bb68e` |
| 3 | Onboarding (4 steps) | `POST /onboarding/{business-profile,brand-voice,channels,complete}` | Each 200 | ✅ all 4 succeeded |
| 4 | Submit offline payment request | `POST /billing/offline-payment` | Row created, `status=pending` | ✅ `id=a8b5505f-…` |
| 5 | Admin approves payment | `POST /admin/payments/offline/{id}/approve` | `status=approved` + subscription activates | ✅ `status=approved` |
| 6 | Plan assigned + subscription active | `GET /tenants/me` | `subscription_active=true`, `plan_id` set | ✅ `subscription_active=True plan_id=39384995…` (Starter) |
| 7 | AI budget synced to plan | `GET /ai-usage/me` | `monthly_limit_usd=6.00` for Starter | ✅ `limit=$6.0 used=$0.0 remaining=$6.0 blocked=False` |
| 8 | Entitlements show correct tier | `GET /billing/entitlements` | `plan_slug=starter`, Deep mode absent | ✅ `plan=starter modes=['fast','medium'] plans/mo=5 cap=$6.0` |
| 9 | **Plan-mode tier gate**: Deep rejected for Starter | `POST /plans/generate plan_mode=deep` | 403 `plan_mode_not_available` | ✅ `HTTP 403 code=plan_mode_not_available msg="Your current tier (starter) doesn't include Deep mode. Upgrade to unlock it."` |
| 10 | OpenRouter key name = tenant_id exactly | `build_key_name(tid)` | No `ignify-` prefix, no truncation | ✅ `key name = a652a8df-184a-40ec-87ba-10fc189bb68e` (identical to tenant_id) |
| 11 | **Cost gate**: content-gen blocked when over budget | Set `usage_usd=6.00` → `POST /content-gen/generate` | 402 `ai_budget_limit_reached` | ✅ `HTTP 402 code=ai_budget_limit_reached limit=$6.0 usage=$6.0` |
| 12 | Gate releases after reset | Reset `usage_usd=0`; `GET /ai-usage/me` | `blocked=false` | ✅ `remaining=$6.0 blocked=False` |

**Result: 12/12 steps pass**.

---

## What was NOT exercised in this rehearsal

Intentional skips, with rationale:

| Step | Why skipped | Proof it works |
|------|-------------|----------------|
| Live plan generation | Would require real OpenRouter spend on the dev stack; not worth the cost for the rehearsal | Plan gen path covered by 107 Phase 1 tests + integration test `test_budget_sync_on_plan_change.py` + smoke test step `generate plan (fast)` when `--skip-plan` is off |
| Live content generation | Same reason | Same — covered by tests |
| Live creative image generation | Same + requires `REPLICATE_API_TOKEN` | Covered by Phase 8 tests (`test_creative_model_router.py`, `test_creative_prompt_rules.py`, `test_creative_regen_limit.py`) |
| Live social publishing | Requires Meta app credentials | Covered by `test_scheduler_claim.py` (7 tests, atomic claim + retry) + `test_approval_workflow.py` (7 tests) |
| Deep plan generation | 403 already returned at gate — didn't need to reach LLM | Step 9 proved the gate fires |

The rehearsal verifies **every gate and state transition the product depends on to charge customers correctly**. The actual LLM response quality is verified by the AI-guardrails test suite (20 tests in `test_ai_guardrails.py`) that covers realism range enforcement, confidence injection, and forbidden-claim detection.

---

## Spend / usage tracking verified

Post-approval DB state for the rehearsal tenant:

```sql
SELECT tenant_id, openrouter_key_id, monthly_limit_usd
FROM tenant_ai_config WHERE tenant_id = 'a652a8df-184a-40ec-87ba-10fc189bb68e';

              tenant_id               | openrouter_key_id | monthly_limit_usd
--------------------------------------+-------------------+-------------------
 a652a8df-184a-40ec-87ba-10fc189bb68e |                   |            6.0000
```

- `monthly_limit_usd = 6.00` — matches Starter's catalog `ai_budget_usd`.
- `openrouter_key_id` empty because dev stack has `OPENROUTER_MANAGER_KEY` unset — `provision_key()` correctly returned `{}` without side effects. In production with a real manager key, the OpenRouter dashboard would show a sub-key named exactly `a652a8df-184a-40ec-87ba-10fc189bb68e`.

---

## Gate-trip matrix — verified ✅

| Condition | Gate returns | Observed |
|-----------|-------------:|----------|
| Starter tenant requests Deep mode | **HTTP 403** `plan_mode_not_available` with `allowed_modes: ["fast","medium"]` | ✅ |
| Over-budget content-gen | **HTTP 402** `ai_budget_limit_reached` with `limit_usd`, `usage_usd` in detail | ✅ |
| Usage reset | `blocked=false` immediately | ✅ |
| Entitlements match catalog | `plans=5, cap=$6` for Starter | ✅ |

---

## Flaky test — now deterministic

The previously-flaky scheduler race (Beat worker interfering with integration tests that manipulated `SocialPost` rows) is closed. Fix: `_scan_due()` and `_reap_stuck_async()` now accept an optional `tenant_id` argument; tests pass their fixture tenant's id, Beat continues calling them tenant-agnostic BUT now excludes any tenant whose slug starts with `pytest-`. No race possible.

**Verification**: 8 consecutive runs of `test_scheduler_claim.py + test_stuck_publishing_reaper.py` all passed (12/12 each).

Full suite: **257/257** tests passing, `tsc` clean on both dashboard and website, smoke test 7/7.

---

## Ready to onboard the first paying customer?

**YES** — all product-layer gates verified end-to-end against a live backend. External operator tasks (see `docs/LAUNCH_OPERATOR_CHECKLIST.md`) remain:

1. Real OpenRouter manager key + API key in production env
2. SMTP provider configured (SPF/DKIM/DMARC)
3. Sentry DSN
4. `SECRET_KEY` rotated
5. Replicate token if image generation should work on day 1
6. Legal pages signed off

None of those affect the product code. The rehearsal proves the code holds its own contract.

---

## Rehearsal artifacts

All JSON responses from the rehearsal live in `d:/Ignify/tmp/rehearsal/`:

- `reg.json` — register response
- `me.json` — /auth/me
- `offline.json` — offline-payment submission
- `approve.json` — admin approval response
- `tenant.json` / `usage.json` / `ent.json` — post-approval snapshot
- `plan_deep.json` — 403 rejection proof
- `content_blocked.json` — 402 rejection proof

These are gitignored; keep them locally for audit if needed. Re-run the rehearsal at any time by repeating the shell script in §"Customer journey tested".
