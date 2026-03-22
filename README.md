# Ignify - AI-Powered Marketing SaaS Platform

> Ignite your business growth with intelligent marketing automation.

Ignify is a multi-tenant AI marketing platform that provides businesses with a complete suite of tools for content creation, ad management, SEO, social media, lead management, and analytics - all powered by AI.

---

## How It Works

```
Users / Customers
       |
  [Nginx Gateway :80]
       |
  ┌────┴──────────────────────────────────┐
  |                |                       |
  [Website :3010]  [Dashboard :3000]  [Backend API :8000]
  Public site      Tenant app              |
                                     [AGNO Runtime :8001]  <-- calls OpenAI / Anthropic / Google
                                           |
                                 ┌─────────┼─────────┐
                                 |         |         |
                           [PostgreSQL] [Redis]  [MinIO]
                              :5432     :6379    :9000
                                           |
              ┌────────────────────────────┼────────────────────────┐
              |         |         |        |        |       |       |
          [WhatsApp] [Messenger] [IG]  [Email]  [Slack] [Snap] [YouTube]
            :3001      :3003    :3006   :3004    :3005  :3007   :3008
```

### Flow:
1. **Tenant registers** on the Dashboard -> Backend creates tenant + owner user in PostgreSQL
2. **Tenant connects channels** (WhatsApp, Instagram, etc.) -> Connector links to their account
3. **Customer sends message** on any channel -> Connector forwards to Backend -> Backend loads tenant's AI config + skills -> Calls AGNO Runtime -> AI responds -> Connector sends reply back
4. **Tenant uses Dashboard** to create content, manage ads, track SEO, view analytics, etc.
5. **Superadmin** manages all tenants, AI providers, platform settings from the admin panel

---

## Superadmin Credentials

| Field | Value |
|---|---|
| Email | `admin@ignify.com` |
| Password | `Admin@2024` |
| Role | `superadmin` |
| URL | `http://localhost:3000/en/admin/dashboard` |

The superadmin is **auto-created** when the backend starts in `DEBUG=true` mode. It can:
- Manage all tenants (activate/suspend/view)
- Configure AI providers (OpenAI, Anthropic, Google)
- Set credit pricing
- View audit logs
- Manage platform-wide channels

---

## Quick Start (Docker - Full App)

### Step 1: Navigate to Docker directory

```bash
cd d:/Ignify/infra/docker
```

### Step 2: Start everything

```bash
# Start ALL services (builds + runs)
docker compose up -d --build
```

This will start **16 containers**:

| Container | Service | Port | What It Does |
|---|---|---|---|
| `ignify-postgres` | PostgreSQL 16 | 5432 | Database |
| `ignify-redis` | Redis 7 | 6379 | Cache, queues, token blacklist |
| `ignify-minio` | MinIO | 9000, 9001 | File storage (images, reports) |
| `ignify-backend` | FastAPI | 8000 | Core API (auto-creates tables + seeds in dev) |
| `ignify-agno` | AGNO Runtime | 8001 | AI execution engine |
| `ignify-worker` | Celery | - | Background tasks (scheduled posts, reports) |
| `ignify-dashboard` | Next.js | 3000 | Tenant dashboard app |
| `ignify-website` | Next.js | 3010 | Public marketing website |
| `ignify-whatsapp` | Node.js | 3001 | WhatsApp connector |
| `ignify-messenger` | Node.js | 3003 | Facebook Messenger connector |
| `ignify-instagram` | Node.js | 3006 | Instagram DM connector |
| `ignify-email` | Python | 3004 | Email (IMAP/SMTP) connector |
| `ignify-slack` | Node.js | 3005 | Slack connector |
| `ignify-gateway` | Nginx | 80 | Reverse proxy (routes everything) |

### Step 3: Wait for healthy services

```bash
# Check all containers are running
docker compose ps

# Watch backend logs (should say "Application startup complete")
docker compose logs -f backend
```

### Step 4: Open in browser

| URL | What |
|---|---|
| `http://localhost:3010` | Public Website |
| `http://localhost:3000` | Dashboard (Login/Register) |
| `http://localhost:8000/docs` | API Documentation (Swagger) |
| `http://localhost:8000/health` | Backend health check |
| `http://localhost:9001` | MinIO Console (user: `ignify`, pass: `ignify_minio_2024`) |

### Step 5: Login

1. Go to `http://localhost:3000`
2. Login with superadmin: `admin@ignify.com` / `Admin@2024`
3. Or register a new tenant account

---

## Quick Start (Without Docker - Manual)

If you prefer running services locally:

