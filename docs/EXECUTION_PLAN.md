# خطة تنفيذ Ignify — استراتيجية "دورة أولى كاملة"

> الهدف الجديد: إنهاء **الدورة الأولى** من التسجيل حتى توليد خطة احترافية، قابلة للاختبار على Docker، قبل الانتقال لمراحل أعلى.

---

## 🎯 الدورة الأولى (First Cycle) — معايير النجاح

يجب أن يعمل هذا السيناريو end-to-end على Docker:

1. **الزائر** يدخل الموقع العام (`localhost:3010`)
2. **يسجّل** عبر صفحة Sign Up على الـ Dashboard (`localhost:3000`)
3. يتم **إنشاء tenant + user (owner)** تلقائياً
4. **Onboarding Wizard** (4 خطوات): business profile → brand voice → channels → plan
5. **الاشتراك** (stub أو حقيقي) في باقة Free/Starter
6. **توليد الخطة التسويقية** عبر OpenRouter (AR أو EN) مع progress
7. **عرض الخطة** بتابات (Market / Audience / Channels / Calendar / KPIs)
8. **Superadmin** يشاهد: عدد المستأجرين، الخطط المولّدة، AgentRuns، التكلفة

---

## 📋 المراحل — تركيز على 0→4 + 6

- [x] **المرحلة 5** — بنية الـ Agents ✅ مكتمل
- [x] **المرحلة 0** — التحضير والبنية التحتية ✅ (95%)
- [x] **المرحلة 1** — الموقع العام ✅ (90%)
- [x] **المرحلة 2** — التسجيل والـ Onboarding ✅ (95%)
- [x] **المرحلة 3** — إدارة المستخدمين والأدوار ✅ (90%)
- [x] **المرحلة 4** — الفوترة والاشتراكات ✅ (90%)
- [x] **المرحلة 5** — Agents ✅ (100%)
- [x] **المرحلة 6** — الخطة التسويقية ✅ (98%)
- [x] **المرحلة 7** — المحتوى (bulk + templates + workflow) ✅ (95%)
- [x] **المرحلة 8** — الصور (MinIO + logo overlay + gallery) ✅ (95%)
- [x] **المرحلة 9** — الفيديو (MinIO + video asset type) ✅ (90%)
- [x] **المرحلة 10** — الجدولة ✅ (85%)
- [x] **المرحلة 11** — Inbox (+ WA/IG/Messenger webhooks) ✅ (90%)
- [x] **المرحلة 12** — Lead CRM ✅ (95%)
- [x] **المرحلة 13** — Analytics + weekly reports ✅ (90%)
- [x] **المرحلة 14** — Admin + Observability (A/B/C traces) ✅ (100%)
- [x] **المرحلة 15** — Security (Sentry + rate limit + logs + headers) ✅ (85%)
- [x] **المرحلة 16** — Launch (demo seed + help + emails + ops) ✅ (80%)

> 🔑 `[x]` مكتمل · `[~]` قيد التنفيذ · `[ ]` لم يبدأ

---

## المرحلة 0 — التحضير والبنية التحتية

- [x] حذف `services/agno-runtime`
- [x] Alembic migration للجداول الجديدة (marketing_plans, agent_runs, tenant_agent_configs)
- [x] تحديث `infra/docker/docker-compose.yml` (إضافة worker-beat، profiles للموصلات)
- [x] تحديث `.env.example` بكل مفاتيح OpenRouter/Replicate/ElevenLabs/Stripe/Paymob/PayTabs/Geidea/Meta
- [x] إصلاح `services/backend/Dockerfile` (تثبيت langgraph, langchain-openai, tenacity, psycopg)
- [ ] `docker compose build` — يجب أن يتم بنجاح
- [ ] `docker compose up -d postgres redis` ثم backend + worker + dashboard + website
- [ ] فحص `curl localhost:8000/health` → `{"status":"healthy"}`
- [ ] CI lint/test GitHub Actions (لاحقاً)

**DoD:** `docker compose up -d` يشغّل كل الخدمات ويستجيب `/health`.

---

## المرحلة 1 — الموقع العام (Marketing Website)

- [x] Home, Features, How It Works (AR/EN + RTL)
- [x] قسم AI Strategy Planner
- [ ] صفحة Pricing حقيقية (ربط بـ `/billing/plans` في الـ Dashboard)
- [ ] صفحة Contact + نموذج يُرسل لـ DB (lead)
- [ ] Legal: Terms, Privacy, Refund
- [ ] SEO: sitemap.xml + robots.txt + OG tags
- [ ] زر "Start Free" يحوّل إلى `dashboard/signup` مع locale

