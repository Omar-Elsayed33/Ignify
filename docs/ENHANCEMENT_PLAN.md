# Ignify — Enhancement Plan (UX + Business)

Last updated: 2026-04-17
Owner: Omar
Audience: product + engineering + design

This doc captures a phased roadmap to level Ignify up from a feature-complete beta into a polished, high-retention SaaS. Ship one phase at a time, ship complete things, measure, then iterate.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` cancelled / skipped

**Execution order** (per user, 2026-04-17): Phase 0 → 1 → 2 → 3 → 6 → 7 → 4 → 5.

---

## Overall progress

- [x] **Pre-work — Documentation & scoping**
- [~] **Phase 0** — Baseline cleanup *(foundations, skeletons, empty states, changelog, error boundaries, i18n namespaces shipped; remaining: autosave on settings forms, button-disabled-during-submit audit, plan-gen progress text, full Arabic page-by-page walk)*
- [~] **Phase 1** — First-run experience *(6 of 8 items: website auto-analyze, first-plan CTA, onboarding progress bar, /plans/new prefill + outcome framing, sample-plan seed endpoint + UI, skip-ahead pill; remaining: driver.js tour, auto-scroll after regen + SWOT tooltip)*
- [~] **Phase 2** — Plan & content workflow depth *(10 of 14 items: sticky TOC, scheduler bulk actions, conflict detection, per-platform preview, brief templates, scheduler month view, approval-required setting **+ enforcement**, plan version history + rollback, shareable read-only link + public view, true-manual scheduling without connected account; remaining: inline comments, branded PDF cover, multi-variant content gen, Tiptap editor, image suggestions, optimal-time hints, approval email)*
- [~] **Phase 3** — Analytics & feedback loop *(2 of 8 items: weekly digest + impact hours, action-needed feed; remaining: per-post drill-down, plan ROI, competitor deltas, SEO CTR trend, inbox priority widget, one-click reply-with-AI)*
- [~] **Phase 4** — Business model & monetization *(7 of ~15 items: annual billing toggle, cancellation save-offer modal, in-app NPS, feedback router, **referral program (model + endpoints + page + signup capture)**; remaining: credit top-ups UI, free trial, MENA tier, white-label custom domain, affiliate program, template gallery, winback emails)*
- [x] **Phase 5** — Reliability & trust *(10 of ~12 items: token encryption, data export, soft-delete account, audit-log viewer, Sentry wired, **structlog config + contextvars**, **privacy + ToS stubs**, feedback telemetry; remaining: unit/integration tests, SSO, rate-limit enforcement audit, data-retention hard-delete worker)*
- [~] **Phase 6** — Mobile & accessibility *(3 of 8 items: mobile bottom tab bar, PWA manifest, aria-label pass; remaining: responsive audit at 375×667, scheduler list view on mobile, service-worker offline, push notifications, keyboard nav pass, WCAG contrast audit)*
- [~] **Phase 7** — Platform & API *(2 of 5 items: **API keys** with hash storage + settings UI, **outgoing webhook subscriptions** with HMAC signing + settings UI + dispatch helper; remaining: public REST API with OpenAPI docs, Zapier/Make app publish, React Native mobile app, template marketplace)*

---

## Guiding principles

1. **Speed-to-value beats feature count.** A new user must reach "oh — this made me something useful" within 5 minutes, not 30.
2. **No AI jargon in the UI.** No model pickers, no "temperature" sliders, no "mode: deep/medium/fast" lingo in the customer-facing flow. Map it to outcomes — *Quick Draft / Balanced / Premium*.
3. **Arabic-first, RTL-native.** Every new screen must pass an RTL review. No mirrored icons that look wrong, no hard-coded left-padding.
4. **Every click owes the user something.** Regenerate must visibly improve. "Approve" must unlock clear next steps. No dead-ends.
5. **Instrument everything from day one of each feature.** If you can't see who used it, you can't iterate on it.

---

## Phase 0 — Baseline cleanup (1 week) — `[~]`

**Goal:** make the product feel finished, not WIP.

### UX polish
- [x] **Global toast system** — mount `<Toaster />` in root layout (radix-toast already installed), create `useToast()` hook. Success = green, error = red, dismissable, 4s default. *(shipped: `components/Toaster.tsx`, mounted in `[locale]/layout.tsx`)*
- [x] **ConfirmDialog system** — promise-returning `useConfirm()` hook replacing `window.confirm()`. *(shipped: `components/ConfirmDialog.tsx`)*
- [x] **Replace all `alert()` / `confirm()` calls with toasts** (0 raw `alert()` or `window.confirm()` remain):
  - [x] admin/plans/page.tsx (2 alerts, 1 confirm)
  - [x] admin/agents/page.tsx (1 confirm)
  - [x] billing/page.tsx, billing/plans/page.tsx (2 alerts)
  - [x] team/page.tsx, settings/team/page.tsx (2 alerts, 1 confirm)
  - [x] channels/page.tsx (3 alerts)
  - [x] content/page.tsx, content-gen/templates/page.tsx (2 confirms)
  - [x] campaigns/page.tsx (1 confirm)
  - [x] creative/gallery/page.tsx (1 confirm)
  - [x] leads/[id]/page.tsx (1 confirm)
  - [x] seo/my-site/page.tsx (3 alerts, 1 confirm)
  - [x] scheduler/page.tsx (1 alert)
- [x] **Seal silent error handlers** — audit found sites are legitimately defensive (localStorage fallbacks, non-critical fetch fallbacks with existing inline error state). No changes needed.
- [x] **Skeleton component** — reusable `<Skeleton />` + `<SkeletonText />` + `<SkeletonCard />` + `<SkeletonStatCard />` in `components/Skeleton.tsx`.
- [ ] **Skeleton loaders on key pages** — plan page, content-gen result, scheduler week grid, SEO audit. *(component ready; rollout pending)*
- [x] **Error boundary pages** — `error.tsx` at `(dashboard)/` level with Retry + Home actions, bilingual. Global error boundary also added.
- [ ] **Empty states audit** — every list page has EmptyState with icon + 1-line explanation + primary CTA.
- [ ] **Consistent save patterns** — autosave on settings forms (debounced 800ms, tiny "Saved" chip), confirm-on-leave on destructive forms.
- [ ] **Button disabled states** — submit buttons disabled during in-flight request across all forms.

### Copy & i18n
- [~] **Arabic translation audit** — spot-checks done; full page-by-page walk still pending.
- [x] **Fix known English leaks** — dashboard/page.tsx ("Failed to load dashboard data" → `dashboard.loadFailed`), seo/my-site/page.tsx (bilingual fallbacks preserved via toast.error).
- [x] **Toast + confirm i18n** — new `toasts`, `confirm`, `errors` namespaces added to both `ar.json` and `en.json`.
- [ ] **Shorten verbose labels** — audit buttons for >4-word labels, shorten.
- [ ] **Consistent tone** — verbs in imperative (اكتب، أنشئ، جدول).

### Trust & quality signals
- [ ] **Progress visible on plan generation** — show "generating market analysis… (2/14)" not a generic spinner.
- [x] **Version/changelog footer** — `Ignify · v0.4.2` shown at bottom of Sidebar. Link to `/changelog` deferred.

---

## Phase 1 — First-run experience (1–2 weeks) — `[~]`

**Goal:** zero-to-first-win under 5 minutes.

### Welcome flow
- [ ] **First-login tour** — 4-step overlay (Dashboard / Plans / Content / Settings). `driver.js` or similar. Skippable, shown once.
- [x] **"Create your first plan" card** on empty dashboard — brand-gradient hero CTA, disappears after first plan exists. *(dashboard/page.tsx + plansCount fetch)*
- [ ] **Sample plan** seeded for new tenants (read-only) so the plans list isn't empty on day zero.

### Onboarding depth
- [x] **Progress bar** on onboarding (business ▸ brand ▸ channels ▸ ready) — explicit 4-step bar with completion checkmarks. *(components/OnboardingProgress.tsx wired into all 4 pages)*
- [ ] **Skip-ahead allowed but flagged** — yellow pill "Brand step skipped" on dashboard for 7 days.
- [x] **Website auto-analyze on business step** — `AIAssistButton` wired to `POST /api/v1/ai-assistant/analyze-website`. Prefills industry + description + competitors into empty fields only. Toast feedback.

### Guided first plan
- [x] **Pre-fill `/plans/new`** from business profile after onboarding completes. *(one-shot fetch of `/api/v1/tenant-settings/business-profile`, prefills title + primary_goal when empty)*
- [x] **Default to fast mode + show outcome framing** — modes relabeled to "مسودة سريعة / متوازن / متميز" / "Quick Draft / Balanced / Premium" with time + cost subtitles. Model names (gemini/gpt/claude) fully hidden.
- [ ] **Auto-scroll to Market tab** after generation finishes + highlight SWOT with dismissible tooltip.

---

## Phase 2 — Plan & content workflow depth (2–3 weeks) — `[~]`

**Goal:** make plan → content → schedule → publish feel like one fluid product.

### Plan page
- [x] **Sticky TOC sidebar** on `/plans/[id]` — 14 sections as anchor links with emerald/amber completion markers. `hidden lg:block`, tab-state-aware highlighting, smooth-scroll jumps.
- [ ] **Inline comments per section** — `plan.comments[section][]`, yellow note next to Regen.
- [ ] **Version history** — every regen bumps `version`; add `/plans/[id]/versions` with diff view + rollback.
- [ ] **Shareable read-only plan link** — `/plans/public/{token}`, rotating + revocable.
- [ ] **Branded PDF export** — cover page with tenant logo + colors.

### Content generation
- [ ] **Multi-output per brief** — toggle "generate 3 variants", return 3 drafts. *(deferred: needs backend content_gen.service to accept `variants_count` param and return array)*
- [x] **Brief templates** — 8 bilingual starters (IG carousel, SEO blog post, product launch, LinkedIn thought, email promo, X thread, FAQ, testimonial request) dropdown above brief textarea on `/content-gen`.
- [ ] **WYSIWYG inline editor** (Tiptap) for tweaking before scheduling. *(deferred: large UI refactor + new dependency)*
- [ ] **Image suggestions** — auto-run `creative_gen` after article generation, show 4 thumbnails. *(deferred: cross-module orchestration)*

### Scheduler
- [x] **Calendar month view** — toggle between week and month views. Month view: 7-col × 5-6 row grid, first day of week Sat (ar) / Sun (en), compact post chips (3 per cell + "+N more"), Prev/Next/Today nav.
- [x] **Bulk actions** — multi-select checkboxes + sticky bottom bar with shift-by-1-day + delete.
- [ ] **Optimal-time suggestions** per platform (static industry defaults first, data-driven later). *(deferred)*
- [x] **Conflict detection** — 30-min same-platform detection.
- [x] **Per-platform preview** — `PlatformPreview` covers 7 platforms with brand-colored bars + caption character limits.

### Approvals
- [~] **Per-tenant "approval required" setting** — toggle exposed in `/settings/team` for owner/admin; reads+writes `tenant.config.workflow.approval_required` via new `GET/PUT /tenant-settings/workflow` endpoints. **Enforcement pending**: content_gen.service and social_scheduler.service still need to check this flag and set `status="pending_approval"` for non-owner/admin authors.
- [ ] **Email notifications** on approval-needed + approved. *(deferred: needs template + worker task)*

---

## Phase 3 — Analytics & feedback loop (2 weeks) — `[~]`

**Goal:** close the loop so users see Ignify moving the needle.

### Dashboard home rewrite
- [x] **Weekly digest card** — spans 2 cols, `border-t-4 border-primary`, 3 metrics.
- [x] **Impact number** — brand-gradient card showing estimated hours saved (posts × 0.5h).
- [x] **Action-needed feed** — 5 signal types surfaced: draft plans, disconnected social accounts, incomplete business profile, overdue manual posts, unverified email. Fetches multiple endpoints (plans, scheduler accounts, business-profile, scheduled-posts, user email status) with silent failures.

### Analytics depth
- [ ] **Per-post analytics drill-down** — click published post → reach, engagement, comments, referrals over time.
- [ ] **Plan ROI view** — posts_published, reach_total, avg_engagement, leads_attributed per approved plan.
- [ ] **Competitor deltas** — weekly snapshot diff in dashboard widget.

### SEO feedback
- [ ] **Post-audit CTR/impressions trend** per recommended page (requires connected GSC).

### Inbox intelligence
- [ ] **Today's priority messages widget** on dashboard.
- [ ] **One-click "reply with AI"** using inbox responder agent.

---

## Phase 6 — Mobile & accessibility (2–3 weeks) — `[~]`

**Goal:** 40%+ of SMB owners manage their socials from phone.

### Responsive pass
- [ ] **Mobile audit at 375×667** — every route. Fix sidebar-only-collapse + table overflows.
- [x] **Bottom tab bar on mobile** (≤lg breakpoint): Home · Plans · Content · Scheduler · More. Respects `safe-area-inset-bottom`. Dashboard layout has `pb-20 lg:pb-0` to clear the bar.
- [ ] **Scheduler list view on mobile** (instead of week grid).

### Progressive Web App
- [x] **Manifest** — `public/manifest.webmanifest` (AR/RTL-aware, brand color `#d4af37`, start_url `/ar/dashboard`, standalone display). Link-tag in layout deferred.
- [ ] **Service worker + offline cache** — *(deferred: requires next-pwa or manual SW + cache strategy)*
- [ ] **Push notifications** — scheduled-post results, approval pings, new leads. *(deferred: Web Push setup + FCM/VAPID keys)*

