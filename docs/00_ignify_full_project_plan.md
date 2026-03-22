# Ignify - Full Project Plan

> AI-Powered Marketing SaaS Platform
> Forked from URTWIN multi-tenant architecture, customized for marketing agency automation.

---

## 1. Project Overview

**Ignify** is a multi-tenant AI marketing SaaS platform that provides businesses with a complete marketing automation suite. Each tenant (business/client) gets an isolated workspace with AI-powered tools for content creation, ad management, analytics, image generation, and multi-channel communication.

### Core Idea

- Fork URTWIN's multi-tenant architecture (auth, tenant isolation, skills, channels, Docker deployment)
- Replace URTWIN's generic AI agent skills with **marketing-specific modules**
- Add a **public website** container alongside the dashboard
- Add **assistant chat** per tenant for marketing guidance
- Full marketing toolchain: content, ads, analytics, creative, CRM

### What We Copy from URTWIN

| Component | What We Take | Customization |
|---|---|---|
| Multi-tenant auth | JWT, roles, invites, tenant isolation | Rename tokens from `urtwin_*` to `ignify_*` |
| Superadmin portal | Tenant management, AI providers, logs | Add marketing-specific admin tools |
| AGNO Runtime | AI execution engine, tool calling loop | Keep as-is, add marketing tools |
| Channel connectors | WhatsApp, Messenger, Telegram, Slack, Email | Add Instagram DM, Snapchat, YouTube comments |
| Platform channels | Superadmin-owned shared channels | Keep for shared marketing channels |
| Skills architecture | Pluggable skill system, registry pattern | Replace skills with marketing modules |
| Assistant chat | Per-tenant AI assistant in dashboard | Customize for marketing assistant |
| Credit system | Usage metering and billing | Adapt pricing for marketing actions |
| Docker deployment | 11-service docker-compose, Nginx gateway | Add website container, expand services |
| i18n (EN + AR) | next-intl, RTL support | Keep bilingual support |
| Database patterns | SQLAlchemy async, Alembic migrations, tenant_id isolation | Extend schema for marketing tables |

---

## 2. Architecture

```
                    +-------------------------------------------+
                    |            NGINX Gateway                   |
                    |  /         -> Website (public)             |
                    |  /app/*    -> Dashboard                    |
                    |  /api/*    -> Backend API                  |
                    |  /wa/*     -> WhatsApp Connector           |
                    |  /msg/*    -> Messenger Connector          |
                    |  /ig/*     -> Instagram Connector          |
                    +--------------------+----------------------+
                                         |
          +------------------------------+------------------------------+
          |                              |                              |
  +-------v--------+          +---------v---------+          +---------v--------+
  |   Website       |          |    Dashboard       |          |   Backend API     |
  |   Next.js       |          |    Next.js 16      |          |   FastAPI          |
  |   Port 3010     |          |    Port 3000       |          |   Port 8000        |
  |   (Public site) |          |    (Tenant app)    |          |                    |
  +----------------+          +-------------------+          +--------+---------+
                                                                       |
                    +--------------------------------------------------+
                    |                       |                           |
           +--------v--------+   +---------v---------+   +------------v---------+
           |  AGNO Runtime    |   |   PostgreSQL 16    |   |     Redis 7           |
           |  AI Execution    |   |   All data         |   |     Cache + Queues     |
           |  Port 8001       |   |   Port 5432        |   |     Port 6379          |
           +-----------------+   +-------------------+   +----------------------+

  +--------+--------+--------+--------+--------+--------+--------+
  |WhatsApp|Messenger|Instagram| Snap  | YouTube|  Email | Slack  |
  |  3001  |  3003   |  3006   | 3007  |  3008  |  3004  | 3005   |
  +--------+--------+--------+--------+--------+--------+--------+

  +-------------------+-------------------+-------------------+
  |   Google Ads API   |   Meta Ads API    |   Snap Ads API    |
  |   (Connector)      |   (Connector)     |   (Connector)     |
  +-------------------+-------------------+-------------------+
```

### Containers (Docker Compose)

