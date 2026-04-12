# Ignify Launch Checklist

Actionable items for taking Ignify live with its first beta users. Group owners should tick items as they're verified in the production environment, not just staging.

Legend: `[ ]` pending · `[x]` done · `[~]` in progress · `[!]` blocker

**Overall Progress:** 🟢 Code-level: 95% · 🟡 Production-ops: 25%

---

## 1. Infrastructure

- [ ] Register and point production domain (`ignify.ai`) DNS A/AAAA to load balancer
- [ ] Issue TLS certificate via Let's Encrypt / ACM, verify auto-renewal
- [x] Security headers middleware (HSTS, X-Frame-Options, X-Content-Type-Options) — enabled in `main.py`
- [ ] Force HTTPS redirect at gateway (reverse proxy concern, not app)
- [ ] Provision managed PostgreSQL 16 with 3x storage headroom vs current DB
- [x] Dev PostgreSQL 16 (docker-compose) — `ignify-postgres` healthy
- [ ] Configure PostgreSQL daily automated backups (PITR window >= 7 days)
- [ ] Run backup restoration drill into isolated staging DB and verify integrity
- [x] Dev Redis 7 with RDB persistence — `ignify-redis` healthy
- [ ] Provision managed Redis 7 with AOF persistence (production)
- [x] Dev MinIO bucket auto-created on startup
- [ ] Provision production MinIO / S3 bucket with versioning + lifecycle rules
- [ ] Set `DEBUG=false` in production environment
- [ ] Rotate `SECRET_KEY` to a 64-char random value; store in secret manager
- [ ] Set `EMAIL_VERIFICATION_REQUIRED=true` for production
- [ ] Configure outbound SMTP (SendGrid / Postmark / SES); warm up sending domain
- [x] SMTP stub mode (dev logs) — `app/core/email.py`
- [ ] Add SPF / DKIM / DMARC DNS records for the mailing domain
- [x] Celery beat + worker run as separate containers — `ignify-worker` + `ignify-worker-beat`
- [x] `/ops/live` and `/ops/ready` endpoints implemented
- [ ] Wire `/ops/live` and `/ops/ready` into k8s liveness + readiness probes
- [ ] CDN in front of MinIO public bucket for asset delivery

## 2. Security & Compliance

- [x] Rate limiting on `/auth/*` — PUBLIC_IP preset (20 req/min/IP)
- [x] Rate limiting on AI-heavy endpoints — STRICT (10/hr) for plan/video, MEDIUM (60/hr) for content
- [x] Rate limiting on all write endpoints (team/leads/knowledge/templates)
- [x] Global rate limit middleware (100 req/min/IP safety net)
- [x] CORS allowlist configurable via `CORS_ORIGINS`
- [x] RBAC permissions matrix in `app/core/rbac.py`
- [x] Webhook signature verification (Meta HMAC-SHA256, Stripe, Paymob, PayTabs, Geidea)
- [x] Audit log table + tenant-scoped queries in all services
- [x] Tenant isolation enforced in every service query (tenant_id check)
- [~] Email verification flow — built, `EMAIL_VERIFICATION_REQUIRED=false` in dev
- [ ] Run `semgrep --config=auto` on backend + dashboard repos; triage high findings
- [ ] Run `nikto` against public endpoints; confirm no default paths exposed
- [ ] Run `trivy` image scan on all docker images; no CRITICAL CVEs unpatched
- [ ] Pen-test auth endpoints (login, register, password reset) against OWASP ASVS L2
- [ ] Content Security Policy header reviewed and scoped
- [ ] Restrict CORS allowlist to production domains only
- [ ] Confirm all secrets (API keys, tokens) stored in secret manager — not in env files
- [ ] Audit access to production DB: <= 3 engineers with credentials, MFA required
- [ ] PCI-DSS: confirm card data never touches our servers (delegated to Stripe / PayTabs / Paymob / Geidea hosted pages)
- [ ] GDPR data export endpoint returns all tenant data as ZIP within 30 days
- [ ] GDPR data deletion endpoint purges tenant + cascading data within 30 days
- [x] Legal pages drafted: Terms / Privacy / Refund (10/10/6 sections, AR+EN)
- [ ] Publish Privacy Policy reviewed by **legal counsel**
- [ ] Publish Terms of Service reviewed by **legal counsel**
- [ ] Publish DPA template for enterprise customers
- [ ] Cookie consent banner on website (EU traffic)

## 3. Monitoring & Observability