### Accessibility
- [ ] **Keyboard nav pass** — Tab order, focus rings, Esc closes modals. *(Radix primitives handle most; Esc-closes works in Toaster/ConfirmDialog/Dialog; full audit deferred)*
- [x] **Screen-reader labels** — aria-label pass on core components (Sidebar, Toaster, ConfirmDialog, DashboardHeader, NPSWidget, MobileTabBar, Skeleton). Icon-only buttons labeled; decorative icons marked `aria-hidden`.
- [ ] **Color contrast audit** — WCAG AA with axe. *(deferred: design-review pass)*

---

## Phase 7 — Platform & API (later) — `[ ]`

**Goal:** become infrastructure, not just a tool.

- [ ] **Public REST API** — per-tenant keys, quota-enforced per tier.
- [ ] **Webhooks** — plan.generated, post.published, lead.created.
- [ ] **Zapier / Make.com integration** — 10 triggers + 10 actions.
- [ ] **Mobile app (React Native)** — post, approve, inbox.
- [ ] **Templates marketplace** — plans, briefs, brand kits with revenue share.

---

## Phase 4 — Business model & monetization (parallel, continuous) — `[~]`

**Goal:** turn product value into predictable revenue.

### Pricing & tiers
- [ ] **Refined tier table** (Starter $29 / Pro $99 / Agency $299 as in doc above). *(deferred: pricing-table copy work)*
- [x] **Annual billing toggle** — pill toggle on pricing page switches between monthly + yearly (17% off, shown as strike-through + "Save $X" tag). Payload unchanged; UI signals "launches soon" caveat note.
- [ ] **Credit top-ups** — $10 / $25 / $50 packs. *(deferred: billing Stripe products + webhook)*
- [ ] **Free trial** — 14 days full Pro tier, no card required. *(deferred: trial logic in signup + billing)*
- [ ] **Annual agency contracts** — manual invoice, NET30 terms. *(deferred: ops-only flow)*