| # | Service | Tech | Port | Purpose |
|---|---|---|---|---|
| 1 | `postgres` | PostgreSQL 16 | 5432 | All data |
| 2 | `redis` | Redis 7 | 6379 | Cache, JWT blacklist, task queues |
| 3 | `minio` | MinIO | 9000 | Object storage (images, reports, assets) |
| 4 | `backend` | FastAPI (Python) | 8000 | Core API |
| 5 | `agno-runtime` | FastAPI (Python) | 8001 | AI execution engine |
| 6 | `dashboard` | Next.js 16 | 3000 | Tenant dashboard app |
| 7 | `website` | Next.js | 3010 | Public marketing website (about Ignify) |
| 8 | `whatsapp-connector` | Node.js + Baileys | 3001 | WhatsApp channel |
| 9 | `messenger-connector` | Node.js | 3003 | Facebook Messenger channel |
| 10 | `instagram-connector` | Node.js | 3006 | Instagram DM channel |
| 11 | `snapchat-connector` | Node.js | 3007 | Snapchat channel |
| 12 | `youtube-connector` | Node.js | 3008 | YouTube comments channel |
| 13 | `email-connector` | Python (IMAP/SMTP) | 3004 | Email channel |
| 14 | `slack-connector` | Node.js + Bolt | 3005 | Slack channel |
| 15 | `gateway` | Nginx | 80/443 | Reverse proxy + SSL |

---

## 3. Tenant & User Model

### Copied from URTWIN (with renaming)

- **Tenant** = a business/client that signs up to Ignify
- **Users** belong to a tenant, with roles: `owner`, `admin`, `editor`, `viewer`
- **Superadmin** = Ignify platform operator (manages all tenants, AI providers, platform channels)
- Full data isolation: every query filters by `tenant_id`
- JWT auth (access 30min + refresh 7d), bcrypt passwords, Redis token blacklist

### Tenant Features

- Each tenant gets:
  - Isolated workspace with their own data
  - Assistant chat (AI marketing assistant in dashboard)
  - Ability to add their own AI provider keys (or use platform defaults)
  - Channel connections (WhatsApp, Messenger, Instagram, etc.)
  - Marketing module installations
  - Credit balance for AI usage

### Superadmin Features

- Manage all tenants (activate, suspend, view usage)
- Configure platform AI providers (OpenAI, Anthropic, Google, etc.)
- Manage platform channels (shared WhatsApp numbers, etc.)
- View audit logs
- Set credit pricing per action
- Manage marketing module catalog

---

## 4. Marketing Modules (Skills System)

Replace URTWIN's generic skills with marketing-specific modules. Keep the same pluggable architecture:

```
app/skills/
├── base.py                    # BaseSkill ABC (from URTWIN)
├── registry.py                # SkillRegistry + dispatcher (from URTWIN)
│
├── content_engine/            # AI Content Creation
│   ├── skill.py
│   ├── tools.py
│   ├── handlers.py
│   ├── prompt.py
│   └── schema.py
│
├── creative_engine/           # Image & Visual Generation
│   ├── skill.py
│   ├── tools.py
│   ├── handlers.py
│   ├── prompt.py
│   └── schema.py
│
├── ads_orchestrator/          # Google Ads + Meta Ads + Snap Ads
│   ├── skill.py
│   ├── tools.py
│   ├── handlers.py
│   ├── prompt.py
│   └── schema.py
│
├── seo_intelligence/          # SEO Analysis & Optimization
│   ├── skill.py
│   ├── tools.py
│   ├── handlers.py
│   ├── prompt.py
│   └── schema.py
│
├── competitor_intel/          # Competitor Monitoring
│   ├── skill.py
│   ├── tools.py
│   ├── handlers.py
│   ├── prompt.py
│   └── schema.py
│
├── social_media/              # Social Media Management
│   ├── skill.py
│   ├── tools.py
│   ├── handlers.py
│   ├── prompt.py
│   └── schema.py
│
├── lead_crm/                  # Lead Management & CRM
│   ├── skill.py
│   ├── tools.py
│   ├── handlers.py
│   ├── prompt.py
│   └── schema.py
│
├── analytics/                 # Marketing Analytics & Reporting
│   ├── skill.py
│   ├── tools.py
│   ├── handlers.py
│   ├── prompt.py
│   └── schema.py
│
├── campaign_manager/          # Campaign Orchestration
│   ├── skill.py
│   ├── tools.py
│   ├── handlers.py
│   ├── prompt.py
│   └── schema.py
│
└── market_research/           # Market & Store Analysis
    ├── skill.py
    ├── tools.py
    ├── handlers.py
    ├── prompt.py
    └── schema.py
```