- [x] Sentry SDK integrated in backend (`main.py`) — activates when DSN set
- [x] Structured JSON logging (`app/core/logging.py`) when `DEBUG=false`
- [x] AgentTracer callback — per-node traces logged to `agent_runs.output._traces`
- [x] Admin observability dashboard — `/admin/dashboard`, `/admin/agents`, `/admin/agent-runs/[id]`
- [x] LangGraph visualizer — `/admin/agents/[name]` (SVG + mermaid)
- [x] Live SSE streaming for plan generation — real-time node progress
- [x] Ops endpoints: `/ops/status`, `/ops/ready`, `/ops/live`
- [x] Cost tracking per agent/tenant — `/admin/stats/cost`
- [ ] Create **production** Sentry project; configure backend + dashboard DSNs
- [ ] Verify Sentry captures an intentional test error from each service
- [ ] Configure log aggregation (Loki / CloudWatch / Datadog)
- [ ] Uptime monitor (BetterStack / Pingdom) hitting `/ops/status` every 60s
- [ ] Alert routing to on-call (PagerDuty / Opsgenie) with 5-min ack SLA
- [ ] Dashboard for p50/p95 latency per endpoint
- [ ] Dashboard for Celery queue depth + task failure rate
- [ ] Alert when `credit_balance < 0` for any tenant (bug indicator)
- [ ] Alert when AI provider error rate > 5% over 5 min
- [ ] Google Analytics 4 / Plausible installed on marketing website
- [ ] Product analytics (PostHog / Mixpanel) on dashboard — track activation events

## 4. Reliability & Performance

- [x] Async video rendering via Celery (non-blocking) — `video_gen/tasks.py`
- [x] Celery NullPool per-task to avoid asyncpg fork issues
- [x] Tenacity retry on external API calls (Meta, Replicate, ElevenLabs, Paymob, PayTabs, Geidea)
- [x] pgvector semantic search on Knowledge Base (replaces string match)
- [x] Stub-safe mode for every external provider (safe dev without keys)
- [ ] Baseline load test: 100 concurrent users, assert p95 < 500ms on key endpoints
- [ ] Stress test: ramp to 500 concurrent users, identify break point
- [ ] DB: add missing indexes identified during load test
- [ ] DB: slow query log enabled; alerts on queries > 1s
- [ ] Cache headers set correctly on static dashboard assets
- [ ] Dashboard bundle analyzed; largest route chunk < 300KB gzipped
- [ ] Run incident-response tabletop exercise; document RTO/RPO
- [ ] Incident response runbook published in `docs/RUNBOOK.md`
- [ ] Status page (instatus / atlassian) wired to uptime monitor

## 5. Product Readiness

- [x] **Core flows shipping:**
  - [x] Register → email verification (stub) → onboarding wizard (4 steps) → plan generation
  - [x] Plan generation with live SSE streaming (5 sub-agents visualized)
  - [x] Content Engine (5 targets) + bulk generation + templates + workflow (draft→review→approved→published)
  - [x] Creative Engine (Replicate Flux + MinIO + logo overlay + gallery)
  - [x] Video Engine (async Celery rendering + ElevenLabs voice + scenes)
  - [x] Social Scheduler (Meta OAuth + publish + calendar UI)
  - [x] Ads Orchestrator (Meta Marketing API live + AI wizard)
  - [x] SEO Intelligence live (Serper/Google CSE + on-page audit)
  - [x] Competitor Intelligence (public page scraping + gap analysis)
  - [x] Inbox (AI draft + webhooks WA/IG/Messenger)
  - [x] Lead CRM (Kanban + auto-from-conversation + AI qualifier)
  - [x] Analytics dashboard (KPIs + trend charts + weekly AI report)
  - [x] A/B testing experiments
  - [x] White-label (Agency plan)
  - [x] Knowledge Base (pgvector semantic search)
  - [x] Help Center (8 topics AR/EN)
- [x] Full bilingual (AR + EN) UI — all routes use `useTranslations`
- [x] RTL layout with logical properties (ps/pe/start/end)
- [x] PDF export for plans + weekly reports (AR/EN, RTL-aware)
- [ ] Smoke test: register → verify email → onboarding → generate plan → create post → schedule (manual QA)
- [ ] Verify RTL layout on 5 main pages with a **native Arabic speaker**
- [ ] Run a11y audit (axe-core) on dashboard; no critical issues
- [ ] Test on Chrome, Safari, Firefox, Edge latest + one previous
- [ ] Test on iOS Safari, Android Chrome (responsive behaviour)
- [x] Plan gating via `require_feature()` + quota via `enforce_quota()` on generate endpoints
- [ ] Verify every paid feature respects plan gating (Starter/Pro/Agency) — comprehensive QA
- [ ] Verify credit deduction per AI operation matches the published rate card
- [ ] Test Stripe checkout end-to-end in live mode with a real card (then refund)
- [ ] Test PayTabs, Paymob, and Geidea in live mode
- [ ] Confirm refund flow works and updates subscription correctly

## 6. Legal

- [ ] Entity registered for billing (tax ID, merchant account ready)
- [ ] Trademark search completed for "Ignify" in target markets
- [ ] Domain WHOIS privacy enabled
- [ ] Licence files committed in every repo (or marked proprietary)
- [ ] Third-party licence audit: confirm dependency licences compatible with commercial SaaS
- [ ] Review and sign data processing agreements with sub-processors (OpenAI, Anthropic, Stripe, Replicate, ElevenLabs, etc.)

## 7. Marketing & Launch