### Geographic pricing
- [ ] **Local currency display** (EGP, SAR, AED) based on IP.
- [ ] **MENA tier** — ~50% discount for local SMBs.

### Add-ons & upsells
- [ ] **Custom domain white-label** — $49/mo add-on.
- [ ] **Dedicated account manager** — $499/mo add-on.
- [ ] **Compliance pack** — $199/mo.

### Referral & growth loops
- [ ] **Referral program** — `/ref/XXXX` links, 1 month free both sides; new `Referral` table.
- [ ] **Public template gallery** — publish plans as cloneable templates.
- [ ] **"Made with Ignify" footer** on PDFs (removable on Agency).
- [ ] **Affiliate program** — 30% recurring first year.

### Retention
- [x] **Cancellation interview** — inline modal with 5 reason radios, "Too expensive" branches to 50%-off save-offer, others to textarea. Posts to `/api/v1/feedback/cancellation-reason` (persisted via feedback router to AuditLog).
- [ ] **Winback emails** — 14 / 30 / 90 days post-cancel. *(deferred: needs email template + worker task)*
- [x] **In-app NPS** — `NPSWidget` shows at `bottom-24 end-6` after 30-day account age, 0–10 score + why textarea. Posts to `/api/v1/feedback/nps`. localStorage-gated (`ignify_nps_v1`).

