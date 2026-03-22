# URTWIN Platform - Technical Summary

> A complete multi-tenant AI agent SaaS platform. This document covers architecture, tech stack, how every piece connects, and how to fork/enhance for other projects.

---

## 1. What Is URTWIN

URTWIN is a **multi-tenant AI agent platform** where businesses:

1. Sign up and get an isolated workspace (tenant)
2. Connect communication channels (WhatsApp, Telegram, Email, Messenger, Slack, Webchat)
3. Install AI Skills from a marketplace (Reservation, Hiring, Notion, Trello, Calendar, PDF, etc.)
4. Their customers interact with the AI agent via those channels
5. Tenant admins use a dashboard to manage everything + chat with an AI assistant

**Key differentiators:**
- Multi-tenant with full data isolation (every DB query filters by `tenant_id`)
- Pluggable skill system (add new AI capabilities without touching core code)
- Multi-channel (one AI brain, many communication channels)
- Bilingual (English + Arabic with full RTL support)
- Platform channels (superadmin-owned channels that multiple tenants share)

---

## 2. Architecture Overview

```
                    ┌─────────────────────────────────────────┐
                    │              NGINX Gateway               │
                    │  /api/* -> Backend    /* -> Dashboard     │
                    │  /wa/* -> WhatsApp    /tg/* -> Telegram   │
                    └────────────┬────────────────┬────────────┘
                                 │                │
                    ┌────────────▼──┐    ┌────────▼────────┐
                    │   Dashboard    │    │    Backend API    │
                    │  Next.js 16    │    │    FastAPI        │
                    │  Port 3000     │    │    Port 8000      │
                    └────────────────┘    └──────┬───────────┘
                                                 │
                         ┌───────────────────────┼───────────────────────┐
                         │                       │                       │
                ┌────────▼────────┐    ┌─────────▼─────────┐   ┌────────▼────────┐
                │  AGNO Runtime    │    │    PostgreSQL 16    │   │    Redis 7       │
                │  AI Execution    │    │    All data         │   │    JWT blacklist  │
                │  Port 8001       │    │    Port 5432        │   │    Session cache  │
                └─────────────────┘    └─────────────────────┘   └─────────────────┘

        ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
        │  WhatsApp     │  Telegram     │  Messenger    │  Gmail        │  Slack        │
        │  Connector    │  Connector    │  Connector    │  Connector    │  Connector    │
        │  Node.js      │  Node.js      │  Node.js      │  Python       │  Node.js      │
        │  Port 3001    │  Port 3002    │  Port 3003    │  Port 3004    │  Port 3005    │
        └──────────────┘──────────────┘──────────────┘──────────────┘──────────────┘
```

### Message Flow (Inbound)

```
Customer sends WhatsApp message
  → WhatsApp Connector receives via Baileys WebSocket
  → POST /api/v1/conversations/inbound (Backend)
  → Platform routing check (is this a platform channel?)
    → YES: lookup tenant by sender phone → route to tenant's assistant
    → NO: normal flow
  → Load channel skills + AI config for tenant
  → Build system prompt from installed skills
  → POST /execute (AGNO Runtime)
  → AGNO calls AI provider (OpenAI/Anthropic/Google)
  → If tool calls needed: AGNO POST /api/v1/conversations/tool-callback → execute → return result
  → AGNO returns final response
  → Backend sends reply via connector
  → Customer receives reply on WhatsApp
```

---

## 3. Tech Stack

### Frontend — `dashboard/`

| Technology | Purpose |
|---|---|
| **Next.js 16** (App Router) | Framework, SSR, routing |
| **TypeScript** | Type safety |
| **Tailwind CSS v4** | Styling (CSS-first, NO tailwind.config.ts) |
| **next-intl** | i18n with `[locale]` routing (EN + AR) |
| **Zustand** | Auth state management with localStorage persist |
| **Radix UI** | Accessible UI primitives |
| **Lucide React** | Icons |
| **Inter + Cairo fonts** | EN + AR typography |