### Module Details

#### 4.1 Content Engine
- Blog post generation (SEO-optimized)
- Social media captions (per platform: Instagram, Twitter/X, LinkedIn, Facebook)
- Email marketing copy (newsletters, drip sequences)
- Product descriptions
- Ad copy (Google Ads headlines/descriptions, Meta ad text)
- Content calendar planning
- Multi-language content (EN + AR)
- Tone & brand voice customization per tenant

#### 4.2 Creative Engine (Image Generation)
- Social media post graphics
- Ad banners (Google Display, Meta, Snapchat)
- Story/Reel cover images
- Logo variations and brand assets
- Product mockups
- Integration with: DALL-E, Stable Diffusion, Midjourney API
- Template library with brand colors/fonts overlay
- Image resize for each platform's dimensions

#### 4.3 Ads Orchestrator
- **Google Ads**: Create/manage campaigns, ad groups, keywords, bidding
- **Meta Ads** (Facebook + Instagram): Campaign creation, audience targeting, budget management
- **Snapchat Ads**: Campaign management via Snap Marketing API
- **YouTube Ads**: Video campaign management via Google Ads API
- Cross-platform budget allocation
- A/B test management
- Automated bid adjustments based on performance
- Campaign performance alerts

#### 4.4 SEO Intelligence
- Keyword research and tracking
- On-page SEO analysis
- Technical SEO audit (site speed, mobile, structured data)
- Backlink monitoring
- SERP position tracking
- Content gap analysis
- SEO recommendations with auto-implementation
- Integration with: Google Search Console, Google Analytics

#### 4.5 Competitor Intelligence
- Competitor website monitoring
- Ad spy (what ads competitors are running)
- Social media competitor analysis
- Pricing monitoring
- Content strategy comparison
- Market positioning insights
- Automated competitor reports

#### 4.6 Social Media Management
- Post scheduling across all platforms
- Auto-posting with optimal timing
- Hashtag research and suggestions
- Engagement analytics per platform
- Comment/DM auto-responses (via channel connectors)
- Platform-specific formatting
- Supported platforms: Instagram, Facebook, Twitter/X, LinkedIn, Snapchat, YouTube, TikTok

#### 4.7 Lead CRM
- Lead capture from all channels (WhatsApp, Messenger, website forms, ads)
- Lead scoring with AI
- Pipeline management (stages, automation)
- Contact management
- Follow-up reminders and automation
- Lead source attribution
- Conversion tracking

#### 4.8 Analytics & Reporting
- Unified marketing dashboard
- Cross-platform ad performance
- ROI calculation per channel/campaign
- Custom report builder
- Automated weekly/monthly reports (PDF + email)
- Google Analytics integration
- Real-time metrics
- Store/branch performance comparison

#### 4.9 Campaign Manager
- Multi-channel campaign orchestration
- Campaign workflow builder (if X then Y)
- A/B testing framework
- Audience segmentation
- Campaign templates
- Drip campaign automation
- Budget tracking and alerts

#### 4.10 Market Research
- Store market analysis (foot traffic, demographics)
- Industry trend monitoring
- Customer sentiment analysis
- Survey creation and analysis
- Business benchmarking
- Local market insights
- Competitor store analysis

---

## 5. Communication Channels

### Copied from URTWIN

| Channel | Purpose in Ignify |
|---|---|
| WhatsApp (Baileys) | Customer support, lead capture, campaign messages |
| Messenger (Facebook) | Customer engagement, chatbot marketing |
| Email (IMAP/SMTP) | Email marketing, newsletters, follow-ups |
| Slack | Internal team notifications, alerts |