```bash
# 1. Start only infrastructure in Docker
cd d:/Ignify/infra/docker
docker compose up -d postgres redis minio

# 2. Backend
cd d:/Ignify/services/backend
pip install -e .  # or: uv pip install -r pyproject.toml
# Set env vars or create .env:
#   DATABASE_URL=postgresql+asyncpg://ignify:ignify_dev_2024@localhost:5432/ignify
#   REDIS_URL=redis://localhost:6379/0
#   DEBUG=true
#   SECRET_KEY=dev-only-secret-key-change-in-production-64-chars-aaaaaabbbbbbcccccc
uvicorn app.main:app --reload --port 8000
# Tables + seed data auto-created because DEBUG=true

# 3. Dashboard
cd d:/Ignify/dashboard
npm install
npm run dev
# Open http://localhost:3000

# 4. Website
cd d:/Ignify/website
npm install
npm run dev -- -p 3010
# Open http://localhost:3010
```

---

## Environment Variables (.env)

The `.env` file at `infra/docker/.env` controls everything. Key variables:

| Variable | Default | Description |
|---|---|---|
| `DEBUG` | `true` | Auto-create tables + seed data on startup |
| `POSTGRES_USER` | `ignify` | Database user |
| `POSTGRES_PASSWORD` | `ignify_dev_2024` | Database password |
| `POSTGRES_DB` | `ignify` | Database name |
| `SECRET_KEY` | dev key | JWT signing key (change in production!) |
| `OPENAI_API_KEY` | (empty) | Add your key to enable AI features |
| `ANTHROPIC_API_KEY` | (empty) | Add your key to enable Claude |
| `GOOGLE_API_KEY` | (empty) | Add your key to enable Gemini |

**To enable AI features**, add at least one API key in `.env`:
```
OPENAI_API_KEY=sk-your-key-here
```

---

## Common Commands

```bash
# Start everything
cd d:/Ignify/infra/docker
docker compose up -d --build

# Stop everything
docker compose down

# Stop and remove all data (fresh start)
docker compose down -v

# View logs
docker compose logs -f backend         # Backend logs
docker compose logs -f dashboard        # Dashboard logs
docker compose logs -f                  # All logs

# Rebuild a single service
docker compose up -d --build backend

# Enter backend container shell
docker compose exec backend bash

# Check database
docker compose exec postgres psql -U ignify -d ignify -c "\dt"
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI, SQLAlchemy 2.0 (async), PostgreSQL 16, Redis 7 |
| AI Runtime | AGNO - provider-agnostic (OpenAI, Anthropic, Google, OpenRouter) |
| Dashboard | Next.js 15, TypeScript, Tailwind CSS v4, Zustand, Recharts |
| Website | Next.js 15, TypeScript, Tailwind CSS v4, Framer Motion |
| Connectors | Node.js (WhatsApp/Baileys, Messenger, Instagram, Slack/Bolt) + Python (Email) |
| Infrastructure | Docker Compose, Nginx, MinIO, Celery |
| i18n | English + Arabic (full RTL support) |

## Marketing Modules

- **Content Engine** - AI content generation (blog, social, email, ad copy)
- **Creative Studio** - Image generation (DALL-E, Stable Diffusion)
- **Ads Orchestrator** - Google Ads, Meta Ads, Snapchat Ads management
- **SEO Intelligence** - Keyword tracking, site audits, ranking monitor
- **Social Media** - Multi-platform scheduling and analytics
- **Lead CRM** - Lead capture, scoring, pipeline management
- **Campaign Manager** - Multi-channel campaign orchestration
- **Analytics** - Unified reporting across all channels
- **Competitor Intel** - Competitor monitoring and analysis
- **Market Research** - Market and store analysis tools

## Project Structure

```
ignify/
├── services/
│   ├── backend/              # FastAPI backend (port 8000)
│   ├── agno-runtime/         # AI execution engine (port 8001)
│   ├── whatsapp-connector/   # WhatsApp channel (port 3001)
│   ├── messenger-connector/  # Messenger channel (port 3003)
│   ├── instagram-connector/  # Instagram DM (port 3006)
│   ├── email-connector/      # Email IMAP/SMTP (port 3004)
│   ├── slack-connector/      # Slack via Bolt (port 3005)
│   ├── snapchat-connector/   # Snapchat (port 3007)
│   └── youtube-connector/    # YouTube comments (port 3008)
├── dashboard/                # Tenant dashboard - Next.js (port 3000)
├── website/                  # Public website - Next.js (port 3010)
├── infra/docker/             # Docker Compose + Nginx + .env
├── docs/                     # Documentation
└── Brand-doc/                # Brand identity
```

## License

Proprietary - All rights reserved.