**Key files:**
- `src/lib/api.ts` — Typed HTTP client with auto JWT refresh
- `src/lib/i18n.ts` — Locale config
- `src/store/auth.store.ts` — Auth state (tokens, user, tenant)
- `messages/en.json` + `ar.json` — All UI translations
- `src/app/[locale]/(dashboard)/` — All tenant pages
- `src/app/[locale]/(admin)/` — Superadmin pages

### Backend — `services/backend/`

| Technology | Purpose |
|---|---|
| **FastAPI** | Async Python web framework |
| **SQLAlchemy 2.0** (async) | ORM with `select()` + `await db.execute()` |
| **asyncpg** | PostgreSQL async driver |
| **Alembic** | Database migrations (21 migrations) |
| **Pydantic v2** | Request/response validation |
| **pydantic-settings** | Environment config from `.env` |
| **JWT (HS256)** | Authentication (access 30min + refresh 7d) |
| **bcrypt** | Password hashing |
| **Redis** | Token blacklist + session cache |
| **httpx** | Async HTTP client (for AGNO, connectors) |
| **pypdf + python-docx** | CV/resume text extraction |
| **uv** | Package manager |

**Key files:**
- `app/main.py` — FastAPI app, CORS, router mounts
- `app/db/models.py` — ALL SQLAlchemy models (~30 tables)
- `app/dependencies.py` — `get_db`, `get_current_user`, `require_role`
- `app/core/config.py` — Settings from env vars
- `app/core/security.py` — JWT + bcrypt
- `app/modules/` — Feature modules (auth, conversations, skills, etc.)
- `app/skills/` — Isolated skill packages

### AI Runtime — `services/agno-runtime/`

| Technology | Purpose |
|---|---|
| **FastAPI** | Single endpoint: `POST /execute` |
| **httpx** | Calls AI providers |
| **OpenAI-compatible** | Works with OpenAI, Anthropic, Google, OpenRouter |

**Key design:**
- ZERO database connections (pure AI execution)
- Per-request AI config (provider, key, model passed in request)
- Tool calling loop (up to 3 rounds)
- Tool callbacks via HTTP POST to backend

### Connectors

| Connector | Tech | Protocol |
|---|---|---|
| WhatsApp | Node.js + Baileys | WebSocket (multi-device) |
| Telegram | Node.js + node-telegram-bot-api | Polling |
| Messenger | Node.js + Express | Webhooks (HMAC-SHA256) |
| Gmail | Python + IMAP/SMTP | IMAP4_SSL polling (30s) |
| Slack | Node.js + Bolt | Socket Mode |
| Outlook | Python + Microsoft Graph | OAuth2 + polling |

---

## 4. Database Schema (30+ tables)

### Core Tables
| Table | Purpose |
|---|---|
| `tenants` | Business accounts (name, slug, plan, config) |
| `users` | Tenant users (email, role, password_hash, lang_preference) |
| `plans` | Subscription plans (starter, professional, enterprise) |
| `refresh_tokens` | JWT refresh token tracking |
| `invitations` | User invite tokens |
| `audit_logs` | Append-only action log |

### Communication Tables
| Table | Purpose |
|---|---|
| `channels` | Connected channels per tenant (type, config, status) |
| `sessions` | Conversation sessions (channel + external_id) |
| `messages` | All messages (user + AI replies) |

### Reservation Tables
| Table | Purpose |
|---|---|
| `services` | Business services offered |
| `branches` | Physical locations |
| `customers` | End customers |
| `bookings` | Reservations with status tracking |
| `customer_memories` | Per-customer long-term memory (key/value) |

### Skills Tables
| Table | Purpose |
|---|---|
| `skills` | Platform skill catalog (prompt, tools, config_schema) |
| `skill_installations` | Tenant installs a skill (config override) |
| `channel_skills` | Binds skills to specific channels |
| `ai_providers` | Platform AI provider configs (OpenAI, Anthropic, etc.) |
| `tenant_ai_configs` | Per-tenant AI provider override |

### Hiring Tables
| Table | Purpose |
|---|---|
| `positions` | Job listings (bilingual, skills, salary, type) |
| `candidates` | Applicants (profile, skills, experience, education, CV) |
| `campaigns` | Outreach campaign sequences |
| `campaign_executions` | Per-candidate campaign tracking |