### New Channels to Add

| Channel | Tech | Purpose |
|---|---|---|
| Instagram DM | Instagram Graph API | DM automation, story replies |
| Snapchat | Snap Kit API | Direct engagement |
| YouTube | YouTube Data API v3 | Comment management, community engagement |
| SMS (future) | Twilio / local provider | SMS marketing campaigns |
| TikTok (future) | TikTok API | Engagement, comment management |

### Channel Flow for Marketing

```
Customer interacts on any channel
  -> Connector receives message
  -> POST /api/v1/conversations/inbound
  -> Backend loads tenant config + installed modules
  -> AI assistant responds (using marketing context)
  -> Lead automatically captured in CRM
  -> Conversation tagged by campaign (if applicable)
  -> Analytics updated
```

---

## 6. Assistant Chat (Per Tenant)

Copied from URTWIN's assistant feature. Each tenant gets an AI marketing assistant in their dashboard that can:

- Answer marketing questions
- Generate content on demand
- Provide campaign suggestions
- Analyze performance data
- Create ad copy and images
- Suggest budget optimizations
- Generate reports
- Help with SEO recommendations

**Endpoint**: `POST /api/v1/assistant/chat` (same as URTWIN)
**Enhancement**: System prompt is built from installed marketing modules, giving the assistant context about the tenant's active tools and data.

---

## 7. Database Schema (Extended)

### Keep from URTWIN

- `tenants`, `users`, `plans`, `refresh_tokens`, `invitations`, `audit_logs`
- `channels`, `sessions`, `messages`
- `skills`, `skill_installations`, `channel_skills`
- `ai_providers`, `tenant_ai_configs`
- `credit_pricing`, `credit_balances`, `credit_transactions`, `credit_purchases`
- `platform_channels`, `tenant_phone_numbers`

### New Marketing Tables

| Table | Purpose |
|---|---|
| `content_posts` | Generated content (blog, social, email) with status |
| `content_calendar` | Scheduled content per tenant |
| `creative_assets` | Generated images, banners, stored in MinIO |
| `ad_accounts` | Connected ad platform accounts (Google, Meta, Snap) |
| `ad_campaigns` | Campaign configs synced from ad platforms |
| `ad_performance` | Daily/hourly ad metrics snapshots |
| `seo_keywords` | Tracked keywords per tenant |
| `seo_rankings` | SERP position history |
| `seo_audits` | Site audit results |
| `competitors` | Monitored competitors per tenant |
| `competitor_snapshots` | Periodic competitor data captures |
| `social_accounts` | Connected social media accounts |
| `social_posts` | Scheduled/published social posts |
| `social_metrics` | Engagement metrics per post |
| `leads` | CRM leads from all sources |
| `lead_scores` | AI-calculated lead scores |
| `lead_pipeline_stages` | Custom pipeline stages per tenant |
| `lead_activities` | Lead interaction history |
| `campaigns` | Marketing campaign definitions |
| `campaign_steps` | Workflow steps per campaign |
| `campaign_audiences` | Audience segments |
| `reports` | Generated report metadata |
| `report_snapshots` | Historical report data |
| `integrations` | Third-party API connections per tenant |
| `integration_tokens` | OAuth tokens for connected services |
| `market_research` | Research data and insights |
| `brand_settings` | Per-tenant brand voice, colors, fonts, tone |

---

## 8. Third-Party Integrations

### Ad Platforms
| Platform | API | Auth |
|---|---|---|
| Google Ads | Google Ads API v16 | OAuth2 |
| Meta Ads | Marketing API v19 | OAuth2 (Facebook Login) |
| Snapchat Ads | Snap Marketing API | OAuth2 |
| YouTube Ads | Google Ads API (video campaigns) | OAuth2 (same as Google Ads) |

### Analytics
| Platform | API | Auth |
|---|---|---|
| Google Analytics 4 | GA4 Data API | OAuth2 |
| Google Search Console | Search Console API | OAuth2 |
| Facebook Insights | Graph API | OAuth2 |