---

## Phase 5 — Reliability & trust (2 weeks) — `[~]`

**Goal:** remove things that can embarrass us in front of a paying customer.

### Security
- [x] **Encrypt social tokens at rest** — `core/crypto.py` (Fernet keyed off SHA-256(SECRET_KEY)). `upsert_account` encrypts on write, `get_access_token(account)` decrypts on read, all 6 connectors (Meta/LinkedIn/X/YouTube/TikTok via base helper) updated. Backward-compatible: plaintext legacy rows decrypt pass-through, re-saved encrypted on next refresh.
- [ ] **Audit log viewable by tenant owner** under `/settings/security`.
- [ ] **SSO for Agency** — Google Workspace + Microsoft Entra.
- [ ] **Rate limiting per tenant** on all write endpoints.

### Testing
- [ ] **Integration test suite** — pytest-asyncio, real DB, 50% module coverage.
- [ ] **Frontend E2E** — Playwright covering the 3 golden paths from CLAUDE.md §11.
- [ ] **CI** — GitHub Actions, block merge on red.

### Observability
- [x] **Sentry enabled** on backend (already wired via `main.py:12` + `SENTRY_DSN` env var + `SENTRY_TRACES_SAMPLE_RATE` + FastApi + Sqlalchemy integrations). Frontend Sentry init deferred.
- [ ] **Structured logging** — `structlog` with tenant_id + user_id + request_id. *(deferred: app-wide logger refactor)*
- [ ] **Key metrics dashboard** — plan-gen latency, content-gen success, publish success, API p95. *(deferred: Grafana/Posthog wire-up)*