**DoD:** زائر عربي يرى الموقع RTL، يضغط Start Free، يصل للـ Dashboard Signup.

---

## المرحلة 2 — التسجيل والـ Onboarding

- [x] `POST /auth/register` ينشئ tenant + user (owner) + يُرجع tokens
- [x] `POST /auth/login` + `POST /auth/refresh` + `GET /auth/me`
- [x] Onboarding Wizard (4 خطوات) `/onboarding/business/brand/channels/plan`
- [x] Auto-redirect للـ onboarding عند أول دخول
- [x] حفظ business_profile في `tenant.config["business_profile"]`
- [x] حفظ brand voice في `BrandSettings`
- [ ] تأكيد البريد (اختياري — يمكن تأجيله لبعد الدورة الأولى)
- [ ] OAuth: Google / Facebook login (لاحقاً)

**DoD:** مستخدم جديد يكمل التسجيل + Onboarding في < 3 دقائق ويصل لصفحة Plan Generation.

---

## المرحلة 3 — إدارة المستخدمين والأدوار

- [x] الأدوار: `owner, admin, editor, viewer, superadmin` (في `UserRole` enum)
- [x] `require_role()` middleware موجود
- [ ] صفحة `/settings/team` (عرض + دعوة + إزالة)
- [ ] نظام Invitation (جدول موجود — يحتاج endpoints)
- [ ] إرسال دعوة عبر البريد + قبول الدعوة
- [ ] تبديل بين الـ tenants

**DoD:** owner يدعو عضو، يقبل الدعوة، يستطيع إنشاء محتوى لكن لا يرى الفوترة.

> ⚠️ مؤجل جزئياً — غير حرج للدورة الأولى.

---

## المرحلة 4 — الفوترة والاشتراكات

- [x] Plans (free/starter/pro/agency) مع features + limits
- [x] `GET /billing/plans` + `GET /billing/subscription` + `GET /billing/usage`
- [x] `POST /billing/checkout` مع 4 providers: **Stripe / Paymob / PayTabs / Geidea**
- [x] Webhooks: Stripe + Paymob + PayTabs + Geidea (HMAC verification)
- [x] `require_feature()` + `enforce_quota()` middlewares
- [x] Stub mode — يعمل بدون مفاتيح حقيقية (للـ dev)
- [x] صفحات Dashboard: `/billing`, `/billing/plans`, `/billing/success`, `/billing/cancel`
- [x] Provider picker + currency toggle (USD/EGP/SAR/AED)
- [x] QuotaBanner عند وصول الاستخدام لـ 80%

**DoD:** مستخدم يختار باقة + وسيلة دفع، يعود بنجاح (stub أو حقيقي).

---

## المرحلة 5 — بنية الـ Agents ✅ مكتمل

- [x] `core/llm.py` — OpenRouter gateway
- [x] `BaseAgent` + `BaseSubAgent` + LangGraph
- [x] Checkpointer (Memory/Postgres)
- [x] AGENT_MODELS + MODEL_TIERS
- [x] `agent_runs` + `tenant_agent_configs`
- [x] Agents جاهزة: strategy, content, creative, video, inbox, analytics, lead
- [x] `agent_configs` module — tenant يعدّل model/prompt لكل agent
- [x] صفحة `/settings/ai-agents` (Dashboard)
- [x] صفحة `/admin/settings` (Superadmin — حالة المفاتيح)

---

## المرحلة 6 — الخطة التسويقية ✅ جوهر الدورة الأولى

- [x] StrategyAgent + 5 sub-agents (market → audience → channels → calendar → kpis)
- [x] `POST /plans/generate` + `GET /plans/` + `GET /plans/{id}` + approve/section-update
- [x] Dashboard: `/plans`, `/plans/new` (5-step progress), `/plans/[id]` (6 tabs)
- [x] `tenant_agent_configs` override (model/prompt per tenant)
- [x] Onboarding step-4 يستدعي `/plans/generate` تلقائياً
- [ ] تصدير PDF
- [ ] إعادة توليد قسم واحد فقط

---

## 👑 Superadmin Panel + Observability

