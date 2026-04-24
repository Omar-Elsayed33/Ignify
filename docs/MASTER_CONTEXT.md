# Ignify — Master AI-Ready Context Document

**Generated**: 2026-04-24  
**Scope**: Full-stack analysis — backend, frontend, AI pipeline, infrastructure, DB, docs  
**Purpose**: Reusable context for CTO-level planning, product discussions, and AI-assisted development

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Business Model](#2-business-model)
3. [Technical Architecture](#3-technical-architecture)
4. [Database Design](#4-database-design)
5. [Core Features — Exhaustive](#5-core-features--exhaustive)
6. [Module Breakdown](#6-module-breakdown)
7. [AI Agent Pipeline](#7-ai-agent-pipeline)
8. [User Flows](#8-user-flows)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Integrations & Infrastructure](#10-integrations--infrastructure)
11. [Security Model](#11-security-model)
12. [Current System State](#12-current-system-state)
13. [Technical Debt & Risks](#13-technical-debt--risks)
14. [Suggested Improvements](#14-suggested-improvements)
15. [Scalability Concerns](#15-scalability-concerns)
16. [Security Concerns](#16-security-concerns)
17. [Performance Risks](#17-performance-risks)

---

## 1. SYSTEM OVERVIEW

**Ignify** is an AI-powered B2B SaaS marketing platform targeting small-to-medium businesses in the MENA region (primarily Egypt, Saudi Arabia, UAE). It is forked from an internal project called URTWIN and has been substantially extended.

The platform allows business owners to:
- Generate complete AI-driven marketing strategies in minutes
- Create content (articles, social posts, captions, ad copy) via AI
- Generate visual creatives and short-form videos via AI
- Schedule and publish content across social media platforms
- Manage a CRM pipeline of leads captured from multiple channels
- Run SEO audits and track keyword rankings
- Manage multi-channel customer communication (WhatsApp, Messenger, Instagram DMs, Email)
- Monitor analytics across all marketing activities
- Operate with team members under role-based access control

The system is **multi-tenant**: each business gets an isolated workspace (tenant) with its own data, branding, team, and billing. An **Agency tier** supports white-labeling — the entire platform can be rebranded for resellers.

**Primary language**: Arabic (RTL UI, Arabic-first AI outputs). English is the secondary locale.

**Target user**: Non-technical business owners in MENA who want AI to handle marketing strategy, content, and execution — without requiring them to understand AI or marketing jargon.

---

## 2. BUSINESS MODEL

### Subscription Tiers

| Tier | Price/mo (USD) | Price/mo (EGP) | Team | Channels | AI Tokens/mo |
|------|---------------|----------------|------|----------|--------------|
| **Free** | $0 | 0 | 1 user | 1 | 50K |
| **Starter** | $29 | 1,499 | 3 users | 3 | 500K |
| **Pro** | $99 | 4,999 | 10 users | 10 | 3M |
| **Agency** | $299 | 14,999 | 50 users | 50 | 20M |

Agency tier adds: white-labeling, custom domain, priority support, unlimited articles/images.

### Payment Gateways (4 active)

- **Stripe** — global card payments (subscription mode)
- **Paymob** — Egypt (EGP, card + Fawry)
- **PayTabs** — MENA (SAR, AED, EGP)
- **Geidea** — Saudi/GCC (pay-by-link)

Offline payments (bank transfer) are also supported with admin approval workflow.

### Monetization Beyond Subscriptions

- **Credits system**: AI actions consume credits from the monthly allowance; overages potentially purchasable
- **Referral program**: Per-user referral codes; conversions tracked with reward metadata
- **White-label reselling**: Agency customers can resell the platform under their own brand

### Market Positioning

- MENA-first (Arabic UI/AI, EGP/SAR/AED pricing)
- Non-technical persona — no AI knobs exposed, no model names, no prompts
- All-in-one (strategy → content → creative → social → analytics → CRM) vs. point solutions
- Budget-aware planning: all AI outputs respect the business owner's stated monthly budget

---

## 3. TECHNICAL ARCHITECTURE

### Stack Summary

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12, FastAPI 0.115, SQLAlchemy 2 (async), Alembic, Pydantic 2.10 |
| **AI Orchestration** | LangGraph 0.2.60, LangChain, OpenRouter (unified LLM gateway) |
| **Database** | PostgreSQL 16 with pgvector extension |
| **Task Queue** | Celery 5.4 + Redis 7 |
| **Object Storage** | MinIO (S3-compatible) |
| **Frontend** | Next.js 15.1, React 19, TypeScript, Tailwind CSS 4 |
| **State Management** | Zustand (auth store only) |
| **i18n** | next-intl v3.25 (Arabic default, English secondary) |
| **Media** | Replicate (image gen via Flux-Schnell), ElevenLabs (TTS/voice) |
| **Reverse Proxy** | Nginx (routes /api → backend, / → website, /app → dashboard) |
| **Observability** | Sentry SDK, structlog (JSON), OpenTelemetry stub |

### Service Topology (Docker Compose)

```
Internet
   │
Nginx Gateway (80/443)
   ├── / → Website (Next.js, port 3010)
   ├── /app → Dashboard (Next.js, port 3000)
   └── /api → Backend (FastAPI, port 8000)
                  │
         ┌────────┼────────┐
         │        │        │
    PostgreSQL  Redis    MinIO
    (port 5432) (6379)  (9000/9001)
         │
    Celery Worker + Celery Beat
         │
    Social Connectors (ports 3001–3006)
    WhatsApp · Messenger · Instagram DM · Email · Slack
```

### Request Flow

1. Browser → Nginx → Next.js dashboard (SSR/CSR)
2. Dashboard → `/api/v1/*` via `api.ts` fetch wrapper (auto-attaches JWT, auto-refreshes on 401)
3. FastAPI router → auth middleware → RBAC check → service layer → SQLAlchemy async ORM
4. Long-running AI tasks: FastAPI triggers Celery task → worker executes LangGraph agent → saves result to DB
5. Streaming: SSE endpoints (`/generate/stream`) stream plan/content tokens directly to browser
6. Social publishing: Celery Beat `scan_due_posts` task fires every minute, dispatches `publish_post` tasks per platform

---

## 4. DATABASE DESIGN

### Multi-Tenancy Pattern

**Soft multi-tenancy**: all tenants share one database schema. Every business-domain table has a `tenant_id` (UUID FK) column that is indexed. The service layer enforces `WHERE tenant_id = :current_tenant` on every query. No cross-tenant foreign keys exist outside the `users.tenant_id` assignment.

### Table Count: 61 tables across 16 functional domains

| Domain | Tables | Key Models |
|--------|--------|-----------|
| **Auth & Users** | 6 | User, Tenant, Plan, Invitation, RefreshToken, AuditLog |
| **Messaging** | 6 | Channel, Session, Message, Skill, SkillInstallation, ChannelSkill |
| **AI Config** | 3 | AIProvider, TenantAIConfig, TenantOpenRouterConfig |
| **Billing & Credits** | 5 | CreditPricing, CreditBalance, CreditTransaction, CreditPurchase, OfflinePayment |
| **Content** | 5 | ContentPost, ContentCalendar, ContentTemplate, ContentActivity, ContentExperiment + ContentVariant |
| **Creative** | 1 | CreativeAsset |
| **Social Media** | 3 | SocialAccount, SocialPost, SocialMetric |
| **Advertising** | 3 | AdAccount, AdCampaign, AdPerformance |
| **SEO** | 3 | SEOKeyword, SEORanking, SEOAudit |
| **CRM / Leads** | 3 | Lead, LeadActivity, LeadPipelineStage |
| **Campaigns** | 3 | Campaign, CampaignStep, CampaignAudience |
| **Analytics** | 2 | Report, ReportSnapshot |
| **Competitors** | 2 | Competitor, CompetitorSnapshot |
| **Marketing AI** | 5 | MarketingPlan, MarketingPlanSnapshot, AgentRun, PlanModeConfig, TenantAgentConfig |
| **Knowledge Base** | 1 | KnowledgeChunk (pgvector 1536D embeddings for RAG) |
| **Platform / API** | 6 | BrandSettings, ApiKey, Webhook, Referral, PlatformChannel, TenantPhoneNumber |

### Key Design Decisions

- **UUID primary keys** throughout (no auto-increment integers)
- **JSON columns** heavily used for flexible configs: `tenant.config`, `marketing_plans.market_analysis`, `marketing_plans.positioning`, campaign configs, skill configs
- **Encrypted columns**: All OAuth tokens and API keys stored encrypted (Fernet/AES-128); field names carry `_encrypted` suffix
- **pgvector**: `knowledge_chunks.embedding` column (1536 dimensions) supports semantic search for the RAG knowledge base
- **Cascading deletes**: `TenantOpenRouterConfig`, `KnowledgeChunk`, `MarketingPlanSnapshot`, and `ContentVariant` cascade-delete with their parent
- **Audit trail**: `AuditLog` table captures all privileged actions (immutable, never deleted)
- **Soft deletes**: Not implemented — deletion is hard, but `AuditLog` preserves intent

### Key Enums

`UserRole`: owner, admin, editor, viewer, superadmin  
`SocialPlatform`: instagram, facebook, twitter, linkedin, tiktok, snapchat, youtube  
`ContentStatus`: draft → review → approved → rejected → scheduled → published  
`LeadStatus`: new → contacted → qualified → proposal → won / lost  
`CampaignType`: email_drip, social, ads, multi_channel  
`PlanMode`: fast, medium, deep  
`AssetType`: image, banner, logo, mockup, video  

### Migration History (19 migrations)

The schema evolved from an empty base through: competitor social links → agents + marketing plans → email verification → content templates → video asset type → pgvector knowledge base → A/B experiments → white-label brand settings → SEO extensions → plan pricing → strategic plan fields (positioning/funnel/retention/growth) → plan_mode → social post content link + publish_mode → snapshots + referrals + API keys + webhooks → tenant AI config → subscription gating.

---

## 5. CORE FEATURES — EXHAUSTIVE

### 5.1 Authentication & Team Management

- **Registration**: Email + password + company name; captures referral code from `?ref=` URL param
- **Email verification**: Required in production (token-based, 24hr expiry, resend endpoint)
- **Login / Logout**: JWT access token (30 min) + refresh token (7 days); logout blacklists token in Redis
- **Profile management**: `PATCH /auth/me` — name, email, language preference, avatar
- **GDPR data export**: `GET /auth/me/data-export` — full tenant data dump
- **Account deletion**: Soft-delete via `DELETE /auth/me`
- **Team invitations**: Owner/admin sends email invite; invited user registers via `/accept-invite?token=`
- **Role management**: Owner can promote/demote; transfer ownership to another member
- **Audit log**: All privileged actions logged; viewable by owner/admin

### 5.2 Onboarding Wizard

4-step wizard (business → brand → channels → complete):

- **Business profile step**: Company name, industry, description, website, phone, business email, target market, competitors list
- **Brand voice step**: Tone (professional/friendly/bold/etc.), colors, fonts, logo upload, custom brand voice statement
- **Channels step**: Multi-select from WhatsApp, Instagram, Messenger, Facebook, Web, Google Ads, Email, Slack, YouTube, TikTok, LinkedIn, Snapchat
- **Complete step**: Marks onboarding done, routes to dashboard home
- Progress is persisted; users can return to incomplete steps

### 5.3 Marketing Plan Generation

The platform's flagship feature. Generates a complete 30/60/90-day marketing strategy via a 14-agent LangGraph pipeline.

**Input parameters**: Business profile (auto-injected), monthly budget, language (ar/en/both), plan mode (fast/medium/deep), optional user feedback note

**14 output sections**:
1. **Market Analysis** — TAM/SAM/SOM, top 10 competitors, SWOT, trends, quick-wins
2. **Audience Personas** — 3 behavioral personas with jobs-to-be-done, triggers, objections
3. **Positioning** — value prop, differentiation pillars, brand archetype, tagline options
4. **Customer Journey** — 6-stage funnel (unaware → advocate) with emotions and touchpoints
5. **Offer Design** — core offer, urgency, risk-reversal, pricing tiers, upsell/cross-sell matrix
6. **Funnel Architecture** — AARRR with conversion rates and expected monthly customers
7. **Channel Plan** — 2–3 channels with budget allocation, expected CPL, intent classification
8. **Conversion System** — landing page logic, WhatsApp qualification scripts, CRM pipeline
9. **Retention Strategy** — first-30-days program, lifecycle stages, reactivation triggers
10. **Growth Loops** — one compounding loop with measurable outcomes
11. **Content Calendar** — 30-day post array with stage/objective/CTA/hashtags
12. **KPIs** — per-AARRR-stage + 8 mandatory metrics (CAC, LTV, LTV:CAC, etc.)
13. **Ad Strategy** — platform recommendations, budget breakdown, 3 scenarios (conservative/expected/aggressive)
14. **Execution Roadmap** — 30-day day-by-day priority actions with owner role and expected outcome

**Plan modes** (model selection per mode, configurable by superadmin):
- **Fast** (~$0.012/plan, ~3.2 min): Gemini 2.5 Flash for all subagents
- **Medium** (~$0.38/plan, ~2.6 min): GPT-4o for execution subagents
- **Deep** (~$0.59/plan, ~3.3 min): Claude Sonnet 4.5 for strategy subagents

**Additional plan features**:
- Section-level regeneration with optional feedback note
- Full plan regeneration with prior-plan summary injected
- Approval gate: owner marks plan "approved" → unlocks content/creative/video generation
- PDF export (WeasyPrint)
- PDF import + AI analysis (extract structure, suggest improvements, import as draft)
- Version history: every regeneration saves a snapshot; rollback to any prior version
- Plan sharing: rotating read-only token → public URL for external stakeholders
- Streaming generation: SSE stream with progress nodes visible in real-time

### 5.4 Content Generation

- **Types**: Blog articles (600–1200 words, SEO-optimized), social posts, captions, ad copy
- **Plan-aware**: `?plan_id=` param injects positioning + goals + personas + offer context as a brief prefix
- **Image suggestions**: 4 AI-generated image concept variations per post
- **Bulk generation**: Generate multiple posts in one request
- **SSE streaming**: Real-time token streaming to browser
- **Templates**: Create and reuse custom templates with system prompts
- **Content lifecycle**: draft → review → approved/rejected → scheduled → published
- **Activity log**: Every status change and comment tracked per post
- **A/B experiments**: Create variants with different models/prompts, track impressions/clicks/conversions/engagements, declare winner

### 5.5 Creative Generation

- **AI image generation**: Via Replicate (Flux-Schnell model), produces 4 WebP variations per prompt
- **Prompt engineering**: PromptEngineer subagent generates vivid, concrete prompts + negative prompts from user brief
- **Brand guard**: Ensures visual consistency with tenant brand voice before generation
- **Asset management**: Gallery view with filter by type; persistent in MinIO
- **Aspect ratio support**: 1:1, 4:3, 16:9 and others via Replicate API

### 5.6 Video Generation

- **Script writing**: AI generates voiceover script (3–5 sentences per 15 seconds)
- **Scene planning**: Visual plan for each script section
- **Voice synthesis**: ElevenLabs TTS (`eleven_multilingual_v2`), voice selected by language + gender preference
- **Video rendering**: External video-gen API (partially implemented)
- **Caption generation**: SRT/VTT captions from audio/script
- **Quota-gated**: Deducted from monthly video allowance

### 5.7 Social Media Scheduler

- **OAuth-connected accounts**: Meta (FB + IG), LinkedIn, X/Twitter, YouTube, TikTok, Snapchat
- **Scheduling**: Date/time, platform, caption, media URLs, content post linkage
- **Publish modes**:
  - **Auto**: Celery Beat publishes at scheduled time
  - **Manual**: Reminds user to post themselves; confirm with optional external URL
- **Calendar view**: Week and month grid with platform badges and publish-mode indicators
- **Content-gen linkage**: Schedule directly from a generated ContentPost; caption pre-filled
- **Connector status**: `GET /connectors` reports which platforms are server-configured vs. user-connected
- **Best times**: `GET /best-times` returns optimal posting windows per platform

### 5.8 SEO Tools

- **Keyword tracking**: Add keywords with search volume, difficulty, CPC, intent, target URL
- **Rank tracking**: Daily SERP position snapshots via Serper/DataForSEO
- **Per-page audit**: On-page metrics (title, meta, headings, speed, links)
- **Deep multi-page audit**: Crawls homepage + up to 4 internal links in parallel; checks robots.txt + sitemap.xml; LLM produces 6–10 prioritized recommendations (technical-seo / content / conversion / trust) with why + how + expected impact
- **Google Search Console integration**: OAuth → site selection → sync last 28 days of impressions/clicks/CTR/position
- **Google Analytics 4 integration**: OAuth → property selection → sync traffic + conversion data

### 5.9 Competitor Tracking

- **Competitor CRUD**: Name, website, description, social URLs (Instagram/Facebook/Twitter/LinkedIn/TikTok/YouTube)
- **Snapshots**: Scrape competitor pages, capture title/OG tags/headings/blog links
- **AI analysis**: ContentAnalyzer subagent extracts themes, content types, tone, positioning
- **Gap finder**: Identifies competitive opportunities vs. analyzed competitors
- **Two-way sync**: Competitor names sync bidirectionally with `tenant.config.business_profile.competitors`

### 5.10 Ads Management

- **Ad accounts**: Connect Google Ads, Meta Ads, Snapchat Ads, YouTube Ads
- **Campaign management**: CRUD for ad campaigns with budget, dates, status
- **AI campaign generation**: AdsAgent produces Meta-ready targeting specs, budget breakdown, creatives
- **Performance tracking**: Daily metrics (impressions, clicks, conversions, spend, revenue, CTR, CPC, ROAS)

### 5.11 Lead Management (CRM)

- **Lead capture**: Manual entry, public form (`POST /leads/public` — no auth), channel webhooks (WhatsApp, Messenger, Instagram)
- **Lead fields**: Name, email, phone, company, source, score, status, assigned user, custom metadata
- **Kanban pipeline**: Drag-and-drop across custom pipeline stages
- **AI qualification**: LeadQualifier agent scores 0–100 (hot/warm/cold) and suggests next action
- **Activity log**: Calls, emails, meetings, notes per lead
- **Custom stages**: Tenants define their own pipeline column names

### 5.12 Multi-Channel Inbox

- **Channels aggregated**: WhatsApp, Messenger, Instagram DMs, Email, Slack, Web chat
- **Incoming webhook handlers**: Meta webhook signature-verified for all Meta platforms
- **AI-powered inbox**: InboxAgent classifies intent, retrieves relevant knowledge base chunks, drafts reply
- **Escalation**: Auto-escalates complaints or low-confidence classifications to human
- **Conversation threads**: Full message history per session/customer

### 5.13 Analytics & Reporting

- **Overview dashboard**: Reach, engagement, leads, conversion — filterable by 7/30/90 days
- **Reports**: Create named reports (social performance, SEO, ads, campaign); snapshot history
- **Weekly digest**: Posts published, engagement rate, top post — surfaced on dashboard home
- **Competitor deltas**: Metric changes vs. competitors
- **SEO CTR trend**: Click-through rate trend from GSC data
- **Plan ROI**: Revenue projections vs. actuals linked to a marketing plan

### 5.14 AI Assistant

- **Chat interface**: Natural language queries about the tenant's marketing data, plans, content
- **Knowledge base RAG**: Semantic search over `knowledge_chunks` (pgvector) for grounded answers
- **Context-aware**: Injected with tenant's business profile and active marketing plan

### 5.15 Knowledge Base

- **Chunks**: Add FAQs, product descriptions, policies, custom content
- **Embeddings**: 1536-dimension pgvector embeddings for semantic search
- **Bulk import**: Upload multiple chunks at once
- **RAG integration**: InboxAgent and AI Assistant retrieve relevant chunks to ground responses

### 5.16 Notifications

- Notification center with unread count
- Actions triggered by: plan approval, content review requests, team invitations, social post failures, billing events

### 5.17 Settings & Configuration

- **Personal profile**: Name, email, language preference, avatar, password change, 2FA (stub)
- **Business profile**: Company details, industry, website, phone, business email
- **Brand settings**: Logo, colors, fonts, tone, brand voice statement
- **Channel settings**: Which communication channels are connected
- **Workflow settings**: Approval-required toggle for content publishing
- **Team management**: Invite/remove members, change roles, transfer ownership
- **API keys**: Create/revoke programmatic access keys (read/write scope)
- **Webhook subscriptions**: Outgoing webhooks per event type with HMAC-SHA256 signing
- **White-label** (Agency): Custom app name, domain, favicon, email sender, footer text, hide "Powered by" badge
- **Referrals**: Personal referral code, stats on referrals and conversions

### 5.18 Billing

- View current plan, usage per resource (articles/images/videos/AI tokens), days until renewal
- Upgrade/downgrade plan via any of 4 payment gateways
- Credit balance and transaction history
- Offline payment submission (bank transfer) with admin approval
- Plan change by superadmin (admin override)

### 5.19 Admin Panel (Superadmin)

- **Dashboard**: Cross-tenant stats (tenants, users, channels, messages, campaigns, AI costs)
- **Tenant management**: View/edit any tenant; manage subscription; view agent runs; override agent configs
- **Marketing plans**: Browse all plans cross-tenant
- **Offline payments**: Approve or reject manual payment submissions
- **AI providers**: CRUD for LLM provider definitions
- **Plan modes**: Configure which LLM model is used per mode + subagent
- **Skills/modules**: Enable/disable feature modules per tenant
- **Agent graphs**: Visualize LangGraph agent topology
- **Cost analytics**: Spend by agent + tenant

### 5.20 Public Features

- **Lead capture form**: `POST /leads/public` — embeddable in external sites (IP rate-limited, no auth)
- **Plan sharing**: Public read-only view at `/plans/public/{token}` — no login required
- **Health endpoints**: `/ops/status`, `/ops/ready`, `/ops/live`, `/health`

---

## 6. MODULE BREAKDOWN

### Backend Modules (44 total at `services/backend/app/modules/`)

| Module | Responsibility | Key Endpoints | Status |
|--------|---------------|--------------|--------|
| `auth` | Registration, login, profile, JWT, verification, GDPR | 11 endpoints | Full |
| `tenants` | Tenant profile | 2 endpoints | Full |
| `users` | User CRUD, invites | 4 endpoints | Full |
| `team` | Member management, invitations, ownership transfer | 10 endpoints | Full |
| `admin` | Superadmin dashboard + all cross-tenant ops | 35+ endpoints | Full |
| `plans` | Marketing plan CRUD, generation, versioning, sharing, PDF | 14 endpoints | Full |
| `plan_versioning` | Snapshot + rollback | 3 endpoints (under plans/) | Full |
| `plan_share` | Read-only token generation, public view | 3 endpoints (under plans/) | Full |
| `content` | ContentPost CRUD, approvals, activity log, calendar | 15 endpoints | Full |
| `content_gen` | AI content generation (single, bulk, stream) | 4 endpoints | Full |
| `content_templates` | Template CRUD + usage | 6 endpoints | Full |
| `experiments` | A/B content experiments | 3 endpoints | Full |
| `creative` | CreativeAsset CRUD, image generation | 6 endpoints | Full |
| `creative_gen` | AI creative generation + asset management | 3 endpoints | Full |
| `video_gen` | AI video generation + status polling | 2 endpoints | Partial |
| `media` | File/image upload → MinIO | 1 endpoint | Full |
| `social` | SocialAccount + SocialPost CRUD + metrics | 10 endpoints | Full |
| `social_scheduler` | OAuth flows, scheduling, auto/manual publish | 10 endpoints | Full |
| `channels` | Communication channel CRUD | 5 endpoints | Full |
| `seo` | Keywords, rankings, audits, deep audit | 9 endpoints | Full (audit stub) |
| `ads` | Ad accounts, campaigns, AI campaign gen | 6+ endpoints | Partial |
| `campaigns` | Multi-channel campaign CRUD + AI generation | 12 endpoints | Partial |
| `leads` | Lead CRUD, kanban, qualification, activities | 15 endpoints | Full |
| `public_leads` | Unauthenticated lead capture | 1 endpoint | Full |
| `analytics` | Overview, reports, snapshots, ROI, competitor deltas | 10 endpoints | Full |
| `analytics_dashboard` | Dashboard analytics widget data | Stub | Stub |
| `competitors` | Competitor CRUD + snapshots | 6 endpoints | Full |
| `research` | Research tools (referenced in main.py) | Unknown | Unclear |
| `billing` | Plans, subscription, checkout, webhooks, usage | 17 endpoints | Full |
| `tenant_settings` | Business profile, brand, channels, workflow | 8 endpoints | Full |
| `onboarding` | 4-step onboarding wizard | 5 endpoints | Full |
| `white_label` | White-label settings, domain verify | 3 endpoints | Full |
| `ai_assistant` | Website analysis, competitor discovery, logo colors | (service) | Full |
| `assistant` | Chat interface | 1 endpoint | Full |
| `inbox` | Conversations, messages, AI draft, send | 4 endpoints | Full |
| `knowledge` | Knowledge chunk CRUD, semantic search, bulk import | 6 endpoints | Full |
| `notifications` | Notification CRUD | (referenced) | Unknown |
| `integrations` | 3rd-party integration connections + OAuth | 6 endpoints | Partial |
| `webhooks` | Meta platform webhooks (WhatsApp/IG/Messenger) | 3 endpoints | Full |
| `webhook_subscriptions` | Outgoing webhooks + HMAC | (referenced) | Full |
| `referrals` | Referral code + stats + redeem | 2 endpoints | Full |
| `api_keys` | API key management (create/list/revoke) | 3 endpoints | Full (PATCH stub) |
| `feedback` | NPS + cancellation reason | 2 endpoints | Full |
| `ops` | Health, readiness, liveness probes | 4 endpoints | Full |

**Total API endpoints: ~180+ (of which ~140 are subscription-gated, ~35 superadmin-only, ~15 public)**

---

## 7. AI AGENT PIPELINE

### Architecture

All agents use **LangGraph** — a directed acyclic graph (DAG) of async nodes. Each node is a `BaseSubAgent` that receives the current state dict, calls an LLM via OpenRouter, and returns a partial state update. The orchestrating `BaseAgent` compiles the graph and invokes it with `ainvoke()`.

**Persistence**: PostgreSQL-backed `AsyncPostgresSaver` (falls back to `MemorySaver` in dev).  
**Tracing**: `AgentTracer` captures per-node timing + token counts → stored in `AgentRun.output["_traces"]`.  
**Model resolution**: All tiers currently map to `google/gemini-2.5-flash`; the StrategyAgent overrides per `PlanModeConfig` DB table.  
**Language handling**: `lang_directive(lang)` helper enforces output language across all subagents.

### 10 Top-Level Agents

#### Strategy Agent (14 sequential subagents)
The flagship pipeline. Input: business profile, language, budget, plan mode.

Subagent execution order:
`MarketAnalyzer → AudienceProfiler → PositioningStrategist → CustomerJourney → OfferDesigner → FunnelArchitect → ChannelPlanner → ConversionSystem → RetentionStrategy → GrowthLoops → ContentCalendar → KPISetter → AdStrategist → ExecutionRoadmap`

All outputs feed into subsequent nodes as accumulated state. Fully implemented. MENA benchmarks and budget constraints enforced at every stage.

#### Content Agent (5 nodes)
Routes on `target` field: blog → Blogger; caption → CaptionWriter; other → Copywriter.  
Then: BrandGuard → Translator. Fully implemented.

#### Creative Agent (3 nodes)
PromptEngineer → BrandGuard → ImageGenerator (Replicate/Flux-Schnell, 4 outputs). Fully implemented with graceful degradation if no API key.

#### Video Agent (6 nodes)
ScriptWriter → ScenePlanner → VoiceSelector → VoiceRenderer (ElevenLabs) → VideoRenderer (stub) → CaptionGenerator.  
Script + voice fully implemented; video rendering likely stubbed.

#### Analytics Agent (3 nodes)
MetricsSummarizer → InsightsGenerator → ReportWriter. All LLM-powered. Fully implemented.

#### Inbox Agent (4 nodes)
Classifier → KBRetriever → Responder (or Escalator if needs_human/spam). Fully implemented. Auto-escalates complaints and low-confidence classifications.

#### Ads Agent (4 nodes)
AudienceBuilder → BudgetPlanner → CreativeMatcher → Optimizer (queries AdCampaign/AdPerformance tables directly). All fully implemented.

#### Competitor Agent (3 nodes)
Scraper (httpx-based web scraper) → ContentAnalyzer → GapFinder. Fully implemented.

#### Lead Agent (1 node)
LeadQualifier: scores 0–100, classifies hot/warm/cold, suggests next action. Fully implemented.

#### SEO Agent (5 nodes)
Auditor (tool) → RankChecker (tool) → AuditAnalyzer → ContentSuggester → LinkingStrategist. Fully implemented.

### Model Tier System

| Tier Label | Current Model | Used By |
|------------|--------------|---------|
| fast | gemini-2.5-flash | Inbox Classifier, Lead Qualifier, Caption Writer |
| balanced | gemini-2.5-flash | Most subagents |
| smart | gemini-2.5-flash | Market analysis, positioning, growth loops, optimizer |
| vision | gemini-2.5-flash | Creative agent |
| long_context | gemini-2.5-flash | SEO agent |

**Note**: All tiers currently resolve to the same model. Differentiation was planned (Claude for `smart`, GPT-4o for `balanced`) and the infrastructure exists via `PlanModeConfig`, but isn't fully activated in the default model tier map.

### Cost Tracking

Every agent run records: `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`, `started_at`, `finished_at` in the `agent_runs` table. The superadmin `GET /admin/stats/cost` endpoint aggregates by agent and tenant.

---

## 8. USER FLOWS

### Flow 1: New Business Owner Onboarding → First Plan

1. Register at `/register` (capture `?ref=` referral if present)
2. Verify email
3. Onboarding wizard: business profile → brand voice → channel selection → complete
4. Dashboard home shows "Create your first plan" hero
5. `/plans/new`: select Fast/Medium/Deep, enter budget + language, click Generate
6. Real-time SSE stream shows 14 nodes completing
7. Review plan across 11 tabs (Market, Audience, Positioning, etc.)
8. Optionally regenerate any section with a feedback note
9. Click "Approve" → green panel unlocks content/creative/video generation

### Flow 2: Content Creation from Approved Plan

1. From approved plan → click "إنشاء مقالات" (Create Articles)
2. `/content-gen?plan_id=X` — plan context chip shown; brief pre-filled with positioning/goals
3. Adjust brief → Generate
4. Article created as ContentPost with `metadata.plan_id`
5. Review, optionally submit for team review
6. Approve → Schedule: `/scheduler/new?content_post_id=Y` pre-fills caption + platform
7. Set date/time, publish mode (auto/manual), submit
8. Celery publishes at scheduled time (auto) or user confirms manually

### Flow 3: PDF Import Path

1. `/plans/import` — upload existing marketing plan PDF
2. AI analyzes: extracts summary, strengths, weaknesses, improvements, detected sections
3. User selects which improvements to apply
4. "Import with improvements" → new MarketingPlan created as draft with AI enhancements

### Flow 4: Social Account OAuth + Publishing

1. `/scheduler/accounts` → "Connect Account" → select platform
2. Redirect to platform OAuth (Meta, LinkedIn, X, etc.)
3. OAuth callback → `SocialAccount` row created with encrypted token
4. `/scheduler/new` → platform dropdown shows connected accounts
5. Schedule post; Celery Beat `scan_due_posts` (1-min interval) picks it up at scheduled time
6. `publish()` connector method called; external post ID returned; `SocialPost.status → published`

### Flow 5: Lead Capture → CRM Pipeline

1. External form submits to `POST /leads/public` (no auth, IP-rate-limited)
   — OR — incoming WhatsApp/Messenger/Instagram DM triggers webhook
2. Lead created in DB with source tag
3. InboxAgent classifies intent, drafts AI reply
4. Team views lead in kanban, moves through pipeline stages
5. LeadQualifier agent scores lead: hot/warm/cold + next action
6. Activity log tracks all interactions

### Flow 7: Team Collaboration

1. Owner invites team member by email
2. Member accepts invite → registers → joins tenant with assigned role
3. Editor creates content, submits for review
4. Admin/Owner approves or rejects with note
5. Activity log on ContentPost shows full review trail

### Flow 8: White-Label Setup (Agency)

1. Agency customer on Agency plan → `/settings/white-label`
2. Enter custom app name, upload favicon/logo, set email sender
3. Enter custom domain → trigger domain verification
4. Sub-tenants see rebranded interface; "Powered by Ignify" hidden

---

## 9. FRONTEND ARCHITECTURE

### Framework & Patterns

- **Next.js 15.1** (App Router): Route groups `(auth)`, `(dashboard)`, `(admin)` for layout separation
- **React 19**: `"use client"` directives on interactive components; Server Components for static wrappers
- **TypeScript**: Strict types throughout; API response types defined inline
- **Tailwind CSS 4**: Material Design 3 token names (`bg-surface-container-lowest`, `text-on-surface`, `text-primary`, etc.)
- **Radix UI**: Accessible primitives (Avatar, Tabs, Dialog, etc.)
- **Recharts**: Data visualization
- **Lucide React**: Icon library
- **RTL support**: `dir="rtl"` on `<html>` for Arabic; `rtl:rotate-180` utility classes on arrows

### State Management

- **Zustand** (`auth.store.ts`): Persists `{user, tenant, accessToken, refreshToken}` to `ignify_auth` localStorage key
- All other state is local `useState` or derived from API responses

### API Client (`lib/api.ts`)

- Base URL from `NEXT_PUBLIC_API_URL`
- Auto-attaches `Authorization: Bearer {token}` header
- On 401: auto-refreshes token via `POST /auth/refresh`, retries original request
- On refresh failure: clears tokens, redirects to `/login`
- Handles `FormData` vs JSON body automatically
- Returns `undefined` for 204 No Content

### i18n

- `next-intl` v3.25: locale in URL path (`/ar/...`, `/en/...`)
- Arabic default; 2,000+ translation keys in `messages/ar.json` and `messages/en.json`
- Namespaces: common, auth, sidebar, dashboard, plans, scheduler, billing, seoPage, experiments, whiteLabel, analyticsDash, settingsPage, adminDash, and more
- `dir="rtl"` + font adjustments for Arabic

### Key Pages (50+ routes)

**Auth**: login, register (with `?ref=` capture), verify, accept-invite  
**Onboarding**: business, brand, channels, plan (4-step wizard)  
**Plans**: list, new (stream), detail (11-tab view), import, versions, public/[token]  
**Content**: content-gen, bulk-gen, templates, content library, post detail + analytics  
**Creative**: generate, gallery  
**Video**: generate (queued)  
**Scheduler**: week/month calendar, new post, connected accounts  
**SEO**: keyword tracker, site audit, deep audit, GSC/GA4 connect  
**Competitors**: list, detail  
**Ads**: accounts, campaigns, new campaign  
**CRM**: leads kanban, lead detail  
**Campaigns**: list, detail  
**Analytics**: overview dashboard  
**Inbox**: conversation list, thread, AI assistant  
**Settings**: hub + 9 sub-pages (profile, business, brand, channels, team, security, API keys, webhooks, referrals, white-label)  
**Billing**: plan selection, usage, payment success/cancel  
**Admin**: dashboard + 8 management sections  
**Public**: plan share view, legal/privacy, legal/terms, changelog  

### Key Components

`Sidebar`, `DashboardHeader`, `MobileTabBar`, `Button`, `Card`, `Badge`, `Avatar`, `Modal`, `Skeleton`, `EmptyState`, `StatCard`, `DataTable`, `PageHeader`, `FormField`, `ConfirmDialog`, `AIUsageWidget`, `QuotaBanner`, `SubscriptionWall`, `WelcomeTour`, `NPSWidget`, `EmailVerificationBanner`, `PlatformPreview`, `OnboardingProgress`, `BrandedLayout`, `Toaster`

---

## 10. INTEGRATIONS & INFRASTRUCTURE

### Social Platform Integrations

| Platform | OAuth | Publish | Token Encryption | Status |
|----------|-------|---------|-----------------|--------|
| **Meta (FB + IG)** | ✅ | ✅ | ✅ | Production-ready |
| **LinkedIn** | ✅ | ✅ | ✅ | Working (60-day TTL, refresh TODO) |
| **X / Twitter** | ✅ OAuth2+PKCE | ⚠️ | ✅ | Requires $200/mo Basic plan |
| **YouTube** | ✅ | ⚠️ | ✅ | Comment draft only; video upload TODO |
| **TikTok** | ✅ | ⚠️ | ✅ | Sandbox only (app review pending) |
| **Snapchat** | ✅ | ❌ | ✅ | No public publish API |

### Messaging Channel Connectors (Docker services)

| Channel | Technology | Port | Status |
|---------|-----------|------|--------|
| WhatsApp | Baileys (Node.js) | 3001 | Active |
| Messenger | Node.js | 3003 | Active |
| Instagram DM | Node.js | 3006 | Active |
| Email | Python IMAP/SMTP | 3004 | Active |
| Slack | Slack Bolt | 3005 | Active |

### Third-Party Service Dependencies

| Service | Purpose | Required For |
|---------|---------|-------------|
| **OpenRouter** | LLM gateway (all AI) | Everything AI |
| **Replicate** | Image generation (Flux-Schnell) | Creative gen |
| **ElevenLabs** | Text-to-speech | Video gen |
| **Serper / DataForSEO** | SERP data | SEO rank tracking |
| **Stripe** | Global payments | Billing |
| **Paymob** | Egypt payments | Billing (EGP) |
| **PayTabs** | MENA payments | Billing (SAR/AED) |
| **Geidea** | Saudi pay-by-link | Billing (SAR) |
| **Google OAuth** | Search Console + GA4 | SEO integrations |
| **Sentry** | Error tracking | Observability |

### Environment Variable Groups

Backend requires ~60 environment variables across: DB, Redis, MinIO, SMTP, OpenRouter, direct LLM providers, all 6 social platform OAuth apps, all 4 billing providers, Google OAuth, Serper/DataForSEO, Sentry, and general app config.

### Billing: Quota Enforcement

| Resource | How Counted | Free | Starter | Pro | Agency |
|----------|------------|------|---------|-----|--------|
| Articles | ContentPost count (30 days) | 5 | 30 | 150 | unlimited |
| Images | CreativeAsset count (30 days) | 10 | 100 | 500 | unlimited |
| Videos | CreditTransaction (video actions) | 1 | 10 | 50 | 500 |
| AI Tokens | CreditTransaction sum | 50K | 500K | 3M | 20M |

`check_quota()` raises HTTP 402 if exceeded; enforced on all generation endpoints.

---

## 11. SECURITY MODEL

### Authentication

- **JWT**: HS256, access token 30 min, refresh token 7 days
- **Token blacklist**: Logout pushes access token to Redis blacklist; checked on every request
- **Password hashing**: bcrypt
- **Email verification**: Token-based, 24hr expiry, required in production

### Authorization (RBAC)

| Role | Key Permissions |
|------|----------------|
| **superadmin** | All (`*`) — platform operators |
| **owner** | billing, team.*, agents.configure, plans.approve, content.all, ads.all, settings.all |
| **admin** | team.invite/remove/change_role, agents.configure, plans.approve, content.all, ads.all, settings.view |
| **editor** | content.create, content.edit, plans.view, inbox.respond |
| **viewer** | content.view, plans.view, inbox.view, analytics.view |

Permission wildcards: `content.all` → all `content.*`; `*` → everything.

### Data Protection

- **Tenant isolation**: `tenant_id` filter enforced on every query
- **Token encryption**: Fernet (AES-128) for all social OAuth tokens and API keys; backward-compatible with pre-encryption plaintext
- **Webhook signatures**: All inbound webhooks verified (Stripe: HMAC-SHA256; Meta: SHA256; Paymob: HMAC-SHA512; PayTabs: HMAC-SHA256; Geidea: HMAC-SHA256)
- **PCI compliance**: Card data never touches servers; all payments delegated to hosted checkout pages

### Rate Limiting

| Endpoint Group | Limit |
|---------------|-------|
| Auth endpoints | 20 req/min/IP |
| Plan generation | 10/hr |
| Video generation | 10/hr |
| Content generation | 60/hr |
| Global safety net | 100 req/min/IP |

### Security Headers

HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, CSP (configurable)

---

## 12. CURRENT SYSTEM STATE

### Fully Implemented & Production-Ready

- Multi-tenant auth, RBAC, JWT, email verification, GDPR export
- Onboarding wizard (4 steps)
- Marketing plan generation — complete 14-agent pipeline, all 3 modes
- Plan: section regen, full regen, PDF export, PDF import, versioning, sharing, approval gate
- Content generation (articles, posts, captions) with plan context + streaming
- A/B content experiments
- Content templates (create, reuse, custom prompts)
- Creative generation (Flux-Schnell, 4 variations)
- Social scheduler: OAuth for all 6 platforms, auto/manual publish, content linkage, calendar
- SEO: keyword tracking, rank snapshots, per-page audit, deep audit (LLM recommendations)
- Competitor tracking + AI analysis + two-way business profile sync
- Leads CRM: kanban, AI qualification, activity log, custom pipeline stages
- Public lead capture (embeddable form)
- Multi-channel inbox: WhatsApp/Messenger/Instagram webhooks, AI draft replies, escalation
- Billing: 4 gateways, quota enforcement, offline payment workflow, credit ledger
- Admin panel: full cross-tenant visibility, agent cost stats, plan mode config
- Team management: invitations, roles, ownership transfer
- White-label: custom branding, domain verification
- API keys, outgoing webhooks (HMAC-signed)
- Referral program
- Knowledge base with pgvector RAG
- NPS + cancellation reason feedback
- Notification center
- Settings: all 9 sub-pages
- Docker Compose topology for all services

### Partially Implemented

| Feature | What's Done | What's Missing |
|---------|-------------|---------------|
| **Video generation** | Script writing, voice synthesis (ElevenLabs), scene planning | Video renderer (external API call likely stubbed), captions |
| **Google SEO integrations** | OAuth flow, storage, sync endpoints coded | Not tested end-to-end with real credentials; refresh token edge cases unverified |
| **TikTok publishing** | OAuth + publish code works in sandbox | Production requires TikTok app review approval |
| **YouTube video upload** | Basic multipart upload (≤256 MB) | Resumable upload for large files |
| **LinkedIn token refresh** | Token stored, refresh connector exists | `refresh_token` column missing in `social_accounts` table |
| **Social token encryption** | Column named `access_token_encrypted`, Fernet encrypt/decrypt code exists | Previously stored plaintext; encrypt-on-next-refresh in place but bulk re-encryption not done |
| **Analytics dashboard** | Backend module referenced | Router/service implementation unclear |
| **Ads module** | Account + campaign CRUD | AI campaign generation partially stubbed |
| **Integrations (3rd party)** | OAuth callback exists | Largely stub — no real Zapier/Make connections |
| **2FA** | Settings page UI link exists | Not implemented in auth flow |
| **Campaigns** | CRUD + AI generation endpoint | AI generation calls external service not fully wired |

### Stubbed / Placeholder

- `ads.agent` → some sub-renderers have `pass` stubs
- `analytics_dashboard` → module referenced in main.py but not analyzed
- `research` module → unknown status
- `notifications` module → in main.py but not documented
- Legal pages (`/legal/privacy`, `/legal/terms`) → drafted stubs, pending legal review
- `conversations` module → referenced but not detailed

---

## 13. TECHNICAL DEBT & RISKS

### High Priority (Block Production Launch)

1. **Social token plaintext exposure**: `access_token_encrypted` column name is misleading — initial data was stored plaintext. The Fernet re-encryption happens on next refresh, but tokens that haven't refreshed are still plaintext. Needs a bulk migration script before onboarding real users.

2. **LinkedIn token persistence gap**: `social_accounts` table is missing the `refresh_token` column. LinkedIn tokens expire after 60 days. Without refresh, all LinkedIn users will need to re-OAuth every 60 days.

3. **`social_posts.social_account_id` NOT NULL**: The column is non-nullable, blocking "manual schedule without a connected account" flow. A migration to make it nullable is needed for proper manual-only scheduling.

4. **No test suite**: Only `scripts/smoke_test.py` exists. Zero unit or integration tests. Any regression goes undetected until production.

5. **Secret management**: All secrets are in `.env` files. No vault integration. Rotating `SECRET_KEY` would invalidate all existing JWTs.

### Medium Priority

6. **Model tier undifferentiated**: All tiers (`fast`, `balanced`, `smart`, `vision`) currently map to the same model (Gemini 2.5 Flash). The advertised differentiation (Claude for deep, GPT-4o for medium) exists only in `plan_modes.py` for the StrategyAgent and requires DB config — it's not the default.

7. **JSON column sprawl**: Heavy use of JSON/JSONB for plan content, business profile, agent configs. No schema validation at DB level. Migrations can't enforce structure. Silent data corruption risk.

8. **In-memory OAuth state store**: `oauth_state.py` uses a Python dict with 10-min TTL. Worker restarts lose all pending OAuth flows. Needs Redis-backed storage for production.

9. **Video rendering incomplete**: The `VideoRenderer` subagent is likely stubbed. Video generation is advertised in billing tiers but may not produce actual videos.

10. **`PlanModeConfig` default seeding**: The StrategyAgent relies on `PlanModeConfig` rows being seeded in DB. If DB is reset or fresh-migrated without seeding, plan generation will fail.

### Lower Priority

11. **Duplicate business profile storage**: Business profile exists in both `config.business_profile` (flat) and `config.onboarding.business_profile` (nested). `_pick_business_profile()` heuristic can pick wrong source.

12. **No cursor-based pagination**: List endpoints use offset/limit, which degrades at scale.

13. **MinIO single node**: Object storage is a single MinIO container — no replication, no versioning enabled by default.

14. **`AgentRun` output field size**: Full plan output is stored in `agent_runs.output` (JSON). A single deep plan can be 50–100KB. No TTL or archiving policy.

---

## 14. SUGGESTED IMPROVEMENTS

### Immediate (Pre-Launch)

1. **Bulk token re-encryption script**: Scan `social_accounts` where token is not Fernet-encoded, encrypt in place. Run as a one-time migration.

2. **Add `refresh_token` to `social_accounts`**: Single Alembic migration + LinkedIn connector update. Prevents mass re-auth at day 60.

3. **Redis-backed OAuth state**: Replace in-memory dict in `oauth_state.py` with Redis (TTL-backed). 2-hour change.

4. **Nullable `social_account_id`**: Migration + worker guard to skip auto-publish for manual-mode posts. Unblocks a deferred roadmap item cleanly.

5. **Seed script for `PlanModeConfig`**: Make it idempotent and part of deployment startup, not just a one-time script.

### Short-Term (First Month Post-Launch)

6. **Integration test suite**: Start with 10 critical path tests: register → onboard → generate plan → generate content → schedule post. Use pytest-asyncio + real DB in Docker.

7. **Model tier activation**: Map `smart` → `claude-sonnet-4-6`, `balanced` → `gemini-2.5-flash`, `fast` → `gemini-2.5-flash`. This delivers on the advertised quality differentiation between plan modes.

8. **YouTube resumable upload**: Replace multipart with Google's resumable upload protocol for files >256 MB.

9. **Analytics dashboard module**: Complete the stubbed router/service so dashboard widgets have real data.

10. **Error boundary standardization**: Frontend has no global error boundary. Unhandled async errors in useEffect silently fail. Add React Error Boundary wrapper.

### Medium-Term

11. **Cursor-based pagination**: Replace `OFFSET/LIMIT` with `WHERE id > :last_id` pattern for all list endpoints that could grow large (content, leads, agent_runs).

12. **AgentRun archiving policy**: Compress and archive `agent_runs` older than 90 days to cold storage. Index `started_at` for range queries.

13. **WebSocket for real-time events**: Replace polling (notifications, scheduler status) with WebSocket or Server-Sent Events subscription on a `/ws/events` endpoint.

14. **Proper multi-model differentiation**: Activate different models per tier in the global model registry, not just for the StrategyAgent.

15. **Workflow approval enforcement**: The `approval_required` workflow setting exists but needs server-side enforcement (block `POST /social-scheduler/schedule` unless ContentPost is approved).

---

## 15. SCALABILITY CONCERNS

### Database

- **Single PostgreSQL instance**: No read replicas. Heavy analytics queries (report generation, `AgentRun` cost aggregation) run on the primary. Will degrade write latency under load.
- **pgvector at scale**: Cosine similarity search over `knowledge_chunks` is an exact scan today. At 100K+ chunks per tenant, needs `ivfflat` or `hnsw` index per tenant.
- **No connection pooling**: FastAPI + asyncpg connects directly to Postgres. At >100 concurrent requests, needs PgBouncer or a managed pool.
- **`agent_runs` growth**: Every plan generation creates 14 rows. At 1,000 plans/day → 14,000 rows/day. No archiving policy.

### Celery Workers

- **Single worker type**: All tasks share one worker queue. Expensive video rendering competes with fast email sends. Needs task routing to dedicated queues.
- **Beat scheduler single point of failure**: One `worker-beat` container. If it crashes, all scheduled posts are delayed indefinitely.
- **No task deduplication**: Duplicate Celery tasks for the same `social_post_id` could double-publish.

### API Layer

- **No horizontal scaling config in docker-compose**: Backend and workers run as single containers. Scaling requires Kubernetes or manual replication.
- **Rate limiting in memory**: Current rate limiter uses Redis, which is correct, but limits are per-IP rather than per-tenant for most endpoints. A single tenant making many requests on different IPs bypasses per-tenant limits.

### LLM Costs

- **No cost caps per tenant**: A Pro tenant could generate 100 deep plans in a month (if quotas aren't tight) at $0.59 each = $59 in LLM costs against a $99 subscription. Needs per-tenant OpenRouter spend limits (infrastructure exists via `TenantOpenRouterConfig` but may not be enforced end-to-end).
- **OpenRouter single key**: If the main OpenRouter key is rate-limited or suspended, all AI features go down simultaneously.

---

## 16. SECURITY CONCERNS

### Critical

1. **Plaintext social tokens** (see Technical Debt #1): If DB is breached before re-encryption migration, all OAuth tokens are exposed in plaintext despite the column's misleading name.

2. **SECRET_KEY in .env**: `SECRET_KEY` signs all JWTs and derives the Fernet key for token encryption. A leaked `.env` file compromises both authentication and all stored tokens simultaneously.

3. **No SSRF protection on competitor scraper**: `scrape_public_page(url)` in the competitor agent fetches arbitrary URLs provided by tenant users. No allow/deny list, no internal IP block. Could be abused to probe internal services.

### High

4. **API key hashing**: `ApiKey.key_hash` stores the key hashed, which is correct. But the prefix (first 24 chars) is stored plaintext for display — ensure this prefix alone cannot be used for authentication or guessing.

5. **Webhook URL validation**: Outgoing webhook URLs are stored without validation. A tenant could register an internal IP (`http://10.0.0.x/`) as a webhook target, creating a Server-Side Request Forgery vector.

6. **MinIO bucket public access**: If the MinIO bucket is misconfigured as public (common in dev), all uploaded user assets (logos, creative images) are publicly accessible by URL enumeration.

7. **`/leads/public` endpoint**: IP-rate-limited but no CAPTCHA. Automated scraping of the endpoint could enumerate rate limits or cause database spam.

### Medium

8. **JWT algorithm downgrade**: `HS256` is used. If `SECRET_KEY` is weak (less than 256-bit entropy), JWT tokens are brute-forceable. The `.env.example` default is a short placeholder.

9. **Email verification token entropy**: If the verification token is not cryptographically random and sufficiently long, it could be brute-forced.

10. **Audit log integrity**: `AuditLog` rows can be deleted by anyone with direct DB access. No append-only guarantee at the application layer.

---

## 17. PERFORMANCE RISKS

### Backend

1. **Synchronous PDF generation**: `WeasyPrint` renders plan PDFs synchronously in the request handler. Large plans could block the event loop for 5–15 seconds. Should be offloaded to Celery.

2. **N+1 queries in plan detail**: The plan detail endpoint joins multiple JSON columns. If `list_scheduled` joins `ContentPost` titles, similar N+1 patterns may exist elsewhere.

3. **Deep audit parallel crawl**: `core/seo_audit_deep.py` crawls homepage + 4 internal links in parallel with asyncio. No timeout cap on individual page fetches. A slow target site could block the request handler.

4. **LangGraph state size**: The StrategyAgent accumulates all 14 subagent outputs in one state dict. A deep plan state can reach 100–200KB. This is checkpointed to Postgres, deserialized on every resume, and returned in full from the API.

5. **Competitor snapshot scraping**: `POST /competitors/{id}/snapshot` scrapes live pages in the request handler. No timeout. No background offload.

### Frontend

6. **No virtualization on long lists**: `DataTable` renders all rows in DOM. Leads, content posts, and agent runs lists could have thousands of rows with no windowing.

7. **No React Query / SWR**: API calls use raw `useEffect` + `useState`. No caching, no deduplication, no stale-while-revalidate. Every page mount triggers fresh API calls.

8. **Large translation bundles**: Both `ar.json` and `en.json` are loaded fully. At 2,000+ keys each, these add ~100KB to the initial bundle.

9. **No image optimization pipeline**: User-uploaded logos and generated creatives are served directly from MinIO. No CDN, no WebP conversion, no responsive srcsets.

### Infrastructure

10. **Redis as single broker + cache + result backend**: Three logical channels on one Redis instance. A Redis memory spike (large result payloads) can evict broker messages.

---

*End of MASTER_CONTEXT.md — generated 2026-04-24*  
*This document is AI-ready and suitable for use as a system prompt context, product brief, or CTO reference.*
