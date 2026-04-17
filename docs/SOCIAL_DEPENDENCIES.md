# Social Scheduler — What's Internal vs External

This document answers: **does the scheduling code live inside Ignify, or does
it depend on any third party? What costs? Who connects what?**

---

## TL;DR

- **The scheduling engine itself is 100% internal to Ignify.** No external
  scheduler service — no Temporal, no Inngest, no paid queue, no Postiz, no
  Zapier, no make.com. Just our own Postgres + Redis + Celery beat.
- **Publishing depends on each social platform's public API.** At the moment
  a post is due, we call Facebook / LinkedIn / X / YouTube / TikTok directly
  from the Celery worker.
- **You (operator) register one OAuth app per platform.** Your customer just
  clicks *Connect* and authorizes their own account against YOUR app.

---

## The scheduling engine — what runs where

| Component            | Where it lives                | Third-party? |
|----------------------|-------------------------------|--------------|
| Post database rows   | `social_posts` table in YOUR Postgres | ❌ internal |
| Cron "scan for due"  | Celery beat → [`tasks.scan_due_posts`](../services/backend/app/modules/social_scheduler/tasks.py) every 60s | ❌ internal |
| Publish queue        | Redis (`celery_broker`)       | ❌ internal |
| Worker process       | `worker` container (Celery)   | ❌ internal |
| Retry / backoff      | `tenacity` Python lib (embedded) | ❌ internal |
| OAuth state store    | In-memory dict (10-min TTL)   | ❌ internal |
| Per-platform publish | Connector calls vendor API    | ✅ external (see below) |

**Implication:** if every third-party API went offline tomorrow, scheduled
posts would still queue and retry inside Ignify — they just wouldn't reach
the platforms until the APIs came back.

---

## External dependencies — per platform

Each connector is a thin HTTP client over the platform's official API. No
intermediary SaaS.

| Platform    | API used                              | What we call                                    | Cost to Ignify | Cost to customer |
|-------------|---------------------------------------|-------------------------------------------------|----------------|------------------|
| Facebook    | Graph API v19                         | `POST /{page_id}/photos` or `/feed`             | **Free** (app review for production scopes) | Free |
| Instagram   | Graph API v19                         | `POST /{ig_id}/media` → `/media_publish`        | **Free** | Free |
| LinkedIn    | REST API v2 (`/v2/ugcPosts`)          | `POST /v2/ugcPosts` + asset upload              | **Free** | Free |
| X (Twitter) | API v2 tweets + v1.1 media            | `POST /2/tweets` + `POST /1.1/media/upload`     | **$200/mo (Basic)** to post; free tier read-only | Free |
| YouTube     | Data API v3                           | `POST /upload/youtube/v3/videos?uploadType=multipart` | **Free** (10,000 units/day quota) | Free |
| TikTok      | Content Posting API v2                | `POST /v2/post/publish/video/init/`             | **Free** (needs app review for production) | Free |
| Snapchat    | Login Kit (OAuth only)                | **Cannot publish** — no public API              | Free | N/A |
| Google SEO  | Search Console + GA4 Data/Admin APIs  | Read-only sync (queries, analytics)             | **Free** | Free |

**Other runtime dependencies used by Ignify (unrelated to the scheduler):**

| Service     | Purpose                    | Cost              |
|-------------|----------------------------|-------------------|
| OpenRouter  | LLM calls (plans + content)| Pay-per-token (~$0.012–$0.59 per plan) |
| MinIO (self-hosted) | Media storage      | Free (storage bills on your server) |
| Replicate   | Image/video generation     | Pay-per-generation |
| ElevenLabs  | Voice synthesis            | Pay-per-character |
| Stripe / Paymob / PayTabs / Geidea | Billing | Per-transaction fees |

---

## Who registers what — the OAuth ownership model

Your social-scheduling offering is a **multi-tenant SaaS**. That means:

