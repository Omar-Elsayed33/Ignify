# Ignify — Customer Journey Guide
# دليل رحلة العميل في Ignify

> **Scope:** End-to-end walkthrough for a new business owner from first visit through daily operation.  
> **Audience:** Customers, onboarding agents, support team.  
> Last updated: 2026-04-19

---

## Overview / نظرة عامة

Ignify is an AI marketing platform. A customer signs up, describes their business once, and the platform generates a full marketing plan, content, images, videos, and schedules everything automatically. The human only reviews and approves.

```
Register → Onboarding → Pay → Plan → Content → Schedule → Publish → Analyse → Repeat
```

---

## Stage 1 — Register / التسجيل

**URL:** `/ar/register`

### What the customer does
1. Fills in: email, password, full name, company name, preferred language (Arabic / English).
2. Clicks **"إنشاء حساب"**.

### What happens in the system
| Action | Detail |
|--------|--------|
| User + Tenant created | Both rows inserted; `subscription_active = false` |
| JWT issued | `access_token` (15 min) + `refresh_token` (7 days) returned |
| OpenRouter key provisioned | A per-tenant AI sub-key is created automatically (rate-limited to the Free tier until paid) |
| Email verification sent | If `EMAIL_VERIFICATION_REQUIRED=true` (production) |

> **Important:** The account exists but is **locked** — the subscription wall appears on every dashboard page until payment is confirmed.

---

## Stage 2 — Onboarding / الإعداد

**URL:** `/ar/onboarding/business` → `/brand` → `/channels` → `/complete`

This is the **only time** the customer manually describes their business. All future AI outputs use this data.

### Step 1 — Business Profile (`/onboarding/business`)

| Field | Example | Used for |
|-------|---------|----------|
| Business name | "متجر الإلكترونيات" | All content headings |
| Industry | "E-commerce" | Market analysis, competitor discovery |
| Country | Egypt (EG) | Language, currency, local trends |
| Primary language | Arabic | All AI outputs |
| Description | "نبيع أجهزة إلكترونية للأفراد" | Every AI prompt |
| Target audience | "شباب 18-35، مهتمون بالتقنية" | Persona generation |
| Products / services | ["iPhone 15", "Samsung Galaxy"] | Content topics, ad copy |
| Competitors | ["Jumia", "Noon"] | Competitor analysis |
| Website URL | `https://example.com` | SEO audit, brand colors |

**Where stored:** `tenant.config.business_profile` (JSONB)

---

### Step 2 — Brand Voice (`/onboarding/brand`)

| Field | Example |
|-------|---------|
| Tone | Friendly / Professional / Bold |
| Forbidden words | ["cheap", "discount"] |
| Primary color | `#0A84FF` |
| Fonts | `{heading: "Cairo", body: "Noto Sans Arabic"}` |

**Where stored:** `BrandSettings` table + `tenant.config.brand_voice`

**Effect:** Every piece of AI content passes through a brand-guard subagent that checks tone and forbidden words before returning the output.

---

### Step 3 — Channels (`/onboarding/channels`)

Customer selects which platforms they want to use:
- Website / Blog
- Facebook
- Instagram
- LinkedIn
- X (Twitter)
- YouTube
- TikTok
- Google Ads

**Where stored:** `Channel` rows for the tenant.

**Effect:** The marketing plan calendar and content types are tailored to the selected channels.

---

### Step 4 — Complete (`/onboarding/complete`)

Clicking **"ابدأ رحلتك"** calls `POST /api/v1/onboarding/complete` which marks `onboarding.completed = true` in `tenant.config`. The customer is redirected to the dashboard.

---

## Stage 3 — Payment / الدفع

**URL:** `/ar/billing`

Because `subscription_active = false`, a **subscription wall** overlays every dashboard page. The customer must pay before using any features.

### Option A — Online payment
1. Customer clicks a plan → checkout with Stripe / Paymob / PayTabs / Geidea.
2. Payment gateway webhook fires → `subscription_active = true` automatically.

### Option B — Offline / bank transfer
1. Customer opens `/billing` (the wall lets through the billing page).
2. Sees bank account details (Banque Misr account shown on screen).
3. Fills the form: plan, amount, currency, transfer reference number.
4. Clicks **"إرسال طلب الدفع"** → `POST /api/v1/billing/offline-payment`.
5. Request appears in Admin → Payments queue.
6. Admin reviews and clicks **Approve** → `subscription_active = true`, plan assigned.
7. Customer refreshes → wall disappears, full platform unlocked.