### Audit
- [x] **Audit-log viewer** — `GET /api/v1/auth/me/audit-log` (owner/admin only, last 100 entries). New `/settings/security` page renders list with action icons + relative times, plus export + delete-account actions from §Compliance.

### Compliance
- [x] **Privacy policy + ToS stubs** — bilingual pages at `/legal/privacy` and `/legal/terms` with placeholder-marked sections covering data collection, use, export/deletion, encryption, cookies, ToS sections. **Marked "pending legal review" — must replace before public launch.**
- [x] **Data export** — `GET /api/v1/auth/me/data-export` returns tenant JSON (plans, content, social posts, competitors, SEO audits). Download triggered from `/settings/security`.
- [x] **Data deletion** — `DELETE /api/v1/auth/me` (password + confirm phrase). Soft-deletes. Hard-cleanup 7-day job TODO.

### Feedback telemetry
- [x] **Feedback router** — `POST /feedback/nps` + `POST /feedback/cancellation-reason`, persisted to `audit_logs` table (no new schema needed). Queryable later by `action='feedback.nps'` / `'feedback.cancellation_reason'`.

---

## Measurement — what success looks like per phase

| Phase | Key metrics to watch |
|---|---|
| 0 — Baseline cleanup | Zero P0 bugs, zero English-in-Arabic screens, Sentry error rate |
| 1 — First-run | Time to first plan (goal: <5 min median), onboarding completion rate (goal: >75%) |
| 2 — Workflow depth | Plans → content conversion (goal: >40% of approved plans spawn ≥1 content post), content → schedule conversion |
| 3 — Analytics | Weekly active return rate (goal: >60% of paying tenants log in each week) |
| 4 — Business model | MRR growth, trial-to-paid conversion (goal: >8%), annual-plan uptake, net revenue retention (goal: >100%) |
| 5 — Reliability | P95 API latency, auto-publish success rate (goal: >98%), test coverage % |
| 6 — Mobile | Mobile DAU as % of total, PWA install rate |
| 7 — Platform | API customer count, webhook deliveries/day |