### Credits & Billing
| Table | Purpose |
|---|---|
| `credit_pricing` | Action costs |
| `credit_balances` | Tenant credit balances |
| `credit_transactions` | Usage log |
| `credit_purchases` | Purchase records |

### Platform Access
| Table | Purpose |
|---|---|
| `platform_channels` | Superadmin-owned shared channels |
| `tenant_phone_numbers` | Tenant phone registrations for platform channels |

### Other
| Table | Purpose |
|---|---|
| `todos` | Task manager items (manual + AI-extracted) |
| `agents` | Legacy agent configs |
| `agent_versions` | Agent version history |

---

## 5. Skills Architecture

Skills are the core extensibility mechanism. Each skill is a self-contained package:

```
app/skills/
├── base.py              # BaseSkill ABC
├── registry.py          # SkillRegistry + execute_tool() dispatcher
├── reservation/         # Reservation/booking skill
│   ├── skill.py         # ReservationSkill(BaseSkill)
│   ├── tools.py         # OpenAI-format tool definitions
│   ├── handlers.py      # Async handler functions
│   ├── prompt.py        # System prompt template
│   └── schema.py        # Config Pydantic model
├── hiring/              # Hiring & recruitment
├── notion/              # Notion workspace integration
├── trello/              # Trello board management
├── calendar/            # Calendar aggregation
├── pdf/                 # PDF tools (convert, compress, OCR)
└── todo/                # Task management
```

### How to Add a New Skill

1. **Create folder**: `app/skills/<your_slug>/`
2. **Implement 5 files**:
   - `skill.py` — extends `BaseSkill`, wires tools + handlers + prompt
   - `tools.py` — list of OpenAI function-call format tool definitions
   - `handlers.py` — async functions that execute tool logic
   - `prompt.py` — system prompt template with `{placeholders}`
   - `schema.py` — Pydantic model for install-time config
3. **Register**: Add `_register(YourSkill())` in `registry.py`
4. **Migration**: Create Alembic migration to seed skill row in `skills` table
5. **Done** — conversation pipeline picks it up automatically

### Skill Data Flow

```
Tenant installs skill (frontend)
  → POST /api/v1/skills/install
  → Creates skill_installation row
  → Optionally binds to channels via channel_skills

Customer sends message on channel
  → Backend loads channel_skills for that channel
  → Collects system prompts from all installed skills
  → Merges tool definitions
  → Resolves AI config (tenant override → platform default)
  → Sends everything to AGNO Runtime
  → AGNO calls AI, AI calls tools, tools execute via callbacks
  → Response flows back
```

---

## 6. Authentication & Authorization

```
POST /api/v1/auth/register → creates tenant + owner user
POST /api/v1/auth/login → returns { access_token, refresh_token }
POST /api/v1/auth/refresh → rotates refresh token
POST /api/v1/auth/logout → blacklists refresh token in Redis

Frontend stores tokens in localStorage:
  urtwin_access_token, urtwin_refresh_token

All API requests: Authorization: Bearer {access_token}
On 401: auto-refresh → if fails: clear + redirect to /login
```

**Roles**: `owner`, `admin`, `agent_editor`, `viewer`, `superadmin`

**Superadmin**: `admin@urtwin.ai / Admin@2024` (seeded in migration 0003)

---

## 7. i18n & RTL