### Plans (default seed)
| Slug | Price | AI limit/month |
|------|-------|----------------|
| starter | $29 | $2.50 AI credits |
| professional | $99 | $8.00 AI credits |
| enterprise | $299 | $22.00 AI credits |

---

## Stage 4 — Marketing Plan / الخطة التسويقية

**URL:** `/ar/plans/new`

This is the **core output** of Ignify. One plan = a complete, researched marketing strategy.

### How to generate

1. Customer clicks **"خطة جديدة"**.
2. Fills: title, language, period (30/60/90 days), monthly budget, primary goal (awareness / leads / sales / retention).
3. Selects speed mode:
   - **Fast** (~3 min, ~$0.01) — Gemini 2.5 Flash
   - **Medium** (~3 min, ~$0.38) — GPT-4o
   - **Deep** (~4 min, ~$0.59) — Claude Sonnet
4. Clicks **"إنشاء الخطة"**.

### What the AI generates — 14 agents in sequence

```
market → audience → positioning → journey → offer → funnel →
channels → conversion → retention → growth_loops → calendar →
kpis → ads → execution_roadmap
```

| Section | What it contains |
|---------|-----------------|
| **Market Analysis** | SWOT, trends, competitor snapshot |
| **Personas** | 2-3 customer profiles with demographics, pain points, motivations |
| **Positioning** | Unique value proposition, messaging framework |
| **Customer Journey** | Awareness → Consideration → Purchase → Retention stages |
| **Offer** | Product bundles, pricing recommendations |
| **Funnel** | Traffic sources → Lead magnets → Conversion path |
| **Channels** | Per-channel tactics with posting frequency |
| **Conversion** | CTA copy, landing page recommendations |
| **Retention** | Loyalty tactics, email sequences |
| **Growth Loops** | Referral mechanics, viral loops |
| **Calendar** | Month-by-month content calendar |
| **KPIs** | 5-8 measurable goals with targets |
| **Ad Strategy** | Budget split per channel, audience targeting |
| **Execution Roadmap** | Week-by-week action plan |

### Plan data storage

All sections stored as JSON columns on `marketing_plans`:
```
goals, personas, channels, calendar, kpis, market_analysis,
ad_strategy, positioning, customer_journey, offer, funnel,
conversion, retention, growth_loops, execution_roadmap
```
`market_analysis.swot`, `market_analysis.trends`, `market_analysis.competitors` are nested inside the JSON.

### Viewing the plan

Plan detail page has tabs:
- **ملخص** — hero summary, SWOT 2×2 grid, KPIs
- **السوق** — market analysis, trends, competitors
- **الجمهور** — persona cards with photos
- **القنوات** — channel-by-channel breakdown
- **الميزانية** — budget allocation chart
- **التقويم** — content calendar
- **الخارطة** — execution roadmap

### Regenerating a section

Any section can be regenerated without re-running the full pipeline:
1. Click the refresh icon next to any section.
2. Type optional feedback: *"اجعل الشخصيات أكثر تركيزاً على الشباب"*.
3. System calls `POST /plans/{id}/regenerate-section` → only that agent runs (~10-30 sec).
4. A snapshot of the old version is saved automatically (viewable at `/plans/{id}/versions`).

### Approving the plan

When satisfied, customer clicks **"اعتماد الخطة"**.
- Plan status → `approved`
- A green panel appears with quick-links to start generating content.

---

## Stage 5 — Content Generation / إنشاء المحتوى

**URL:** `/ar/content-gen`

After approving a plan, the customer can generate content that is **automatically context-aware** of the plan.

### Types of content

| Type | Output | Typical length |
|------|--------|----------------|
| Article / Blog | Long-form SEO article | 800-2000 words |
| Social Post | Facebook / Instagram caption | 50-300 words |
| Tweet | Short post | Up to 280 chars |
| Video Script | Scene-by-scene narration | 300-800 words |

### How to generate

1. Open `/content-gen` (or click the quick-link from the approved plan).
2. If a `?plan_id=` is in the URL, a **plan chip** shows at the top — the brief will be enriched with positioning, personas, and goals from the plan.
3. Type a brief: *"اكتب منشوراً عن عرض الجمعة البيضاء"*.
4. Select: platform, language, tone.
5. Click **"إنشاء"** → content appears in ~5-15 seconds.

### What the AI generates

```
copywriter → brand_guard → (translator if needed)
```

### Where content is stored

`ContentPost` row with:
- `title`, `body`, `post_type`, `platform`, `status` (`draft`)
- `metadata.plan_id` — links back to the plan that informed it
- `metadata.creative_ids` — linked images (added when you attach a creative)

### Managing content

