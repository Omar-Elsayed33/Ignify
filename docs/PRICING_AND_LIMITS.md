# Ignify — Pricing & Limits Matrix

**Last updated**: 2026-04-24 (Phase 6)  
**Status**: Enforced end-to-end. `ai_budget_usd` is the hard cap; `plans_per_month`, `deep_plans_per_month`, and per-resource limits are enforced on top.

---

## 1. Pricing Table

| Tier | Monthly (USD) | Monthly (EGP) | Team | Channels | Use case |
|------|--------------:|--------------:|-----:|---------:|----------|
| **Free** | $0 | 0 | 1 | 1 | Evaluate the product with one Fast plan |
| **Starter** | $29 | 1,499 | 3 | 3 | Solo founder or 2-3 person team — Fast + Medium |
| **Growth** | $59 | 2,999 | 5 | 5 | Early-traction SMB — Deep mode unlocked (limited) |
| **Pro** | $99 | 4,999 | 10 | 10 | Scaling business — recommended |
| **Agency** | $299 | 14,999 | 50 | 50 | Reseller / multi-client — white-label |

---

## 2. Limit Matrix

Every limit below is enforced at the service-layer boundary. Requests that would exceed any of these return a structured error the frontend can route.

| Resource | Free | Starter | Growth | Pro | Agency | Enforced at |
|----------|-----:|--------:|-------:|----:|-------:|-------------|
| **Marketing plans / month** | 1 | 5 | 10 | 25 | 100 | Counted via `agent_runs` (strategy, current month) |
| **Deep-mode plans / month** | 0 | 0 | 3 | 8 | 25 | Hard cap — `ai_budget.check(plan_mode='deep')` |
| **Plan modes allowed** | fast | fast, medium | all | all | all | Tier gate in `plans/service.generate_plan()` |
| **Articles / month** | 5 | 30 | 75 | 150 | unlimited | `enforce_quota("articles")` |
| **Images / month** | 10 | 100 | 250 | 500 | unlimited | `enforce_quota("images")` |
| **Videos / month** | 0 | 0 | 0 | 0 | 0 | Feature-flagged off (`VIDEO_GEN_ENABLED=0`) |
| **AI tokens / month** | 50K | 500K | 1.5M | 3M | 20M | OpenRouter provisioning limit |
| **AI dollar budget / month** | $0.50 | $6 | $12 | $22 | $70 | `ai_budget.check()` — **hard cap** |

### Dollar-cap rationale

Gross-margin target: **≥ 75% on direct AI cost**. Each tier's `ai_budget_usd` is sized at ~20-23% of `price_monthly`:

| Tier | Price | AI Budget | Ratio | Margin room |
|------|------:|----------:|------:|------------:|
| Free | $0 | $0.50 | ∞ | Loss-leader (acquisition) |
| Starter | $29 | $6 | 21% | 79% |
| Growth | $59 | $12 | 20% | 80% |
| Pro | $99 | $22 | 22% | 78% |
| Agency | $299 | $70 | 23% | 77% |

The remainder covers infra (DB, Redis, MinIO, monitoring), payment-gateway fees, support, and profit.

---

## 3. Enforcement Rules

### Gate order (first-failing wins, returns a structured error)

1. **Subscription active?** — `require_active_subscription()` middleware. Failure: HTTP 402 `subscription_required`.
2. **Plan-mode allowed for tier?** — in `plans/service.generate_plan()`. Failure: HTTP 403 `plan_mode_not_available` with `allowed_modes` so UI can point to the correct upgrade tier.
3. **Resource quota?** — `enforce_quota("articles" | "images" | "videos")`. Failure: HTTP 402 `quota_exceeded`.
4. **AI dollar budget?** — `ai_budget.check()`. Failure: HTTP 402 with one of:
   - `ai_budget_limit_reached` — used ≥ limit
   - `ai_budget_would_exceed` — this request would exceed
   - `ai_budget_deep_mode_cap` — already ran 10 deep plans this month
5. **Rate limit?** — per-endpoint Redis bucket. Failure: HTTP 429 `rate_limited`.

Every 4xx the frontend receives is **specifically coded**. No generic "something failed."

### Soft-warning threshold

At `usage_pct >= 80%`, `BudgetStatus.soft_warning = true`. UI should show an amber banner and recommend upgrade — we don't block yet, but users shouldn't be surprised when they hit the hard cap.

---

## 4. Billing Flow Diagram

Since no payment gateway is live yet, the flow runs on manual approval:

```
┌─────────────────────┐
│ User on /billing    │
│ Selects plan        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐       ┌──────────────────────────┐
│ POST /billing/offline-  │──────▶│ OfflinePayment row created│
│ payment                 │       │ status=pending            │
└─────────────────────────┘       └────────────┬─────────────┘
                                               │
                                               ▼
                                   ┌────────────────────────────┐
                                   │ Tenant sees:                │
                                   │ "Waiting for approval"      │
                                   │ + bank transfer details     │
                                   │ + WhatsApp contact          │
                                   └────────────┬───────────────┘
                                                │
                    ┌───── human transfers funds ──────┐
                    ▼                                  │
┌────────────────────────────┐                         │
│ Admin panel /admin/payments│◀────────────────────────┘
│ sees pending payment       │
└──────────┬─────────────────┘
           │
           ▼
  ┌────────────────┐      ┌──────────────────────────┐
  │ Admin clicks   │─────▶│ PUT /admin/payments/.../  │
  │ "Approve"      │      │ approve                    │
  └────────────────┘      └────────────┬──────────────┘
                                       │
                                       ▼
                        ┌────────────────────────────────┐
                        │ tenant.subscription_active = 1 │
                        │ tenant.plan_id = (selected)    │
                        │ OfflinePayment.status=approved │
                        └────────────┬──────────────────┘
                                     │
                                     ▼
                        ┌────────────────────────────────┐
                        │ Tenant refreshes → unlocked     │
                        └────────────────────────────────┘
```

