# Ignify — AI-Powered Marketing SaaS

> Ignite your business growth with intelligent marketing automation.

Ignify is a multi-tenant AI marketing platform: content creation, SEO, social scheduling, competitor intelligence, and analytics — all powered by AI.

---

## Deploy (One Command)

```bash
git clone <repo-url> ignify && cd ignify
./deploy.sh
```

That's it. The script:
- Copies `.env.example` → `.env` if no `.env` exists (edit before going live)
- Builds and starts all containers
- Waits for the backend to be healthy
- Prints all URLs and credentials

**After first deploy — update without data loss:**

```bash
./deploy.sh update
```

**Other commands:**

```bash
./deploy.sh stop    # stop all containers
./deploy.sh logs    # tail all logs
```

---

## Access After Deploy

| URL | What |
|---|---|
| `http://localhost:3000` | Dashboard (Login / Register) |
| `http://localhost:3010` | Public Website |
| `http://localhost:8000/docs` | API Documentation (Swagger) |
| `http://localhost:8000/health` | Health check |

**Default accounts (auto-created when `DEBUG=true`):**

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@ignify.com` | `Admin@2024` |
| Demo Tenant | `customer@ignify.com` | `Customer@2024` |

---

## Environment Variables

The `.env` file lives at `infra/docker/.env`. Key variables to set before production:

| Variable | Description |
|---|---|
| `SECRET_KEY` | JWT signing key — change from the default! |
| `OPENROUTER_API_KEY` | Primary LLM gateway (required for AI features) |
| `OPENAI_API_KEY` | Fallback / direct OpenAI access |
| `ANTHROPIC_API_KEY` | Claude models |
| `GOOGLE_API_KEY` | Gemini models |
| `REPLICATE_API_TOKEN` | Image generation |
| `SMTP_*` | Email sending (verification, invites) |
| `DEBUG` | `true` = auto-seed demo data. Set `false` in production. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy 2 (async), PostgreSQL 16, Redis 7 |
| AI / Agents | LangGraph, OpenRouter (Gemini / GPT-4o / Claude) |
| Dashboard | Next.js 15, TypeScript, Tailwind v4, Zustand |
| Website | Next.js 15, TypeScript, Tailwind v4 |
| Queue | Celery 5 + Redis |
| Storage | MinIO (S3-compatible) |
| i18n | Arabic (default) + English, full RTL support |

---

## Project Structure

```
ignify/
├── deploy.sh                 ← one-command deploy
├── services/backend/         # FastAPI + LangGraph agents
├── dashboard/                # Tenant dashboard (Next.js, port 3000)
├── website/                  # Public marketing site (Next.js, port 3010)
├── infra/docker/             # docker-compose.yml + .env
└── docs/
    ├── TEST_PLAN.md          # Full system test plan (deploy → first sale)
    ├── EXECUTION_PLAN.md
    └── LAUNCH_CHECKLIST.md
```

---

## Useful Commands

```bash
# Restart backend only (picks up most code changes without full rebuild)
cd infra/docker && docker compose restart backend

# Run database migrations
docker compose exec backend alembic upgrade head

# Open DB console
docker compose exec postgres psql -U ignify -d ignify

# Smoke test
docker compose exec backend python scripts/smoke_test.py

# Fresh start (wipes all data)
docker compose down -v && ./deploy.sh
```

---

## Further Reading

- [`docs/TEST_PLAN.md`](./docs/TEST_PLAN.md) — full test plan, stage 0 (deploy) through stage 12 (E2E customer journey)
- [`docs/EXECUTION_PLAN.md`](./docs/EXECUTION_PLAN.md) — phased roadmap
- [`docs/LAUNCH_CHECKLIST.md`](./docs/LAUNCH_CHECKLIST.md) — pre-launch checklist
- `GET /ops/status` — live service health (Postgres, Redis, MinIO, API keys)

---

## License

Proprietary — All rights reserved.