**URL:** `/ar/content`

- View all posts with status (draft / review / approved / rejected / published)
- Submit for review: `POST /posts/{id}/submit-review`
- Team members with Editor role approve/reject
- Add comments at any stage (full audit trail)

---

## Stage 6 — Creative Generation / إنشاء المواد البصرية

**URL:** `/ar/creative/generate`

### Images

1. Describe the image: *"صورة منتج إلكتروني على خلفية بيضاء نظيفة"*.
2. Select style (photography / illustration / 3D / flat).
3. Click **"إنشاء"** → Replicate (Flux / SDXL) generates the image (~15-30 sec).
4. Brand guard checks the output matches the brand palette.
5. Image stored in MinIO, URL in `CreativeAsset` table.
6. Can attach to any content post: `POST /content/{id}/attach-creative`.

### Videos

**URL:** `/ar/video/generate`

1. Describe the concept or paste a script.
2. System generates: script → scenes → voice-over (ElevenLabs) → captions → assembled video.
3. Output stored in MinIO as MP4.

---

## Stage 7 — Social Scheduler / الجدولة والنشر

**URL:** `/ar/scheduler`

### Connecting social accounts

**URL:** `/ar/scheduler/accounts`

For each platform (Facebook, Instagram, LinkedIn, X, YouTube, TikTok):
1. Customer clicks **"ربط الحساب"**.
2. Redirected to platform OAuth consent screen.
3. After approval, tokens stored in `social_accounts` table.
4. Account appears as connected with profile picture + page name.

### Scheduling a post

**URL:** `/ar/scheduler/new` (or from content list → "جدولة النشر")

| Field | Description |
|-------|-------------|
| Caption | Pre-filled from `ContentPost.body` if linked |
| Platforms | Select one or more connected accounts |
| Date & time | Pick slot from calendar |
| Media | Upload image/video or attach from creative assets |
| Publish mode | **Auto** (Celery publishes it) / **Manual** (reminder only) |

### Auto-publish

Celery worker scans every minute for due posts where `publish_mode = auto`:
```
scan_due_posts → connector.publish() → status = published
```

**Platform status:**
- ✅ Facebook / Instagram — live
- ✅ LinkedIn — live
- ⚠️ X (Twitter) — requires $200/mo API tier
- ⚠️ YouTube — works up to 256 MB video
- ⚠️ TikTok — sandbox until app review

### Manual publish

For manual posts, the customer posts themselves on the platform and then comes back to click **"نشرت"** — this records the external URL and marks the post as published in Ignify's records.

### Calendar view

The scheduler calendar shows:
- Color-coded posts per platform
- Content post chip (linked article/caption title)
- Publish mode badge (⚡ auto / ✋ manual)
- Click any post to edit

---

## Stage 8 — SEO Tools / أدوات تحسين محركات البحث

**URL:** `/ar/seo/my-site`

### Quick audit (per page)

Paste any URL → instant audit of: title, meta description, headings, images, load hints.

### Deep audit

1. Click **"تحليل شامل"**.
2. System crawls homepage + up to 4 internal pages in parallel.
3. Checks: robots.txt, sitemap.xml, Core Web Vitals hints, structured data.
4. GPT-4o generates 6-10 prioritized recommendations:
   - `technical-seo` — redirects, canonicals, broken links
   - `content` — thin pages, keyword gaps
   - `conversion` — CTA placement, trust signals
   - `trust` — HTTPS, reviews, social proof
5. Full report saved to `SEOAudit` table (viewable history).

### Google Search Console + Analytics integration

1. Click **"ربط Search Console"** → Google OAuth.
2. After connecting: pick your verified site.
3. Click **"مزامنة"** → pulls last 28 days of clicks, impressions, CTR, position.
4. Data shown in the site performance cards.

---

## Stage 9 — Competitors / تحليل المنافسين

**URL:** `/ar/competitors`

### Add competitors

Customer adds competitors by name or URL. The AI:
- Scrapes their website
- Identifies their positioning, key messages, offers
- Compares to your business profile
- Shows a side-by-side analysis

### Two-way sync

Competitors added here also appear in `tenant.config.business_profile.competitors` so the marketing plan's market analysis stays updated.

---

## Stage 10 — Analytics Dashboard / لوحة التحليلات

**URL:** `/ar/analytics`

Shows aggregated metrics across all channels:
- Reach, impressions, engagement per platform
- Best performing content
- Audience growth over time
- Content type performance (articles vs. reels vs. stories)

Data is pulled from connected social accounts and updated via Celery tasks.

---