### Social Media Publishing
| Platform | API | Auth |
|---|---|---|
| Instagram | Instagram Graph API | OAuth2 (Facebook) |
| Facebook Pages | Graph API | OAuth2 |
| Twitter/X | X API v2 | OAuth2 |
| LinkedIn | LinkedIn Marketing API | OAuth2 |
| TikTok | TikTok API | OAuth2 |

### AI Providers (from URTWIN)
| Provider | Models |
|---|---|
| OpenAI | GPT-4o, GPT-4o-mini, DALL-E 3 |
| Anthropic | Claude Sonnet, Claude Opus |
| Google | Gemini Pro, Gemini Flash, Imagen |
| OpenRouter | Any model |
| Stability AI | Stable Diffusion (for image gen) |

### Other
| Service | Purpose |
|---|---|
| MinIO / S3 | Asset storage |
| SendGrid / Mailgun | Transactional email |
| Twilio (future) | SMS campaigns |

---

## 9. Website Container

A public-facing website for Ignify itself (not tenant websites).

### Pages
- **Home** - Hero, features overview, pricing preview, testimonials
- **Features** - Detailed module descriptions
- **Pricing** - Plan comparison (Starter, Professional, Enterprise)
- **About** - Brand story, team
- **Blog** - Marketing tips, product updates
- **Contact** - Contact form, demo request
- **Login/Register** - Redirects to dashboard app

### Tech Stack
- Next.js (separate container from dashboard)
- Tailwind CSS
- Bilingual (EN + AR) with RTL support
- SEO optimized (SSR/SSG)
- Connected to same backend API for auth redirects and lead capture

---

## 10. Dashboard Pages

### Tenant Dashboard (copied structure from URTWIN, marketing-customized)

| Page | Description |
|---|---|
| `/app/dashboard` | Marketing overview - KPIs, active campaigns, quick actions |
| `/app/content` | Content engine - create, schedule, manage posts |
| `/app/creative` | Image generation - create visuals, manage assets |
| `/app/ads` | Ads management - campaigns across platforms |
| `/app/seo` | SEO dashboard - keywords, rankings, audits |
| `/app/social` | Social media - scheduling, analytics, accounts |
| `/app/leads` | CRM - leads, pipeline, scoring |
| `/app/campaigns` | Campaign orchestration - workflows, A/B tests |
| `/app/analytics` | Reports - unified analytics, custom reports |
| `/app/competitors` | Competitor monitoring dashboard |
| `/app/market-research` | Market & store analysis tools |
| `/app/channels` | Communication channels management (from URTWIN) |
| `/app/conversations` | Chat sessions across channels (from URTWIN) |
| `/app/assistant` | AI marketing assistant chat (from URTWIN) |
| `/app/settings` | Tenant settings, AI config, brand settings |
| `/app/integrations` | Connect ad platforms, analytics, social accounts |
| `/app/billing` | Credits, usage, plans (from URTWIN) |
| `/app/team` | User management, invites (from URTWIN) |

### Superadmin Pages (from URTWIN)

| Page | Description |
|---|---|
| `/admin/dashboard` | Platform overview - total tenants, revenue, usage |
| `/admin/tenants` | Manage all tenants |
| `/admin/ai-providers` | Configure AI providers (can add/remove) |
| `/admin/platform-channels` | Shared channel management |
| `/admin/modules` | Marketing module catalog management |
| `/admin/billing` | Credit pricing, purchase history |
| `/admin/logs` | Audit logs |

---

## 11. API Endpoints (Extended from URTWIN)

### Kept from URTWIN
- `POST /api/v1/auth/register|login|refresh|logout`
- `GET /api/v1/auth/me`
- `GET|PUT /api/v1/tenants/me`
- `GET|POST|PUT /api/v1/users`
- `GET|POST|PUT|DELETE /api/v1/channels`
- `GET|POST /api/v1/conversations`
- `GET|POST|PUT|DELETE /api/v1/skills` (now "modules")
- `GET|PUT|DELETE /api/v1/settings/ai`
- `POST /api/v1/assistant/chat`
- `GET|POST /api/v1/billing/credits`
- `GET|POST|PATCH /api/v1/admin/*`