- URLs are locale-prefixed: `/en/dashboard`, `/ar/dashboard`
- `middleware.ts` handles locale detection
- `messages/en.json` + `messages/ar.json` — all UI strings
- Arabic sets `dir="rtl"` on `<html>` + loads Cairo font
- **Rule**: Use Tailwind logical properties (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`)
- **Never use**: `pl-`, `pr-`, `ml-`, `mr-` (breaks RTL)

---

## 8. Production Deployment

### Docker Compose (11 services)

```yaml
# infra/docker/docker-compose.prod.yml
services:
  postgres:        # PostgreSQL 16
  redis:           # Redis 7
  minio:           # Object storage
  backend:         # FastAPI (port 8000)
  agno-runtime:    # AI execution (port 8001)
  dashboard:       # Next.js standalone (port 3000)
  whatsapp-connector:  # Baileys (port 3001)
  telegram-connector:  # (port 3002)
  messenger-connector: # (port 3003)
  gmail-connector:     # (port 3004)
  gateway:         # Nginx reverse proxy
```

### Deploy Commands

```bash
# First time setup
git clone <repo> && cd infra/docker
cp .env.production.example .env
# Edit .env with your domain, passwords, API keys

# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations + seed
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
docker compose -f docker-compose.prod.yml exec backend python -m app.db.seed

# View logs
docker logs superbot-backend --tail 100
docker logs superbot-agno --tail 50
docker logs superbot-whatsapp --tail 50
```

### Single Subdomain Architecture

All services behind one domain (e.g., `app.urtwin.ai`):
- `/` → Dashboard (Next.js)
- `/api/` → Backend (FastAPI)
- `/wa/` → WhatsApp Connector
- `/tg/` → Telegram Connector

SSL via nginx-proxy + acme-companion (Let's Encrypt).

---

## 9. API Endpoints Summary

### Auth (`/api/v1/auth`)
`POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`

### Tenants (`/api/v1/tenants`)
`GET /me`, `PUT /me`

### Users (`/api/v1/users`)
`GET /`, `GET /{id}`, `PUT /{id}`, `POST /invite`, `PUT /me/language`

### Channels (`/api/v1/channels`)
`GET /`, `POST /`, `PUT /{id}`, `DELETE /{id}`, `GET /{id}/skills`

### Conversations (`/api/v1/conversations`)
`GET /sessions`, `GET /sessions/{id}/messages`, `POST /inbound`, `POST /tool-callback`

### Skills (`/api/v1/skills`)
`GET /marketplace`, `GET /installed`, `POST /install`, `PUT /installed/{id}`, `DELETE /installed/{id}`, `POST /installed/{id}/channels`, `DELETE /installed/{id}/channels/{cid}`

### AI Config (`/api/v1/settings`)
`GET /ai`, `PUT /ai`, `DELETE /ai`

### Positions (`/api/v1/positions`)
`GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `GET /{id}/stats`, `GET /{id}/candidates`, `POST /{id}/candidates`, `POST /{id}/candidates/upload-cv`, `GET /{id}/campaigns`, `POST /{id}/campaigns`

### Assistant (`/api/v1/assistant`)
`POST /chat`, `POST /tool-callback`

### Billing (`/api/v1/billing`)
`GET /credits/balance`, `GET /credits/usage`, `GET /credits/transactions`, `POST /credits/purchase`

### Admin (`/api/v1/admin`)
`GET /dashboard`, `GET /tenants`, `GET /tenants/{id}`, `PATCH /tenants/{id}/status`, `GET /logs`, `GET /ai/providers`, `POST /ai/providers`, `PATCH /ai/providers/{slug}/activate`, `GET /platform-channels`, `POST /platform-channels`

---

## 10. How to Fork & Enhance for Another Project

### Step 1: Clone and Rename

```bash
git clone <repo> my-saas-project
cd my-saas-project

# Update project names
# - pyproject.toml: name = "my-backend"
# - dashboard/package.json: name = "my-dashboard"
# - docker-compose: container names
```

### Step 2: Choose Your Skills

Delete skills you don't need from `app/skills/` and their migrations. Keep the skill architecture — it's the foundation for adding your own business logic.

### Step 3: Add Your Own Skill

```python
# app/skills/my_feature/skill.py
from app.skills.base import BaseSkill

class MyFeatureSkill(BaseSkill):
    @property
    def slug(self) -> str:
        return "my_feature"

    def get_tools(self) -> list[dict]:
        return MY_TOOLS  # OpenAI function-call format

    def get_handlers(self) -> dict:
        return {"my_tool_name": my_handler_function}

    def get_system_prompt_template(self) -> str:
        return "You are a {business_name} assistant that helps with..."
```

### Step 4: Add Your Own Channels

Each connector is isolated. To add a new channel:
1. Create `services/my-connector/` with HTTP server
2. Forward inbound messages to `POST /api/v1/conversations/inbound`
3. Implement `POST /send/:tenantId` for outbound replies
4. Add to docker-compose
5. Add channel type to frontend channels page

### Step 5: Customize the Dashboard

- Change branding in `dashboard/src/app/[locale]/(dashboard)/layout.tsx`
- Modify sidebar in `Sidebar.tsx`
- Add pages in `src/app/[locale]/(dashboard)/your-feature/page.tsx`
- Add translations in `messages/en.json` + `messages/ar.json`

### Step 6: Replace AI Provider

The platform is AI-provider agnostic. Configure via Admin → AI Providers:
- OpenAI (GPT-4o, GPT-4o-mini)
- Anthropic (Claude)
- Google (Gemini)
- OpenRouter (any model)

Or set per-tenant overrides in Settings → AI.

---

## 11. Key Design Patterns

### Multi-Tenant Isolation
Every DB query includes `WHERE tenant_id = :tenant_id`. This is enforced at the service layer. No cross-tenant data leaks.

### Skill Registry Pattern
Skills register at module load time. The registry builds a reverse map (`tool_name → skill`). When AGNO calls a tool, the registry dispatches to the correct handler — no manual `if/elif` chains.

### AI Config Resolution
```
tenant_ai_configs (tenant override)
  → ai_providers WHERE is_default=true (platform default)
  → graceful error message
```

### Async Everything
Backend is fully async: `async def` handlers, `AsyncSession`, `httpx.AsyncClient`, `asyncpg`. No blocking calls.

### Environment-Driven Config
All secrets and config via env vars. `pydantic-settings` validates at startup. No hardcoded credentials.

---

## 12. File Counts

| Area | Count |
|---|---|
| Dashboard pages | 24 pages |
| Admin pages | 8 pages |
| Backend API modules | 15 modules |
| Alembic migrations | 21 migrations |
| Skills | 7 skills |
| Connectors | 6 connectors |
| Docker services | 11 services |
| i18n keys (EN) | ~1000+ keys |
| DB tables | ~30 tables |
| Backend dependencies | 17 packages |

---

## 13. Environment Variables

### Backend (`.env`)
```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379
SECRET_KEY=<64-char-hex>
AGNO_RUNTIME_URL=http://agno-runtime:8001
CORS_ORIGINS=http://localhost:3000
```

### Dashboard (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_DEMO_MODE=false
```

### Production (`.env`)
```
APP_HOST=app.yourdomain.com
POSTGRES_PASSWORD=<strong-password>
SECRET_KEY=<64-char-hex>
LETSENCRYPT_EMAIL=admin@yourdomain.com
```

---

## 14. Development Quick Start

```bash
# 1. Start infrastructure
docker compose -f infra/docker/docker-compose.yml up -d postgres redis

# 2. Backend
cd services/backend
cp .env.example .env
uv pip install -r pyproject.toml
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd dashboard
cp .env.local.example .env.local
npm install
npm run dev

# 4. Login
# Email: demo@urtwin.com | Password: password123
# Superadmin: admin@urtwin.ai | Password: Admin@2024
```

---

## 15. What Makes This Reusable

This project is a **complete SaaS template** for any AI-agent business:

1. **Multi-tenant auth** with roles, invites, JWT — ready to use
2. **Pluggable skill system** — add any AI capability without touching core
3. **Multi-channel messaging** — WhatsApp, Telegram, Email, Slack, Webchat
4. **AI-provider agnostic** — swap OpenAI for Anthropic in one click
5. **Bilingual (EN+AR)** — full RTL support, easy to add more languages
6. **Production Docker** — single-command deploy with SSL
7. **Admin portal** — tenant management, AI providers, platform channels, logs
8. **Credit system** — built-in usage metering and billing
9. **Real-time messaging** — SSE for WhatsApp QR, WebSocket-ready

To build a **customer support platform**, **HR chatbot**, **e-commerce assistant**, or any **AI-powered SaaS** — fork this repo, add your skills, customize the dashboard, deploy.