## Stage 11 — Team Collaboration / العمل الجماعي

**URL:** `/ar/team`

### Roles

| Role | Can do |
|------|--------|
| **Owner** | Everything including billing |
| **Admin** | All features, invite team |
| **Editor** | Generate, edit, approve/reject content |
| **Viewer** | View only |

### Approval workflow

```
Creator drafts content
    → "Submit for Review"
        → Editor notified
            → Approve / Reject with comment
                → Published (if approved)
```

Every action logged in `ContentActivity` — full audit trail on each post.

---

## Stage 12 — Settings / الإعدادات

**URL:** `/ar/settings`

| Section | What you can change |
|---------|---------------------|
| **Personal** | Name, password, language |
| **Business Profile** | Industry, description, products, phone, email |
| **Brand** | Tone, colors, fonts, forbidden words |
| **Channels** | Add/remove target platforms |
| **Team** | Invite members, change roles |
| **Referrals** | Your referral code, track conversions |
| **API Keys** | Generate keys for programmatic access |
| **Webhooks** | Subscribe to events (plan.generated, post.published, etc.) |
| **White Label** | Custom domain, logo (Agency plan) |

---

## Data Flow Summary / ملخص تدفق البيانات

```
Customer Input (Onboarding)
        │
        ▼
Business Profile (tenant.config)
        │
    ┌───┴────────────────────┐
    │                        │
    ▼                        ▼
Marketing Plan          Competitor Analysis
(14 AI agents)          (scrape + compare)
    │
    ├──► Content Posts (copywriter agent)
    │         │
    │         ├──► Creative Assets (image/video gen)
    │         │
    │         └──► Social Posts (scheduler)
    │                   │
    │                   └──► Published (platform API)
    │
    ├──► SEO Audit (crawler + LLM)
    │
    └──► Analytics (aggregated from platforms)
```

---

## AI Credit Consumption / استهلاك رصيد الذكاء الاصطناعي

Every AI action costs credits (drawn from your monthly OpenRouter budget):

| Action | Approx cost |
|--------|-------------|
| Fast marketing plan | ~$0.01 |
| Medium marketing plan | ~$0.38 |
| Deep marketing plan | ~$0.59 |
| Content post (article) | ~$0.02-0.05 |
| Image generation | ~$0.02-0.05 |
| Deep SEO audit | ~$0.05-0.15 |
| Section regeneration | ~$0.01-0.05 |

View live balance at `/ar/billing` → AI Credit Balance widget. You receive an alert when usage hits 90%.

---

## Support & Escalation / الدعم والتصعيد

| Channel | Use for |
|---------|---------|
| In-app chat (`/ar/assistant`) | Quick questions, content ideas |
| `support@ignify.ai` | Billing, account issues |
| `/ar/billing` → Submit payment | Offline payment confirmation |
| Admin panel | Tenant management (internal team only) |

---

## Quick Reference — Key URLs

| Page | URL |
|------|-----|
| Register | `/ar/register` |
| Login | `/ar/login` |
| Dashboard | `/ar/dashboard` |
| New Plan | `/ar/plans/new` |
| Content List | `/ar/content` |
| Content Gen | `/ar/content-gen` |
| Image Gen | `/ar/creative/generate` |
| Video Gen | `/ar/video/generate` |
| Scheduler | `/ar/scheduler` |
| Social Accounts | `/ar/scheduler/accounts` |
| SEO | `/ar/seo/my-site` |
| Competitors | `/ar/competitors` |
| Analytics | `/ar/analytics` |
| Billing | `/ar/billing` |
| Settings | `/ar/settings` |
| Team | `/ar/team` |

---

## FAQ / أسئلة شائعة

**Q: Does the AI publish content automatically without my approval?**  
A: Only if you set the post to "Auto" mode in the scheduler AND you have approved the content. Draft and Review-stage content is never published.

**Q: Can I use Ignify in English?**  
A: Yes. Switch language to English in settings or at registration. All AI outputs respect your chosen language.

**Q: What happens to my data if I cancel?**  
A: You can export all your data (plans, content, analytics) via Settings → Data Export before cancelling.

**Q: How long does a marketing plan take?**  
A: Fast mode: ~3 minutes. Medium: ~3 minutes. Deep: ~4 minutes. All run in the background — you can close the tab.

**Q: Can I regenerate only one section of the plan?**  
A: Yes. Click the refresh icon next to any section and optionally type feedback. Only that section is re-generated (~10-30 seconds).

**Q: What if social posting fails?**  
A: The system retries automatically. You'll see an error badge on the scheduled post. You can re-trigger manually from the scheduler.