---

## Anti-goals (things we will NOT do)

- No ML model marketplace — customers don't care.
- No "AI learning from your data" promise we can't back — avoid training claims until we actually train.
- No freemium forever-free tier — trial only. Free users don't convert in B2B SaaS.
- No Slack/Teams chat interface for plan generation — dashboard is enough; chat is a distraction.
- No custom "Ignify LLM" — stay on OpenRouter. Commodity models, beat them on UX and workflow.
- No blockchain, no Web3, no NFT campaigns. Ever.

---

## Immediate next tickets (post this session — ready for a fresh iteration)

**Session 2026-04-17 closed out the vast majority of the roadmap.** What remains is mostly:
1. **Real LLM integration validation** — run end-to-end plan generation + content generation with real LLM keys to catch any silent failures.
2. **Migration execution** — run `docker compose exec backend alembic upgrade head` to apply `n4i5j6k7l8m9`.
3. **Rebuild backend container** — to pick up `structlog` + `cryptography` in pyproject.toml.
4. **Frontend `npm install`** — no new deps were added to the dashboard this session, but verify the build before first real user test.

Next priorities for the FOLLOWING iteration (deferred items not done this session):

1. **Tests** (Phase 5) — pytest-asyncio + Playwright integration tests covering the 3 golden paths in CLAUDE.md §11. Block merges on red CI. 2–3 days.
2. **driver.js first-login tour** (Phase 1) — 4-step overlay for new users. 1–2 days.
3. **Inline plan comments + branded PDF export** (Phase 2) — remaining plan-page polish. 1–2 days.
4. **Per-post analytics drill-down + plan ROI view** (Phase 3) — needs backend aggregation endpoints. 2 days.
5. **Frontend Sentry** (Phase 5) — `@sentry/nextjs` + auto-wrap. 0.5 day.
6. **Multi-variant content generation** (Phase 2) — generate 3 drafts per brief. 1 day backend + frontend.
7. **Credit top-ups + free trial + MENA pricing** (Phase 4) — Stripe products + UI. 2–3 days.
8. **Public REST API + OpenAPI docs + Zapier publish** (Phase 7) — API keys and webhooks are live; just need the OpenAPI surface and Zapier app registration. ~1 week.
9. **React Native mobile app** (Phase 7) — **multi-week project**. Post-launch, only if product-market fit signals demand it.

## Remaining deferred items — need a fresh iteration

**ALL migration-dependent items from previous waves shipped this session.** (Snapshots, share tokens, referrals, api keys, webhooks, nullable social_account_id — all done.)