### New Marketing Endpoints
```
# Content Engine
GET|POST       /api/v1/content/posts
GET|PUT|DELETE /api/v1/content/posts/{id}
POST           /api/v1/content/generate
GET|POST       /api/v1/content/calendar

# Creative Engine
GET|POST       /api/v1/creative/assets
POST           /api/v1/creative/generate-image
GET|DELETE     /api/v1/creative/assets/{id}

# Ads
GET|POST       /api/v1/ads/accounts
GET|POST       /api/v1/ads/campaigns
GET|PUT        /api/v1/ads/campaigns/{id}
GET            /api/v1/ads/performance
POST           /api/v1/ads/sync

# SEO
GET|POST       /api/v1/seo/keywords
GET            /api/v1/seo/rankings
POST           /api/v1/seo/audit
GET            /api/v1/seo/recommendations

# Social Media
GET|POST       /api/v1/social/accounts
GET|POST       /api/v1/social/posts
POST           /api/v1/social/schedule
GET            /api/v1/social/metrics

# Leads / CRM
GET|POST       /api/v1/leads
GET|PUT        /api/v1/leads/{id}
GET|POST       /api/v1/leads/pipeline
GET            /api/v1/leads/scores

# Campaigns
GET|POST       /api/v1/campaigns
GET|PUT|DELETE /api/v1/campaigns/{id}
POST           /api/v1/campaigns/{id}/launch
GET            /api/v1/campaigns/{id}/analytics

# Analytics
GET            /api/v1/analytics/overview
GET            /api/v1/analytics/channels
POST           /api/v1/analytics/reports
GET            /api/v1/analytics/reports/{id}

# Competitors
GET|POST       /api/v1/competitors
GET            /api/v1/competitors/{id}/analysis

# Integrations
GET|POST       /api/v1/integrations
POST           /api/v1/integrations/{id}/connect
DELETE         /api/v1/integrations/{id}/disconnect
POST           /api/v1/integrations/oauth/callback

# Brand Settings
GET|PUT        /api/v1/settings/brand

# Market Research
POST           /api/v1/research/market-analysis
POST           /api/v1/research/store-analysis
GET            /api/v1/research/insights
```

---

## 12. Tech Stack Summary

### Backend
| Tech | Purpose |
|---|---|
| FastAPI | Async Python API framework |
| SQLAlchemy 2.0 (async) | ORM |
| asyncpg | PostgreSQL driver |
| Alembic | Database migrations |
| Pydantic v2 | Validation |
| JWT (HS256) | Authentication |
| Redis | Cache, queues, token blacklist |
| httpx | Async HTTP for external APIs |
| Celery + Redis | Background task queue (new - for scheduled posts, reports) |
| uv | Python package manager |

### Frontend (Dashboard)
| Tech | Purpose |
|---|---|
| Next.js 16 (App Router) | Framework |
| TypeScript | Type safety |
| Tailwind CSS v4 | Styling |
| next-intl | i18n (EN + AR) |
| Zustand | State management |
| Radix UI | UI primitives |
| Recharts | Charts and analytics visualization |
| React Query | Server state management |

### Frontend (Website)
| Tech | Purpose |
|---|---|
| Next.js | SSR/SSG public site |
| Tailwind CSS | Styling |
| next-intl | i18n (EN + AR) |
| Framer Motion | Animations |

### AI Runtime (AGNO)
| Tech | Purpose |
|---|---|
| FastAPI | AI execution endpoint |
| httpx | AI provider calls |
| OpenAI-compatible | Multi-provider support |

### Infrastructure
| Tech | Purpose |
|---|---|
| Docker Compose | Container orchestration |
| Nginx | Reverse proxy + SSL |
| PostgreSQL 16 | Database |
| Redis 7 | Cache + queues |
| MinIO | Object storage |
| Let's Encrypt | SSL certificates |

---

## 13. Development Phases

