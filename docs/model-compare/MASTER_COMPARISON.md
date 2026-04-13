# 🏆 MASTER Model Comparison — Ignify Marketing Plan Generation

**Source plan:** `4f205bb9-aa3b-4697-8a45-5140f03af5c4` (زيادة المبيعات)  
**Generated at:** 2026-04-13  
**Total models tested:** 11 solo + 3 hybrid configurations  
**Pipeline:** 14-agent LangGraph StrategyAgent (market→audience→positioning→journey→offer→funnel→channels→conversion→retention→growth_loops→calendar→kpis→ads→roadmap)

---

## 🥇 Solo Models — Full Ranking

| Rank | Model | Overall | Comp. | Acc. | Prof. | Duration | Tokens | Est. Cost/Plan |
|------|-------|---------|-------|------|-------|----------|--------|----------------|
| 🥇 1 | `google/gemini-2.5-flash` | **80/100** | 100 | 100 | 40 | 193.7s | 84,539 | **$0.012** |
| 🥇 1 | `openai/gpt-4o-mini` | **80/100** | 100 | 100 | 40 | 173.3s | 77,170 | **$0.024** |
| 🥇 1 | `openai/gpt-4o` | **80/100** | 100 | 100 | 40 | 153.0s ⚡ | 74,309 | **$0.381** |
| 🥇 1 | `openai/gpt-4.1` | **80/100** | 100 | 100 | 40 | 219.4s | 83,755 | **$0.343** |
| 🥇 1 | `google/gemini-3.1-pro-preview` | **80/100** | 100 | 100 | 40 | 254.0s | 90,026 | **~$0.40** |
| 🥇 1 | `anthropic/claude-sonnet-4.5` | **80/100** | 100 | 100 | 40 | 196.4s | 82,284 | **$0.592** |
| 🥇 1 | `anthropic/claude-sonnet-4` | **80/100** | 100 | 100 | 40 | 194.9s | 80,836 | **$0.581** |
| 🥈 8 | `openai/gpt-5.4-mini` | **79/100** | 100 | 100 | 37 | 209.9s | 87,332 | **$0.072** |
| 🥈 8 | `anthropic/claude-haiku-4.5` | **79/100** | 100 | 100 | 37 | 232.8s | 82,435 | **$0.153** |
| 🥉 10 | `openai/gpt-5.2` | **78/100** | 93 | 100 | 40 | 230.1s | 77,108 | **~$0.39** |
| 🥉 10 | `anthropic/claude-opus-4.6` | **78/100** | 93 | 100 | 40 | 202.2s | 81,671 | **$2.940** |

> **Comprehensiveness** = % of 14 sections non-empty · **Accuracy** = quantitative signals (CAC, LTV, ROAS, payback) · **Professionalism** = reasoning fields density

---

## ⚡ Hybrid Mode Results

| Configuration | Speed | Analysis Sections | Execution Sections | Est. Cost/Plan | Verdict |
|--------------|-------|-------------------|-------------------|----------------|---------|
| `gemini-2.5-flash` + `gpt-4o` | **79s** 🚀 | ❌ empty (bug) | ✅ 9/9 | **~$0.13** | Fix needed |
| `gemini-3.1-pro-preview` + `gpt-4o` | **79s** 🚀 | ❌ empty (bug) | ✅ 9/9 | **~$0.16** | Fix needed |
| `claude-opus-4.6` + `gpt-4o` | **85s** 🚀 | ❌ empty (bug) | ✅ 9/9 | **~$0.70** | Fix needed |

> ⚠️ **Hybrid analysis bug:** All 5 analysis state keys (market_analysis, personas, positioning, customer_journey, funnel) returned empty in hybrid mode. The execution phase ran successfully because those agents don't depend on analysis JSON keys. Root cause: analysis agents returning data under different state keys than expected, or state not persisting between the two phases. **Fix required before using hybrid in production.**

---

## 📊 Section Coverage — All 11 Solo Models

| Section | flash | 4o-mini | 4o | 4.1 | gem-3.1 | son-4.5 | son-4 | 5.4-mini | haiku | 5.2 | opus |
|---------|-------|---------|-----|-----|---------|---------|-------|----------|-------|-----|------|
| market analysis | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| personas | ✅ 3 | ✅ 3 | ✅ 3 | ✅ 3 | ✅ 3 | ✅ 3 | ✅ 3 | ✅ 3 | ✅ 3 | ❌ | ✅ 3 |
| positioning | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| customer journey | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| offer | ✅ | ✅ | ✅ | ✅ | ✅ 9 | ✅ | ✅ | ✅ | ✅ | ✅ 9 | ✅ 6 |
| funnel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| channels | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| conversion | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| retention | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 9 | ✅ 9 | ❌ |
| growth loops | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| calendar | ✅ 21 | ✅ 19 | ✅ | ✅ | ✅ 30 | ✅ 15 | ✅ 19 | ✅ | ✅ 16 | ✅ 30 | ✅ 21 |
| kpis | ✅ 14 | ✅ 14 | ✅ | ✅ | ✅ 13 | ✅ 13 | ✅ 14 | ✅ | ✅ 13 | ✅ 13 | ✅ 14 |
| ad strategy | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| execution roadmap | ✅ 30 | ✅ 30 | ✅ | ✅ | ✅ 30 | ✅ 30 | ✅ 30 | ✅ | ✅ 30 | ✅ 30 | ✅ 30 |

