# Ignify — Full System Test Plan
> From deployment to first paid customer. Run top to bottom before any production release.

---

## Stage 0 — Deployment

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 0.1 | `./deploy.sh` runs without errors | All containers start | |
| 0.2 | `GET /health` returns `200 OK` | `{"status":"ok"}` | |
| 0.3 | `GET /ops/status` returns all green | postgres, redis, minio all `ok` | |
| 0.4 | Dashboard loads at `http://localhost:3000` | Login page renders | |
| 0.5 | Website loads at `http://localhost:3010` | Public homepage renders | |
| 0.6 | API docs at `http://localhost:8000/docs` | Swagger UI loads | |
| 0.7 | `./deploy.sh update` works after first deploy | Containers restart, no data lost | |

---

## Stage 1 — Registration & Onboarding

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 1.1 | Register new user via `/ar/register` | Email verification sent | |
| 1.2 | Click verification link | Account activated, redirect to onboarding | |
| 1.3 | Onboarding Step 1 — Business profile (enter business name, industry, description) | Saved, next step enabled | |
| 1.4 | Click "Analyze website" — enter a real URL | Website crawled, fields pre-filled (name, services, industry) | |
| 1.5 | Discovered competitors auto-appear in competitors list | `GET /competitors` returns new records | |
| 1.6 | Onboarding Step 2 — Brand (colors, tone, logo upload) | Saved | |
| 1.7 | Onboarding Step 3 — Channels selection | Saved | |
| 1.8 | Complete onboarding → redirect to `/dashboard` | Dashboard home renders with welcome hero | |
| 1.9 | Superadmin login (`admin@ignify.com`) → `/ar/admin/dashboard` | Admin panel loads | |

---

## Stage 2 — Subscription & Billing

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 2.1 | New user (no payment) sees subscription wall | SubscriptionWall overlay blocks all features except billing | |
| 2.2 | `/billing` page accessible without subscription | Billing page loads with plan list | |
| 2.3 | Submit offline payment (bank transfer) with plan, amount, reference | `POST /billing/offline-payment` → 201, status=pending | |
| 2.4 | Admin → `/admin/payments` shows the pending payment | Payment card visible | |
| 2.5 | Admin approves payment with note | `subscription_active=true`, tenant unlocked | |
| 2.6 | Tenant page refreshes — subscription wall gone | All features accessible | |
| 2.7 | Admin rejects a payment | Status=rejected, tenant stays locked | |
| 2.8 | Admin changes tenant plan directly without payment | `PUT /admin/tenants/{id}/plan` → plan updated | |

---

## Stage 3 — Marketing Plan Generation

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 3.1 | Create new plan via `/plans/new` (fast mode) | Plan created, status=generating | |
| 3.2 | Plan completes within 5 minutes | Status=approved, all 14 sections populated | |
| 3.3 | Market analysis section has ≥10 competitors with threat levels | `market_analysis.competitors` array length ≥ 10 | |
| 3.4 | `competitive_gap` field is populated | Non-empty string describing unique advantage | |
| 3.5 | `quick_wins` array is populated | ≥ 3 items with opportunity + action | |
| 3.6 | SWOT has ≥ 5 points per quadrant | All 4 arrays have ≥ 5 items | |
| 3.7 | Regenerate a single section (channel_planner) with feedback note | Section updates, other sections unchanged | |
| 3.8 | Full plan regeneration | All sections regenerate, version bumped | |
| 3.9 | Plan versioning — view version history at `/plans/{id}/versions` | Previous versions listed | |
| 3.10 | PDF export of plan | PDF downloads successfully | |
| 3.11 | PDF import — upload external PDF, get analysis | `POST /plans/pdf/analyze` returns strengths/weaknesses | |
| 3.12 | Import PDF as draft plan | New plan created in draft status | |
| 3.13 | Share plan via read-only token | `GET /plans/public/{token}` accessible without auth | |

---

## Stage 4 — Content Generation

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 4.1 | Create content from `/content-gen` with `?plan_id=` | Plan context chip appears | |
| 4.2 | Generate social post (Arabic) | 3 variations returned in Arabic | |
| 4.3 | Generate blog article (English) | Article with title, intro, body returned | |
| 4.4 | Generated content has `metadata.plan_id` set | `GET /content/{id}` shows plan_id | |
| 4.5 | Content approval workflow — submit for review | Status=review, reviewer notified | |
| 4.6 | Approve content → status=approved | Status updated | |
| 4.7 | Content templates — create and reuse template | Template available in content-gen | |

---

## Stage 5 — Creative Studio (Images)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 5.1 | Generate image with description | Image returned from Replicate | |
| 5.2 | Brand guard check runs | brand_guard score returned | |
| 5.3 | Generated image saved to media library | `GET /media` includes new asset | |