### Phase 1: Foundation (Weeks 1-3)
- [ ] Fork URTWIN codebase
- [ ] Rename all references: URTWIN -> Ignify
- [ ] Update branding (tokens, colors, fonts, logos)
- [ ] Remove URTWIN-specific skills (reservation, hiring, notion, trello, calendar, pdf, todo)
- [ ] Keep core: auth, tenants, users, channels, skills architecture, assistant, credits
- [ ] Set up Docker Compose with all containers
- [ ] Create new Alembic migrations for marketing tables
- [ ] Set up MinIO for asset storage
- [ ] Create website container (Next.js)
- [ ] Deploy development environment

### Phase 2: Core Marketing Modules (Weeks 4-8)
- [ ] Content Engine module (text generation, scheduling)
- [ ] Creative Engine module (image generation via DALL-E/SD)
- [ ] Social Media module (account connection, post scheduling)
- [ ] Brand Settings (per-tenant voice, colors, tone)
- [ ] Dashboard pages for content, creative, social
- [ ] Assistant chat customization for marketing context

### Phase 3: Ads & SEO (Weeks 9-12)
- [ ] Google Ads API integration (OAuth + campaign management)
- [ ] Meta Ads API integration (OAuth + campaign management)
- [ ] Snapchat Ads API integration
- [ ] SEO Intelligence module (keyword tracking, audits)
- [ ] Dashboard pages for ads and SEO
- [ ] Cross-platform ad analytics

### Phase 4: CRM & Campaigns (Weeks 13-16)
- [ ] Lead CRM module (capture, scoring, pipeline)
- [ ] Campaign Manager module (workflows, A/B testing)
- [ ] Lead capture from all channels (WhatsApp, Messenger, forms)
- [ ] Automated follow-up sequences
- [ ] Dashboard pages for leads and campaigns

### Phase 5: Analytics & Intelligence (Weeks 17-20)
- [ ] Unified Analytics module (cross-platform reporting)
- [ ] Competitor Intelligence module
- [ ] Market Research module
- [ ] Google Analytics 4 integration
- [ ] Automated report generation (PDF)
- [ ] Dashboard analytics pages

### Phase 6: New Channels & Polish (Weeks 21-24)
- [ ] Instagram DM connector
- [ ] Snapchat connector
- [ ] YouTube connector
- [ ] Public website (all pages)
- [ ] Onboarding flow for new tenants
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Security audit

### Phase 7: Launch Prep (Weeks 25-26)
- [ ] Production deployment
- [ ] SSL + domain setup (ignify.com / ignify.io)
- [ ] Seed superadmin + demo tenant
- [ ] Documentation
- [ ] Beta testing

---

## 14. Project Structure