---

## 💰 Cost Analysis — Scale Projections

| Model | Cost/Plan | 100 plans/mo | 1,000 plans/mo | 10,000 plans/mo |
|-------|-----------|-------------|----------------|-----------------|
| `gemini-2.5-flash` | $0.012 | **$1.20** | **$12** | **$120** |
| `gpt-4o-mini` | $0.024 | **$2.40** | **$24** | **$240** |
| `gpt-5.4-mini` | $0.072 | $7.20 | $72 | $720 |
| `claude-haiku-4.5` | $0.153 | $15.30 | $153 | $1,530 |
| `gpt-4.1` | $0.343 | $34.30 | $343 | $3,430 |
| `gpt-4o` | $0.381 | $38.10 | $381 | $3,810 |
| `gemini-3.1-pro-preview` | ~$0.40 | ~$40 | ~$400 | ~$4,000 |
| `claude-sonnet-4` | $0.581 | $58.10 | $581 | $5,810 |
| `claude-sonnet-4.5` | $0.592 | $59.20 | $592 | $5,920 |
| `gpt-5.2` | ~$0.39 | ~$39 | ~$390 | ~$3,900 |
| `claude-opus-4.6` | $2.940 | $294 | **$2,940** | **$29,400** |

> Pricing based on: Gemini Flash $0.075/$0.30 · GPT-4o-mini $0.15/$0.60 · GPT-5.4-mini $0.40/$1.60 · Haiku $0.80/$4 · GPT-4.1 $2/$8 · GPT-4o $2.50/$10 · GPT-5.2 $2.50/$10 · Gemini-3.1-Pro $1.25/$5 · Sonnet $3/$15 · Opus $15/$75 (per 1M tokens, 65/35 in/out split estimate)

---

## 🎯 Production Recommendation

### Default Tier (free/starter plans)
**`google/gemini-2.5-flash`** — 80/100 score, $0.012/plan, 3.2 min  
or **`openai/gpt-4o-mini`** — 80/100 score, $0.024/plan, 2.9 min

### Premium Tier
**`openai/gpt-4o`** — fastest at 2.6 min, 80/100, $0.38/plan  
or **`openai/gpt-4.1`** — same score, slightly slower, $0.34/plan

### Hybrid (after bug fix)
**`gemini-2.5-flash` (analysis) + `gpt-4o` (execution)** — ~79s ⚡, ~$0.13/plan  
Target: best speed + quality once analysis state propagation is fixed

### Avoid in Production
**`claude-opus-4.6`** — 78/100 (LOWER than $0.012 flash), $2.94/plan — not justified  
**`gpt-5.2`** — missed `personas` section (93% comprehensiveness), not reliable

---

## 📁 Individual Reports

| Model | Report |
|-------|--------|
| `google/gemini-2.5-flash` | [google_gemini-2.5-flash.md](google_gemini-2.5-flash.md) |
| `openai/gpt-4o-mini` | [openai_gpt-4o-mini.md](openai_gpt-4o-mini.md) |
| `openai/gpt-4o` | [openai_gpt-4o.md](openai_gpt-4o.md) |
| `openai/gpt-4.1` | [openai_gpt-4.1.md](openai_gpt-4.1.md) |
| `openai/gpt-5.4-mini` | [openai_gpt-5.4-mini.md](openai_gpt-5.4-mini.md) |
| `openai/gpt-5.2` | [openai_gpt-5.2.md](openai_gpt-5.2.md) |
| `anthropic/claude-haiku-4.5` | [anthropic_claude-haiku-4.5.md](anthropic_claude-haiku-4.5.md) |
| `anthropic/claude-sonnet-4` | [anthropic_claude-sonnet-4.md](anthropic_claude-sonnet-4.md) |
| `anthropic/claude-sonnet-4.5` | [anthropic_claude-sonnet-4.5.md](anthropic_claude-sonnet-4.5.md) |
| `anthropic/claude-opus-4.6` | [anthropic_claude-opus-4.6.md](anthropic_claude-opus-4.6.md) |
| `google/gemini-3.1-pro-preview` | [google_gemini-3.1-pro-preview.md](google_gemini-3.1-pro-preview.md) |
| Hybrid: Opus + GPT-4o | [hybrid_anthropic_claude-opus-4.6_+_openai_gpt-4o.md](hybrid_anthropic_claude-opus-4.6_+_openai_gpt-4o.md) |
| Hybrid: Gemini-3.1-Pro + GPT-4o | [hybrid_google_gemini-3.1-pro-preview_+_openai_gpt-4o.md](hybrid_google_gemini-3.1-pro-preview_+_openai_gpt-4o.md) |