---

## Stage 6 — Social Scheduler

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 6.1 | Connect Instagram account (OAuth flow) | Account appears in `/scheduler/accounts` | |
| 6.2 | Create scheduled post (auto mode) | `GET /social-scheduler/scheduled` shows post | |
| 6.3 | Schedule post from content-gen via `?content_post_id=` | Caption pre-filled from ContentPost | |
| 6.4 | Manual post — schedule without connected account | Post created with `publish_mode=manual` | |
| 6.5 | Mark manual post as published | `POST /scheduled/{id}/mark-published` → status=published | |
| 6.6 | Celery worker auto-publishes due auto posts | Posts with `publish_mode=auto` published at scheduled time | |
| 6.7 | Week grid shows content chip + publish mode badge | UI renders correctly | |

---

## Stage 7 — SEO

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 7.1 | Basic page audit | `POST /seo/audit` returns page score + issues | |
| 7.2 | Deep multi-page audit | `POST /seo/audit/deep` crawls 5+ pages, returns 6-10 LLM recommendations | |
| 7.3 | Recommendations have priority + expected_impact + why + how | All fields populated | |
| 7.4 | Google Search Console connect (if creds available) | OAuth flow completes, sites listed | |

---

## Stage 8 — Competitors

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 8.1 | Manually add competitor | `POST /competitors` → 201 | |
| 8.2 | Competitor appears in business profile `competitors` array | Two-way sync works | |
| 8.3 | Discover competitors via AI | `POST /ai-assistant/discover-competitors` → 10 competitors | |
| 8.4 | Discovered competitors auto-saved to list | `GET /competitors` shows new records | |
| 8.5 | `draft-business-profile` with website URL saves competitors | `competitors_saved > 0` in response | |
| 8.6 | Run competitor snapshot | `POST /competitors/{id}/snapshot` → scrape data saved | |
| 8.7 | Run competitor AI analysis | `POST /competitors/{id}/analyze` → analysis saved | |

---

## Stage 9 — Analytics & Inbox

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 9.1 | Analytics dashboard loads | Charts render without errors | |
| 9.2 | Inbox — create conversation | `POST /inbox/conversations` → 201 | |
| 9.3 | Inbox — AI suggest reply | Suggestion returned | |

---

## Stage 10 — Team & Settings

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 10.1 | Invite team member (editor role) | Invitation email sent | |
| 10.2 | Invited user accepts and logs in | User sees dashboard with editor permissions | |
| 10.3 | Editor cannot access billing | 403 returned | |
| 10.4 | Update business profile | `PATCH /tenant-settings/business` → saved | |
| 10.5 | Update brand colors | `PATCH /tenant-settings/brand` → saved | |
| 10.6 | Audit log shows all actions | `GET /auth/audit-log` returns recent events | |

---

## Stage 11 — Admin Panel

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 11.1 | List all tenants | `GET /admin/tenants` returns all | |
| 11.2 | View tenant details | `GET /admin/tenants/{id}` returns full profile | |
| 11.3 | Toggle tenant subscription | `PUT /admin/tenants/{id}/subscription` works | |
| 11.4 | Change tenant plan | `PUT /admin/tenants/{id}/plan` updates plan | |
| 11.5 | View all offline payments (filter by status) | `GET /admin/payments/offline?status_filter=pending` | |
| 11.6 | Approve/reject payment from admin UI | Status updates, tenant activated/not | |

---

## Stage 12 — Full Customer Journey (E2E)

Run this as a single flow to confirm everything works end-to-end:

1. `./deploy.sh` — fresh deployment
2. Register new user → complete email verification
3. Complete onboarding — enter website URL → competitors auto-saved
4. Submit offline payment → admin approves → subscription active
5. Generate marketing plan (fast mode) → verify 10 competitors + competitive_gap
6. Approve plan → generate content post with plan context
7. Schedule the content post on Instagram (auto mode)
8. Verify Celery publishes the post at scheduled time
9. Check analytics dashboard shows the post metrics

**Pass criteria:** All 9 steps complete without errors and data flows correctly between them.

---

## Regression Checklist (run after every deploy)

- [ ] `/health` returns 200
- [ ] Login works (superadmin + tenant)
- [ ] New registration + email verification
- [ ] Plan generation completes (fast mode, < 5 min)
- [ ] Content generation returns 3 variants
- [ ] Subscription wall shown for unpaid tenant
- [ ] Admin payment approval unlocks tenant
- [ ] Sidebar renders without JS errors
- [ ] Arabic (RTL) and English layouts correct
- [ ] Mobile viewport — no horizontal scroll