```
┌──────────────────────────┐       ┌──────────────────────────┐
│  Platform developer portal│       │   Ignify .env             │
│  (e.g. developers.facebook│◄──────│   META_APP_ID=...         │
│   .com → your app)        │       │   META_APP_SECRET=...     │
│                           │       └──────────────────────────┘
│  Redirect URI:            │
│  localhost:8000/.../meta/ │
│           callback        │
└────────────┬──────────────┘
             │   ONE app per platform, owned by YOU
             │
             ▼
       ┌─────────────┐       ┌────────────┐       ┌────────────┐
       │  Tenant A   │       │  Tenant B  │  ...  │  Tenant N  │
       │ clicks      │       │ clicks     │       │ clicks     │
       │ "Connect"   │       │ "Connect"  │       │ "Connect"  │
       │ Logs into   │       │ Logs into  │       │ Logs into  │
       │ FB, grants  │       │ FB, grants │       │ FB, grants │
       │ their Page  │       │ their Page │       │ their Page │
       └─────────────┘       └────────────┘       └────────────┘
       stored in                stored in              stored in
       social_accounts         social_accounts        social_accounts
       (tenant_id = A)         (tenant_id = B)        (tenant_id = N)
```

### Practical rule

| Action | Who does it |
|---|---|
| Register developer apps (Meta, LinkedIn, etc.) | **You — once per platform, at launch** |
| Submit for platform review (Meta, TikTok, X) | **You** |
| Pay X Basic plan ($200/mo) if enabling tweets | **You** |
| Keep `CLIENT_SECRET` values in secrets manager | **You** |
| Click *Connect* in dashboard | **Your customer** |
| Authorize their own Facebook Page / LinkedIn profile | **Your customer** |
| Provide media URLs to publish | **Your customer (via Ignify UI)** |

### Security isolation

Each tenant's `access_token_encrypted` is scoped by `tenant_id` in the
`social_accounts` table. Tenant A can never see or use Tenant B's tokens.
The OAuth state is per-request (10-min TTL) and bound to the tenant_id,
so an attacker can't hijack a callback to attach an account to the wrong tenant.

---

## What happens on publish — full trace

```
00:00  celery-beat fires scan_due_posts (every 60s)
00:00  SELECT * FROM social_posts
       WHERE status='scheduled' AND scheduled_at <= NOW() AND publish_mode='auto'
00:00  for each row → publish_scheduled_post.delay(id)   [queued in Redis]
00:01  Worker picks up the job
00:01  Load SocialPost + SocialAccount from Postgres
00:01  registry.get_connector(platform)                   [internal]
00:01  connector.publish(account, content, media)         [HTTP to vendor]
00:02  Vendor responds with external_id (or error)
00:02  UPDATE social_posts SET status='published', external_post_id=... [internal]
```

If the vendor call fails, `tenacity` retries 3× with exponential backoff
(2s → 4s → 8s) before marking the row `failed`. All retries happen in
YOUR worker — no external retry service.

---

## If you wanted to replace a layer

- **Replace Celery with something managed** (e.g. Inngest, Temporal Cloud) — only `tasks.py` changes; the connectors and data model stay.
- **Replace connectors with a third-party scheduler API** (Ayrshare, Postiz
  Cloud, Buffer API) — your customers still register ONE account with you,
  but they'd inherit the third party's rate limits and outages, plus you'd
  pay per-post. **Not recommended** — you already have the connectors.

---

## Cost example — 1,000 tenants, each posting 30 times/month to 3 platforms

- 90,000 posts/month (30 × 3 × 1000)
- Meta / LinkedIn / YouTube / TikTok: **$0** (free API calls)
- X: 90,000 tweets/month → stays under Basic quota, **$200/mo flat**
- Your server (backend + worker + Postgres + Redis): **~$50–100/mo** on a small VPS cluster
- Egress bandwidth for media: depends on sizes (~$5–20/mo)

**Total marginal cost for scheduling = ~$255–320/mo for 1,000 active
tenants.** Everything else (LLM plans, content generation) is covered by
the $29–299 customer subscriptions.