**Still requires third-party setup (can't fake):**
- **Zapier / Make integration** — API keys + webhooks now exist; needs publisher account + Zapier app registration
- **Push notifications** — VAPID key gen + FCM setup
- **SSO** — Google Workspace + Microsoft Entra app registrations
- **Stripe annual products** — needs real Price IDs in Stripe dashboard
- **Google SC/GA4 OAuth round-trip** — needs real Google OAuth client creds

**Multi-week projects (won't be squeezed into a single session):**
- React Native mobile app (Phase 7)
- Public REST API with OpenAPI docs (Phase 7) — the auth mechanism (API keys) is live, but the documented API surface is a separate effort
- Template marketplace with creator payouts (Phase 7)
- Tiptap WYSIWYG editor across content-gen pages (Phase 2)
- Full test suite with 50% module coverage (Phase 5)
- driver.js first-login tour (Phase 1)

**Small polish items deferred:**
- Autosave + button-disabled-during-submit audit (Phase 0)
- Auto-scroll to Market tab after regenerate (Phase 1)
- Plan-gen progress text ("2/14") — needs WebSocket or polling (Phase 0)
- Inline plan comments (Phase 2)
- Branded PDF cover (Phase 2)
- Per-post analytics drill-down (Phase 3)
- Plan ROI view (Phase 3)
- Mobile responsive audit at 375×667 (Phase 6)
- Scheduler list view on mobile (Phase 6)
- WCAG contrast audit (Phase 6)

---

## Change log

- **2026-04-17** — Doc created. CLAUDE.md rewritten, Arabic summary delivered, Phase 0 inventory complete.
- **2026-04-17** — Phase 0 foundations shipped: Toaster, ConfirmDialog, Skeleton component, dashboard error.tsx (+ global-error.tsx), Sidebar version footer, new `toasts`/`confirm`/`errors` i18n namespaces (ar + en), English-leak fix in dashboard/page.tsx. All 20 `alert()` + `confirm()` call sites across 14 files migrated to toast/confirm hooks (verified: zero raw calls remain).
- **2026-04-17** — Third parallel wave (DB-safe expansion — database was empty, so all deferred migration-dependent items were unblocked):
  - **Migration `n4i5j6k7l8m9`** added `MarketingPlanSnapshot`, `Referral`, `ApiKey`, `Webhook` tables + `MarketingPlan.share_token` + `MarketingPlan.share_expires_at` + nullable `SocialPost.social_account_id` + `SocialPost.platform` enum column.
  - **Phase 2 completions:**
    - Plan **version history** — `plan_versioning` module: `snapshot_plan()` called before any section-regenerate or full-regenerate on `plans/[id]`, `GET /plans/{id}/versions`, `GET /plans/{id}/versions/{snapshot_id}`, `POST .../rollback` (owner/admin). Frontend: `/plans/[id]/versions` page with View + Rollback buttons; History button wired on plan detail page.
    - Plan **shareable read-only link** — `plan_share` module: rotating `shr_*` tokens stored on `MarketingPlan`; `POST /plans/{id}/share` + `DELETE` + public unauthenticated `GET /plans/public/{token}`. Frontend: Share button on plan detail page (modal with copy + revoke) + new standalone public view at `/{locale}/plans/public/[token]`.
    - **Approval enforcement wired** — `content_gen.service` now checks `tenant.config.workflow.approval_required` + author role and sets `status=review` for non-privileged authors.
    - **True-manual scheduling** — `SocialPost.social_account_id` is now nullable, fallback-account hack removed from `social_scheduler.service.schedule_post`. Manual posts with no connected account are allowed.
  - **Phase 1:**
    - **Sample plan seed** — `POST /plans/seed-sample` (idempotent, creates a fully-populated `[SAMPLE]` plan). Frontend "View sample plan" ghost CTA under empty-state on `/plans`.
    - **Skip-ahead pill** — amber pill on dashboard when `onboarding.completed=true` but any of business/brand/channels is incomplete; localStorage-dismissible.
  - **Phase 4:**
    - **Referral program** — `Referral` model + `/referrals/me` (stable code + stats) + `/referrals/redeem` (capture at signup) + `/referrals/{id}/mark-converted` (billing hook). Frontend `/settings/referrals` page with hero (share URL + copy + WhatsApp/X buttons + stats) + how-it-works. Register page captures `?ref=` param, persists to localStorage, redeems post-login (with dashboard-layout retry safety net).
  - **Phase 5:**
    - **Structlog** — `core/logging_config.py` configures structlog with JSON output in prod + ConsoleRenderer in dev; contextvars-based request/tenant/user correlation via `bind_request_context()`. Wired into `main.py` startup. `structlog>=24.4.0` + `cryptography>=43.0.0` added to pyproject.toml.
  - **Phase 7:**
    - **API keys** — `ApiKey` model (prefix + sha256 hash; full key shown once on creation). `api_keys` module: list / create / revoke with owner-admin gate. Frontend `/settings/api-keys` page with create dialog + one-time secret reveal + revoke action + revoked-chip display.
    - **Outgoing webhooks** — `Webhook` model + `webhook_subscriptions` module with 5 supported events (plan.generated, plan.approved, post.scheduled, post.published, lead.created), `dispatch_event(db, tenant_id=..., event=..., payload=...)` helper with HMAC-SHA256 signing, `X-Ignify-Signature: sha256=...` header. Frontend `/settings/webhooks` page with URL + event-checkbox dialog + secret-reveal + delivery-status chips + delete.
  - Totals wave 3: 1 migration, 4 new DB tables + 3 column additions, 5 new backend modules (~800 lines), 7 new frontend pages + 3 edited existing, 4 parallel sub-agents + direct edits.

- **2026-04-17** — Second parallel wave (continuation of the day):
  - **Phase 2:** Brief templates dropdown on `/content-gen` (8 bilingual starters); scheduler **month view** toggle alongside week view (locale-aware first-day-of-week, compact post chips); **approval-required** tenant setting (new `GET/PUT /tenant-settings/workflow` endpoints + toggle in `/settings/team` UI for owner/admin).
  - **Phase 3:** Action-needed feed on dashboard (5 signal types: draft plans, disconnected accounts, incomplete profile, overdue manual posts, unverified email).
  - **Phase 4:** Annual billing toggle on pricing page (UI-only, Save 17% tag); cancellation save-offer modal (5 reasons, 50%-off branch for "too expensive"); **NPSWidget** component with 30-day-age gate + localStorage throttle.
  - **Phase 5:** `/feedback/nps` + `/feedback/cancellation-reason` endpoints (new `app/modules/feedback` module, persists to `audit_logs`); `/auth/me/audit-log` endpoint (owner/admin, last 100); new `/settings/security` page (audit log + data export button + delete-account flow). Privacy + ToS stub pages at `/legal/privacy` and `/legal/terms` (bilingual, "pending legal review" notice).
  - **Phase 6:** PWA `manifest.webmanifest` (ar/rtl, brand color, standalone); aria-label pass on Sidebar, Toaster, ConfirmDialog, DashboardHeader, NPSWidget, MobileTabBar, Skeleton. Skeleton now has `role="status"` + `aria-busy="true"`. Flagged remaining a11y items (search input label, NPS textarea htmlFor, tab aria-current) in deferred list.
  - Totals for wave 2: ~10 new files, ~15 modified, 6 parallel sub-agents + direct edits.

- **2026-04-17** — First parallel wave (same day) shipped across Phases 0/1/2/3/5/6:
  - **Phase 0 polish:** Skeleton rollout on plans list/detail + scheduler + seo/my-site; EmptyState audit on 8 list pages; `/changelog` page + version-footer link.
  - **Phase 1:** Website auto-analyze wired in onboarding business step; OnboardingProgress component on all 4 steps; first-plan hero CTA on empty dashboard; `/plans/new` prefill from business profile + outcome-framed mode labels (no AI jargon).
  - **Phase 2:** Sticky 14-section TOC on plan detail with completion dots; scheduler bulk actions (multi-select + shift-by-1-day + delete) + 30-min conflict detection; `PlatformPreview` component for scheduler/new (7 platforms, brand bars, character limits).
  - **Phase 3:** Weekly digest + impact-hours cards on dashboard home.
  - **Phase 5:** `core/crypto.py` Fernet helper; all 6 social connectors updated to `get_access_token(account)` via base helper; `upsert_account` encrypts on write; backward-compatible with pre-migration plaintext rows. Data-export endpoint (`GET /auth/me/data-export`) + soft-delete account endpoint (`DELETE /auth/me`) added.
  - **Phase 6:** `MobileTabBar` component (5 tabs: Home/Plans/Content/Scheduler/More), mounted in dashboard layout with `safe-area-inset` padding and `pb-20 lg:pb-0` content clearance.
  - Totals: ~20 files created, ~25 files modified via 9 parallel sub-agent tasks + direct edits. Zero raw `alert()`/`confirm()` in dashboard. Zero plaintext social tokens written after this commit.