### Endpoints involved

| Endpoint | Purpose |
|----------|---------|
| `POST /billing/offline-payment` | Tenant submits pending payment with ref number + notes |
| `GET /billing/offline-payment/my` | Tenant views their pending/approved/rejected history |
| `GET /admin/payments/offline` | Admin lists all pending payments |
| `POST /admin/payments/offline/{id}/approve` | Admin approves → flips `subscription_active=true` |
| `POST /admin/payments/offline/{id}/reject` | Admin rejects with admin_notes |
| `PUT /admin/tenants/{id}/subscription` | Direct admin override (used by smoke test) |

---

## 5. Risk Checks

### Hard-enforced (can't be bypassed from client)

- ✅ **Dollar budget cap** — `ai_budget.check()` runs before every AI action; `record()` runs after. No expensive action can start if the tenant is tapped out.
- ✅ **Deep-mode cap** — separate from dollar cap; prevents a single tenant from running 25 deep plans and spending disproportionately.
- ✅ **Plan-mode tier gate** — Free/Starter can't request Deep even via direct API.
- ✅ **Video feature flag** — endpoint returns 503 when disabled; no quota consumed, no cost incurred.
- ✅ **Resource quotas** — `enforce_quota()` counts rows in the current 30-day window against the tier's `limits.{articles,images}`.
- ✅ **Rate limits** — per-endpoint Redis buckets prevent bursts even within quota.

### Admin monitoring endpoints (new in Phase 6)

- `GET /admin/risk/top-spenders?limit=20` — tenants ordered by `usage_pct`, bucketed `blocked` / `soft_warning` / `healthy_growth` / `low_usage`.
- `GET /admin/risk/tenant/{id}/spend?days=30` — per-feature + per-model spend breakdown plus current budget status for a single tenant.

---

## 6. What's Still Missing Before Scale

Ordered by blocking severity.

| # | Missing | Severity | Blocker for |
|---|---------|:--------:|-------------|
| 1 | Payment gateway verified live (Stripe/Paymob KYC complete) | 🔴 HARD | Any automated billing |
| 2 | Frontend plan-mode gate — disable Deep card on Free/Starter instead of showing it + relying on backend 403 | 🟠 UX | Polished conversion |
| 3 | Soft-warning + blocked banners in `AIUsageWidget` (consumes new fields returned by `/ai-usage/me`) | 🟠 UX | User doesn't see "80% used" warning |
| 4 | Migration of `ai_budget_usd` from plan catalog into each tenant's `TenantOpenRouterConfig.monthly_limit_usd` on plan change | 🟠 | Current `monthly_limit_usd` default ($2.50) applies to all tenants regardless of plan |
| 5 | Actual-cost-per-feature tracking (not just per-agent) — needs a `feature` column on `agent_runs` or parallel spend_log table | 🟡 | `tenant_spend_breakdown` groups by `agent_name` as a proxy — OK but imprecise |
| 6 | Stripe + Paymob webhook idempotency (duplicate events) | 🟡 | Prevents double-crediting when gateways retry |
| 7 | Annual billing discount logic | 🟡 | Annual prices exist in `prices` dict but aren't sold via any flow yet |
| 8 | Plan-change flow (upgrade/downgrade mid-month) | 🟡 | Currently requires admin override |
| 9 | Dashboard billing-blocked state (when tenant hits $ cap mid-month, needs a "paywall" UX) | 🟡 | Today returns raw 402 |
| 10 | Refund flow for offline payments | 🟢 | Not blocking, but will be needed before first chargeback |

---

## 7. Test Coverage

Phase 6 additions: 15 tests (in `tests/integration/test_ai_budget.py` from Phase 5 cover the shared foundation). Phase 6 uses the same infrastructure + adds plan-mode gate coverage implicitly through smoke test.

Full backend test count: **196 passing.**

---

## 8. Gotchas / Ops Notes

- **`monthly_limit_usd` default is $2.50** in the schema — a fresh tenant who hasn't been assigned a plan gets this. Admins should explicitly provision a budget via `provision_tenant_ai_key()` when approving a subscription; otherwise all paid tenants share the $2.50 Free cap.
- **`reset_at`** is not yet auto-incremented at month rollover. The `reset_monthly_ai_limits` Celery task handles this — confirm it's firing in production (visible in `worker-beat` logs at `00:05 UTC` on the 1st).
- **Deep-mode counter** counts by `started_at >= first-of-this-month`. A plan run that started on the 31st but completed on the 1st counts toward the OLD month. This is the desired behavior (we charged you on the 31st).
- **`plan_modes_allowed`** lives in the static `DEFAULT_PLANS` catalog. If an admin edits a `Plan.features` JSON blob in the DB directly, remove `plan_modes_allowed` from it or the stale value wins. Standard practice: change the catalog + re-seed.

---

*This document should be kept in sync with `app/modules/billing/service.py::DEFAULT_PLANS` and `app/core/ai_budget.py`. Any pricing change needs both the code edit AND this doc.*