```
ignify/
├── services/
│   ├── backend/                    # FastAPI backend
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── core/              # Config, security, utils
│   │   │   ├── db/                # Models, migrations, seed
│   │   │   ├── dependencies.py
│   │   │   ├── modules/           # API route modules
│   │   │   │   ├── auth/
│   │   │   │   ├── tenants/
│   │   │   │   ├── users/
│   │   │   │   ├── channels/
│   │   │   │   ├── conversations/
│   │   │   │   ├── content/       # NEW
│   │   │   │   ├── creative/      # NEW
│   │   │   │   ├── ads/           # NEW
│   │   │   │   ├── seo/           # NEW
│   │   │   │   ├── social/        # NEW
│   │   │   │   ├── leads/         # NEW
│   │   │   │   ├── campaigns/     # NEW
│   │   │   │   ├── analytics/     # NEW
│   │   │   │   ├── competitors/   # NEW
│   │   │   │   ├── research/      # NEW
│   │   │   │   ├── integrations/  # NEW
│   │   │   │   ├── assistant/
│   │   │   │   ├── billing/
│   │   │   │   └── admin/
│   │   │   └── skills/            # Marketing skill modules
│   │   ├── alembic/
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   │
│   ├── agno-runtime/              # AI execution engine (from URTWIN)
│   │   ├── app/
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   │
│   ├── whatsapp-connector/        # From URTWIN
│   ├── messenger-connector/       # From URTWIN
│   ├── instagram-connector/       # NEW
│   ├── snapchat-connector/        # NEW
│   ├── youtube-connector/         # NEW
│   ├── email-connector/           # From URTWIN
│   └── slack-connector/           # From URTWIN
│
├── dashboard/                     # Tenant dashboard (Next.js 16)
│   ├── src/
│   │   ├── app/[locale]/
│   │   │   ├── (dashboard)/       # Tenant pages
│   │   │   │   ├── dashboard/
│   │   │   │   ├── content/
│   │   │   │   ├── creative/
│   │   │   │   ├── ads/
│   │   │   │   ├── seo/
│   │   │   │   ├── social/
│   │   │   │   ├── leads/
│   │   │   │   ├── campaigns/
│   │   │   │   ├── analytics/
│   │   │   │   ├── competitors/
│   │   │   │   ├── market-research/
│   │   │   │   ├── channels/
│   │   │   │   ├── conversations/
│   │   │   │   ├── assistant/
│   │   │   │   ├── integrations/
│   │   │   │   ├── settings/
│   │   │   │   ├── billing/
│   │   │   │   └── team/
│   │   │   └── (admin)/           # Superadmin pages
│   │   ├── lib/
│   │   ├── store/
│   │   └── components/
│   ├── messages/
│   │   ├── en.json
│   │   └── ar.json
│   └── Dockerfile
│
├── website/                       # Public website (NEW)
│   ├── src/
│   │   ├── app/[locale]/
│   │   │   ├── page.tsx           # Home
│   │   │   ├── features/
│   │   │   ├── pricing/
│   │   │   ├── about/
│   │   │   ├── blog/
│   │   │   └── contact/
│   │   ├── components/
│   │   └── lib/
│   ├── messages/
│   └── Dockerfile
│
├── infra/
│   └── docker/
│       ├── docker-compose.yml          # Development
│       ├── docker-compose.prod.yml     # Production
│       ├── nginx/
│       └── .env.example
│
├── docs/                          # Documentation
├── Brand-doc/                     # Brand identity docs
└── README.md
```

---

## 15. Environment Variables

### Backend (.env)
```
# Database
DATABASE_URL=postgresql+asyncpg://ignify:password@postgres:5432/ignify

# Redis
REDIS_URL=redis://redis:6379

# Security
SECRET_KEY=<64-char-hex>

# AI Runtime
AGNO_RUNTIME_URL=http://agno-runtime:8001

# Storage
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=ignify
MINIO_SECRET_KEY=<secret>
MINIO_BUCKET=ignify-assets

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3010

# External APIs (platform defaults, tenants can override)
OPENAI_API_KEY=<key>
GOOGLE_ADS_DEVELOPER_TOKEN=<token>
META_APP_ID=<id>
META_APP_SECRET=<secret>
```

### Dashboard (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Ignify
```

### Website (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Ignify
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3000
```

---

## 16. Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Fork URTWIN vs build from scratch | Fork | 70% of infrastructure is reusable |
| Separate DB per tenant vs shared | Shared with `tenant_id` (from URTWIN) | Simpler ops, proven pattern |
| Website as separate container | Yes | Independent deployment, different caching |
| Celery for background tasks | Yes | Scheduled posts, report gen, ad sync need async workers |
| OAuth for ad platforms | Yes | Required by Google, Meta, Snap APIs |
| Image gen approach | API-based (DALL-E, SD API) | No GPU infrastructure needed |
| Project name | Ignify | Brand already designed (docs 14-21) |

---

## 17. Getting Started

```bash
# 1. Clone and setup
git clone <repo> ignify
cd ignify

# 2. Copy URTWIN source into services/
# (backend, agno-runtime, connectors, dashboard)

# 3. Rename all URTWIN references to Ignify

# 4. Start infrastructure
cd infra/docker
cp .env.example .env
docker compose up -d postgres redis minio

# 5. Backend
cd services/backend
cp .env.example .env
uv pip install -r pyproject.toml
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload --port 8000

# 6. Dashboard
cd dashboard
cp .env.local.example .env.local
npm install && npm run dev

# 7. Website
cd website
npm install && npm run dev -- -p 3010

# 8. Login
# Superadmin: admin@ignify.com / Admin@2024
# Demo tenant: demo@ignify.com / password123
```