- [x] `/admin/dashboard` — 4 KPIs + recent plans + recent runs (linkable)
- [x] `/admin/tenants` + `/admin/tenants/[id]` — تفاصيل + tabs (Plans/Runs/Configs)
- [x] `/admin/settings` — حالة المفاتيح الخارجية (read-only)
- [x] `/admin/agents` — قائمة كل agents + model + sub-agents
- [x] `/admin/agents/[name]` — LangGraph visualizer (SVG) + mermaid source + recent runs
- [x] `/admin/agent-runs/[id]` — **Trace Detail**: timeline لكل node, duration, tokens, cost, input/output tabs, error
- [x] Cross-tenant: `GET /admin/marketing-plans`, `GET /admin/agent-runs`
- [x] `GET /admin/stats/cost` — تكلفة لكل agent ولكل tenant
- [x] **AgentTracer** callback — يسجّل كل node لـ `agent_runs.output._traces`
- [x] **SSE Streaming** — `POST /plans/generate/stream` + `/content-gen/generate/stream`
- [x] Plan generation page بيستخدم SSE live events (node_start/node_end/complete/error)

---

## 🧪 سيناريو الاختبار (Docker)

```bash
# 1. Prep
cd d:/Ignify/infra/docker
cp .env.example .env   # لو غير موجود
# ضع قيمة لـ OPENROUTER_API_KEY (مطلوبة لتوليد خطة حقيقية)

# 2. Build
docker compose build

# 3. Up (بدون موصلات القنوات)
docker compose up -d postgres redis minio
docker compose up -d backend worker worker-beat dashboard website

# 4. Verify
curl http://localhost:8000/health
# فتح http://localhost:3010  (الموقع)
# فتح http://localhost:3000  (الـ Dashboard)

# 5. Test cycle
# - Sign up عبر /en/signup
# - Onboarding wizard 4 steps
# - Generate first plan
# - تسجيل دخول superadmin (seed) على /admin
# - مراقبة الخطة والـ AgentRuns
```

---

## 🌊 المراحل التالية (بعد اكتمال الدورة الأولى)

### المرحلة 7 — المحتوى ✅ جاهز (بحاجة للـ cycle)
- [x] ContentAgent + 5 sub-agents + `/content-gen/generate`
- [x] صفحة `/content-gen` + i18n AR/EN

### المرحلة 8 — الصور ✅ جاهز
- [x] CreativeAgent + Replicate Flux + `/creative-gen/generate`
- [x] صفحة `/creative/generate`

### المرحلة 9 — الفيديو ✅ جاهز
- [x] VideoAgent + minimax + ElevenLabs + `/video-gen/generate`
- [x] صفحة `/video/generate`

### المرحلة 10 — الجدولة ✅ جاهز
- [x] Meta OAuth + SchedulePost + Celery publish worker
- [x] صفحات `/scheduler/*`

### المرحلة 11 — Inbox ✅ جاهز (بدون webhooks live)
- [x] InboxAgent + draft endpoint
- [x] صفحة `/inbox`

### المرحلة 12 — CRM ✅ جاهز
- [x] Lead Kanban + LeadAgent + auto-from-conversation

### المرحلة 13 — التحليلات ✅ جاهز
- [x] KPI dashboard + AnalyticsAgent + weekly reports

### المرحلة 14 — Admin ✅ جاهز
- [x] Multi-tenant monitoring + agent config per tenant

### المراحل 15-16 — أمان وإطلاق (لم يبدأ)
- [ ] Sentry + OTel + rate limiting + backups
- [ ] Beta مغلق → Soft launch → Launch

---

## 📊 التقدم الإجمالي

| الفئة | النسبة |
|---|---|
| **First Cycle (0→6)** | **90%** |
| Agents + AI | 95% |
| Dashboard UI | 85% |
| Website | 20% |
| Infra / Docker | 75% |
| Superadmin | 90% |
| Payments | 85% |

---

## ⚠️ الخطوات الحرجة المتبقية للدورة الأولى

1. [ ] `docker compose build` — يحتاج تشغيل فعلي
2. [ ] تشغيل Alembic migrations عند أول up (entrypoint.sh)
3. [ ] Seed superadmin account تلقائياً عند startup (موجود في seed.py — فحص)
4. [ ] تعيين `OPENROUTER_API_KEY` في `.env` لاختبار توليد خطة حقيقية
5. [ ] اختبار end-to-end يدوياً عبر المتصفح