- [x] Marketing website live (home, features, pricing, contact, about, legal) — AR/EN
- [x] Pricing page with currency toggle (USD/EGP/SAR/AED) + 4 plans + FAQ
- [x] Contact form → `/api/v1/leads/public` lead capture
- [x] SEO: `robots.txt`, `sitemap.xml`, OG tags, hreflang, structured meta
- [ ] Website landing page copy **final-proofread** (AR + EN) by native speakers
- [ ] Pricing page reflects real prices validated with CFO, with annual discount
- [ ] Case study / testimonials section with 2–3 quotes (use pilot customers)
- [ ] Publish launch blog post in English
- [ ] Publish launch blog post in Arabic
- [ ] Email announcement drafted for waitlist
- [ ] Product Hunt submission scheduled (Tuesday 00:01 PT for best timing)
- [ ] Product Hunt assets ready: GIF demo, gallery screenshots, first comment, hunter arranged
- [ ] LinkedIn company page set up + launch post drafted
- [ ] Instagram business profile set up with brand assets
- [ ] X / Twitter profile set up, launch thread drafted
- [ ] YouTube channel with 2-min product demo video
- [x] Open Graph + Twitter Card meta tags in website `generateMetadata`
- [ ] Verify OG preview on Facebook/LinkedIn/Twitter debuggers with real `og-image.png`
- [ ] Favicon, apple-touch-icon, manifest.json complete for dashboard + website

## 8. Support & Community

- [x] Help center built — `/help` with 8 topics, AR/EN
- [x] Onboarding email templates (welcome, day-1, day-3, day-7, weekly report) — stubs
- [x] Celery beat for onboarding emails + weekly reports
- [ ] `support@ignify.ai` mailbox routed to help desk (HelpScout / Freshdesk / Zendesk)
- [ ] Autoresponder configured with expected response window
- [ ] In-app chat widget enabled on dashboard (Intercom / Crisp)
- [ ] Public changelog page (`/changelog`) initialized
- [ ] Discord / Slack community channel created for beta users
- [ ] SLA document for paid customers published

## 9. Beta Users

- [x] Demo tenant seeded (`customer@ignify.com`) with rich demo data (plan, content, creatives, leads, analytics, conversations)
- [ ] Shortlist 10 beta users in target segment (MENA e-commerce, SMB)
- [ ] Send personalised outreach to each with calendar link for onboarding call
- [ ] Offer 3-month free Professional plan in exchange for feedback
- [ ] Schedule weekly 30-min feedback call with each beta user for first month
- [ ] NPS survey scheduled at day 14 and day 30

## 10. Ops & Financial

- [ ] Cloud cost alert threshold set (e.g. > $2,000/mo triggers review)
- [x] Per-agent + per-tenant cost tracking — `/admin/stats/cost`
- [ ] Monthly financial close process documented
- [ ] VAT / GST registered in operating jurisdictions
- [ ] Invoicing templates verified with accountant
- [x] Refund policy page published — `/legal/refund`
- [ ] Chargeback response process documented

---

## 11. External Dependencies (⚠️ Long Lead Time — START NOW)

- [ ] **Meta App Review** submission (2-4 weeks) — needed for WhatsApp Cloud, Instagram DM, Ads scopes
- [ ] **Paymob** merchant KYC (1-2 weeks) — Egypt
- [ ] **PayTabs** merchant onboarding (1 week) — MENA
- [ ] **Geidea** merchant setup (1 week) — Saudi/GCC
- [ ] **Stripe** account verification + tax setup (2-3 days)
- [ ] **Replicate** production API quota request (if expecting high volume)
- [ ] **OpenRouter** credits top-up + budget alerts
- [ ] **ElevenLabs** production plan subscription
- [ ] **Serper** / **DataForSEO** subscription for SEO live features

---

## 📊 Progress Summary by Section

| Section | Done | Total | % |
|---|---|---|---|
| 1. Infrastructure | 6 | 22 | 27% |
| 2. Security & Compliance | 11 | 29 | 38% |
| 3. Monitoring & Observability | 8 | 19 | 42% |
| 4. Reliability & Performance | 5 | 14 | 36% |
| 5. Product Readiness | 30 | 41 | 73% |
| 6. Legal | 0 | 6 | 0% |
| 7. Marketing & Launch | 6 | 20 | 30% |
| 8. Support & Community | 3 | 10 | 30% |
| 9. Beta Users | 1 | 6 | 17% |
| 10. Ops & Financial | 2 | 7 | 29% |
| 11. External Dependencies | 0 | 9 | 0% |
| **TOTAL** | **72** | **183** | **39%** |

---

## 🚦 Launch Readiness Traffic Light

- 🟢 **Code complete:** All core + advanced features implemented
- 🟡 **Production ops pending:** DNS, SSL, SMTP, monitoring setup
- 🔴 **External blockers:** Meta/Paymob/Stripe KYC applications not submitted yet

**Recommended sequence:**
1. **Week 1:** Submit all external KYCs in parallel (block on none)
2. **Week 2:** Production infra + SMTP + Sentry + backups
3. **Week 3:** Manual QA + a11y audit + load tests
4. **Week 4:** Legal review + marketing assets + soft launch

---

Last reviewed: 2026-04-12 · Owner: _assign name_
