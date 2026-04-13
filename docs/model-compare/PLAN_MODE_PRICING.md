# 💰 Ignify — Plan Mode Pricing Strategy

**Based on:** Real benchmark data from 11 models × 14-agent LangGraph pipeline  
**Source:** [MASTER_COMPARISON.md](MASTER_COMPARISON.md)  
**Date:** 2026-04-13

---

## 1. Pay-Per-Use Pricing — Per Plan Generation

| plan_mode | Model | LLM Cost/Plan | **Customer Price** | Gross Margin |
|-----------|-------|--------------|-------------------|-------------|
| `fast` | `google/gemini-2.5-flash` | $0.012 | **$1.00** | **98.8%** |
| `medium` | `openai/gpt-4o` | $0.381 | **$3.00** | **87.3%** |
| `deep` | `anthropic/claude-sonnet-4.5` | $0.592 | **$5.00** | **88.2%** |
| `deep` *(after hybrid fix)* | `gemini-flash` + `gpt-4o` | ~$0.13 | **$3.00** | **95.7%** |

> **Key insight:** `gemini-2.5-flash` (fast, $0.012) scores **80/100** — same as `claude-opus-4.6` ($2.94).  
> That's a **250× cost difference with zero quality difference.**  
> Never use Opus in production. Use gemini-flash for the default/fast tier.

---

## 2. Subscription Tier Bundles

Plans include a monthly allowance of plan generations. Overages billed per-use.

| Tier | Monthly Price | Plans Included | Modes | Monthly LLM Cost | Plan Cost as % of Revenue |
|------|-------------|----------------|-------|-----------------|--------------------------|
| **Free** | $0 | 1 fast plan | fast only | $0.012 | — (acquisition) |
| **Starter** | $29/mo | 20 fast plans | fast only | $0.24 | **0.8%** |
| **Pro** | $99/mo | 30 medium + 10 fast | fast + medium | $11.56 | **11.7%** |
| **Agency** | $299/mo | 50 deep + 50 medium | all modes | $48.66 | **16.3%** |

### Overage Pricing
| plan_mode | Overage Price |
|-----------|--------------|
| `fast` | $1.00 / plan |
| `medium` | $3.00 / plan |
| `deep` | $5.00 / plan |

---

## 3. Scale Economics — At 1,000 Paying Customers

| Tier | Monthly Revenue | Monthly LLM Cost | **Gross Margin** |
|------|----------------|-----------------|-----------------|
| 1,000 × Free | $0 | $12 | — |
| 1,000 × Starter ($29) | $29,000 | $240 | **99.2%** |
| 1,000 × Pro ($99) | $99,000 | $11,560 | **88.3%** |
| 1,000 × Agency ($299) | $299,000 | $48,660 | **83.7%** |
| **Mixed (20/60/20 split)** | **$77,200** | **~$10,200** | **~86.8%** |

> At 1,000 customers with typical mix, total monthly LLM cost ≈ **$10K** against **$77K revenue**.  
> Infrastructure + infra overhead (hosting, DB, CDN) estimated at additional $3–5K/mo.  
> **Target net margin after all infra: 75–80%**

---

## 4. Credits Mapping (Existing Credit System)

If using the existing `CreditPricing` system (1 credit ≈ $0.029):

| plan_mode | Credits consumed | Equivalent value | Rationale |
|-----------|----------------|-----------------|-----------|
| `fast` | 34 credits | $1.00 | 1 fast plan = $1 charge |
| `medium` | 103 credits | $3.00 | 1 medium plan = $3 charge |
| `deep` | 172 credits | $5.00 | 1 deep plan = $5 charge |

> Included plan allowances per tier simply deduct from a pre-loaded monthly credit pool.

---

## 5. Hybrid Mode Roadmap (After Bug Fix)

The hybrid pipeline runs in **79 seconds** (vs 3+ minutes for solo) but currently has a state propagation bug where analysis sections (market_analysis, personas, positioning, journey, funnel) return empty.

**After fix, update medium pricing to:**

| plan_mode | Model | LLM Cost | Speed | Customer Price | Margin |
|-----------|-------|----------|-------|----------------|--------|
| `medium` (v2) | `gemini-flash` + `gpt-4o` hybrid | **~$0.13** | **79s** ⚡ | $3.00 | **95.7%** |

This makes `medium` faster than current `fast` AND cheaper than current `medium` — a pure upgrade.

**Bug to fix:** In `scripts/regenerate_plan_hybrid.py`, the analysis agent results must be passed into the execution agent context. Check that `state.update()` propagates `market_analysis`, `personas`, `positioning`, `customer_journey`, and `funnel` keys between phases.

---

## 6. Model Decision Summary — Production Config

| `PlanModeConfig` mode | Model to use | Notes |
|----------------------|-------------|-------|
| `fast` | `google/gemini-2.5-flash` | $0.012/plan, 80/100, 3.2 min |
| `medium` | `openai/gpt-4o` | $0.38/plan, 80/100, 2.6 min ⚡ fastest |
| `deep` | `anthropic/claude-sonnet-4.5` | $0.59/plan, 80/100, 3.3 min |

**Do NOT use:**
- `claude-opus-4.6` — 78/100 (lower), $2.94/plan (247× more expensive than flash)
- `openai/gpt-5.2` — missed personas section (93% comprehensiveness)

---

## 7. Revenue Projections

### Break-even Analysis
- Fixed monthly infra: ~$500 (Docker, DB, CDN, monitoring)
- Break-even: **~18 Starter subscribers** or **6 Pro subscribers**

### Growth Milestones
| MRR Target | Customers Needed (Pro mix) | LLM Cost | Net Margin |
|-----------|--------------------------|----------|-----------|
| $1,000 | ~10 Pro | ~$116 | ~88% |
| $10,000 | ~100 Pro | ~$1,156 | ~88% |
| $50,000 | ~350 Pro + 150 Agency | ~$11,450 | ~77% |
| $100,000 | ~700 Pro + 300 Agency | ~$22,600 | ~77% |

---

## Summary

```
fast  plan → gemini-flash    → $0.012 LLM cost → charge $1.00  → 98.8% margin
medium plan → gpt-4o         → $0.381 LLM cost → charge $3.00  → 87.3% margin  
deep   plan → claude-sonnet  → $0.592 LLM cost → charge $5.00  → 88.2% margin

Starter $29/mo  → 20 fast plans  → LLM ≈ $0.24  → margin 99.2%
Pro     $99/mo  → 30 med+10 fast → LLM ≈ $11.56 → margin 88.3%
Agency $299/mo  → 50 deep+50 med → LLM ≈ $48.66 → margin 83.7%
```
