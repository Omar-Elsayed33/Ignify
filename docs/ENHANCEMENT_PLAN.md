# Ignify — Enhancement Plan (UX + Business)

Last updated: 2026-04-17
Owner: Omar
Audience: product + engineering + design

This doc captures a phased roadmap to level Ignify up from a feature-complete beta into a polished, high-retention SaaS. It is intentionally opinionated — ship one phase at a time, ship complete things, measure, then iterate.

---

## Guiding principles

1. **Speed-to-value beats feature count.** A new user must reach "oh — this made me something useful" within 5 minutes, not 30.
2. **No AI jargon in the UI.** No model pickers, no "temperature" sliders, no "mode: deep/medium/fast" lingo in the customer-facing flow. Map it to outcomes — *Quick Draft / Balanced / Premium*.
3. **Arabic-first, RTL-native.** Every new screen must pass an RTL review. No mirrored icons that look wrong, no hard-coded left-padding.
4. **Every click owes the user something.** Regenerate must visibly improve. "Approve" must unlock clear next steps. No dead-ends.
5. **Instrument everything from day one of each feature.** If you can't see who used it, you can't iterate on it.

---

## Phase 0 — Baseline cleanup (1 week)

**Goal:** make the product feel finished, not WIP.

### UX polish
- **Global toast system** — single `<Toaster />` mount, replace all `alert()` + silent fetch errors. Success = green, error = red, both dismissable, 4s default.
- **Skeleton loaders everywhere** — plan page, content-gen result, scheduler week grid, SEO audit. No spinners on full-screen blanks.
- **Error boundary pages** — every `(dashboard)/*` route wrapped. "Something went wrong. Retry / go home" — bilingual.
- **Empty states** — audit every list page. Every `EmptyState` must have: icon, 1-line explanation, primary CTA. No empty tables.
- **Consistent save patterns** — autosave on settings forms (debounced 800ms, tiny "Saved" chip), confirm-on-leave on destructive forms.
- **Button disabled states** — never leave a submit button enabled during in-flight request.

### Copy & i18n
- **Arabic translation audit** — walk every page in `/ar/…`, flag English leaks into `ar.json`. Target: 100% translated for `/dashboard`, `/plans`, `/content-gen`, `/scheduler`, `/seo/my-site`, `/settings`.
- **Shorten labels** — many buttons today are "قم بإنشاء خطة تسويقية جديدة" (7 words) when "خطة جديدة" (2 words) is enough. Brevity > completeness.
- **Consistent tone** — verbs in imperative (اكتب، أنشئ، جدول) not nouns. Pick one and enforce via PR review.

### Trust & quality signals
- **Loading times visible** — on plan generation, show "generating market analysis… (2/14)" not a generic spinner. People trust progress they can see.
- **Version/changelog footer** — `v0.4.2 · 2026-04-17` in sidebar footer. Links to a /changelog page (can start empty).

---

## Phase 1 — First-run experience (1–2 weeks)

**Goal:** zero-to-first-win under 5 minutes.

### Welcome flow
- **Tour on first login** — 4-step overlay (Dashboard / Plans / Content / Settings). Uses `driver.js` or similar. Skippable, shown once.
- **"Create your first plan" card** on empty dashboard home — big brand-gradient CTA. Disappears after first plan exists.
- **Sample plan** — for new tenants, seed one read-only "Sample Plan (view how it works)" so the plans list isn't empty on day zero.

### Onboarding depth
- **Progress bar** on onboarding (currently implicit; make explicit: business ▸ brand ▸ channels ▸ ready).
- **Skip-ahead allowed but flagged** — if the user skips brand colors, show a yellow pill "Brand step skipped — complete later" on the dashboard for 7 days.
- **Website auto-analyze** on business step — paste URL → LLM extracts industry + description + suggested competitors; pre-fills the form. (Already built in `ai_assistant.service`, wire into onboarding form.)

### Guided first plan
- After onboarding, land on `/plans/new` pre-filled from the business profile.
- Default to **fast mode**, show rough cost + time estimate ("~3 min, $0.01 of your credit"), **not** the model name.
- After generation finishes, auto-scroll to Market tab and highlight SWOT with a dismissible "this is what the AI saw in your market" tooltip.

---

## Phase 2 — Plan & content workflow depth (2–3 weeks)

**Goal:** make the core loop (plan → content → schedule → publish) feel like one fluid product, not four pages.

### Plan page
- **Sticky table-of-contents sidebar** — on `/plans/[id]`, list the 14 sections as anchor links with green checkmarks if complete, yellow for "needs attention".
- **Inline comments** — owner/admin can drop a comment on any section (stored as `plan.comments[section][]`). Shows as a yellow note next to Regen.
- **Version history** — every regen bumps `version`. Add `/plans/[id]/versions` showing a diff-like view of what changed. Rollback button.
- **Shareable read-only view** — `/plans/public/{token}` with a rotating token per plan, revocable. Useful for showing plans to clients/investors without giving account access.
- **Export as pretty PDF** — already have PDF gen; add a "branded cover page" using tenant logo + colors.

### Content generation
- **Multi-output per brief** — currently one article per run. Add "generate 3 variants" toggle — returns 3 drafts, user picks one.
- **Brief templates** — dropdown of pre-written briefs ("Instagram carousel for a product launch", "blog post SEO-optimized around keyword X"). Saves new users from blank-page paralysis.
- **Inline editor** — right now content is returned as markdown; add a WYSIWYG (Tiptap) so the user can tweak before scheduling.
- **Image suggestions** — after an article is generated, auto-run `creative_gen` with the article as brief and show 4 thumbnail options to attach.

### Scheduler
- **Calendar view (month)** — current week grid is fine for power users, but a month view is the expected mental model.
- **Bulk actions** — shift-click to multi-select; "shift all selected by 1 day" / "delete" / "mark published".
- **Optimal-time suggestions** — per-platform best-posting-time hints based on `SocialMetric` rollups (start with static industry defaults, improve with data).
- **Conflict detection** — if two posts target the same platform within 30 min, warn.
- **Per-platform preview** — render how the post will look on each platform (FB text limit, IG caption + hashtag block, LinkedIn headline, X 280-char). Visual, not just data.

### Approvals
- **Approval-required mode** per tenant setting — in agency tier, drafts go to "pending approval", only owner/admin can approve before publish.
- **Email notifications** on approval-needed + approved.

---

## Phase 3 — Analytics & feedback loop (2 weeks)

**Goal:** close the loop so users see that Ignify is moving the needle.

### Dashboard home rewrite
- **Weekly digest card** at the top: "This week you published 12 posts, +3% engagement vs last week. Top post: [title] (48 reactions)."
- **Impact number** — "Ignify saved you ~6 hours this week" (calculated from `content_posts.generated_at` count × 30 min).
- **Action-needed feed** — list of 3–5 things to do: "1 plan awaiting approval", "3 scheduled posts need images", "GSC integration disconnected — reconnect".

### Analytics depth
- **Per-post analytics drill-down** — click a published social post → see reach, engagement, comments, referrals over time. Uses platform APIs already wired.
- **Plan ROI view** — for each approved plan, show: `posts_published`, `reach_total`, `avg_engagement`, `leads_attributed` (via UTM tagging in post URLs).
- **Competitor deltas** — weekly snapshot diff: "Competitor X posted 14 reels, added 400 followers" vs. your numbers. (Already have `CompetitorSnapshot`; wire into dashboard.)

### SEO feedback
- After a deep-audit, if GSC is connected, show CTR/impressions trend per recommended page. "You fixed title on /pricing — CTR went from 2.1% → 3.8%."

### Inbox intelligence
- Auto-classified messages already built. Show a "today's priority messages" widget on the dashboard.
- One-click "reply with AI" using the inbox responder agent.

---

## Phase 4 — Business model & monetization (parallel, continuous)

**Goal:** turn product value into predictable revenue.

### Pricing & tiers

Keep the three-tier structure, sharpen it:

| | Starter ($29/mo) | Pro ($99/mo) | Agency ($299/mo) |
|---|---|---|---|
| Plans/mo | 20 fast | 30 medium + 10 fast | 50 deep + 50 medium |
| Content posts/mo | 50 | 200 | unlimited |
| Social accounts | 2 | 5 | 20 |
| Seats | 1 | 3 | 10 |
| Approvals workflow | — | — | ✓ |
| White-label | — | — | ✓ |
| Priority support | — | ✓ | ✓ + Slack channel |
| API access | — | read-only | full |

- **Annual billing** — 2 months free (≈17% off). Biggest single retention lever.
- **Credit top-ups** — $10 / $25 / $50 packs for plans or content-gen beyond quota. Keeps people from canceling when they hit the ceiling mid-month.
- **Free trial** — 14 days, full Pro tier, no card required. After day 10 show "add a card to keep your plans" banner. No "all data deleted" scare tactics.
- **Annual agency contracts** — manual invoice, PO/NET30 terms, not auto-charged. Big deal-size lever.

### Geographic pricing
- Already have Paymob/PayTabs/Geidea for MENA. Show prices in local currency (EGP, SAR, AED) based on IP. ~50% discount for MENA tier — target local SMBs.

### Add-ons & upsells
- **Custom domain white-label** — $49/mo add-on for Agency. `agency.client.com` instead of `app.ignify.io`.
- **Dedicated account manager** — $499/mo add-on for Agency+. Sells itself to Enterprise fish.
- **Compliance pack** (GDPR/HIPAA reports, SLA) — $199/mo, for any tier.

### Referral & growth loops
- **Referral program** — each user gets a unique `/ref/XXXX` link. Successful paid referral = 1 month free for both sides. Track via UTM + new `Referral` table.
- **Public template gallery** — users can publish their plans (with PII stripped) as templates others can clone. Featured templates drive SEO + social proof.
- **"Made with Ignify" footer** — optional on exported PDFs for Starter/Pro (default on, removable on Agency). Free distribution.
- **Affiliate program** — 30% recurring commission for first year, mid-to-long funnel play.

### Retention
- **Cancellation interview** — on cancel, ask "why?" with 5 common reasons + "other". Offer 50% off for 2 months on "too expensive". Classic save-offer flow.
- **Winback email** — 14 / 30 / 90 days post-cancel with personalized "here's what's new + 3 months at 50%".
- **NPS in-app** — after 30 days, one-tap 1-10 + "why?" textarea. Drives feature priorities.

---

## Phase 5 — Reliability & trust (2 weeks)

**Goal:** remove things that can embarrass us in front of a paying customer.

### Security
- **Encrypt social tokens at rest** — use `cryptography.fernet` with `SECRET_KEY`-derived key; rotate-safe. Rename column `access_token_encrypted` (actually encrypted now).
- **Audit log viewable by tenant owner** — already have `AuditLog` table, expose under `/settings/security`.
- **SSO for Agency** — Google Workspace + Microsoft Entra via OAuth. High-trust deal closer.
- **Rate limiting per tenant** — already have `core/rate_limit.py`; enforce on all write endpoints.

### Testing
- **Integration test suite** — pytest-asyncio, hit real database (docker-compose test services), cover auth + plan gen + content gen + scheduler publish flows. Target 50% coverage of `services/backend/app/modules/`.
- **Frontend E2E** — Playwright, cover the 3 golden paths from CLAUDE.md §11.
- **CI** — GitHub Actions, run tests on every PR. Block merge on red.

### Observability
- **Sentry enabled** on backend and frontend (env var already exists).
- **Structured logging** — switch from print to `structlog` with tenant_id + user_id + request_id baked in.
- **Key metrics dashboard** (Grafana or just Sentry/Posthog) — plan generation latency, content-gen success rate, scheduler publish success rate, API p95.

### Compliance
- **Privacy policy + ToS** — generate a first draft, legal review before first paid tenant.
- **Data export** — one-click "download all my data as JSON" per tenant under `/settings/privacy`. Required for GDPR, wins trust regardless.
- **Data deletion** — tenant self-service "delete my account", 7-day soft-delete window then hard delete. Compliance + insurance.

---

## Phase 6 — Mobile & accessibility (2–3 weeks)

**Goal:** 40%+ of SMB owners manage their socials from phone.

### Responsive pass
- Audit every route at 375×667 (iPhone SE). Today sidebar is collapse-only, several tables overflow.
- **Bottom tab bar** on mobile (≤md breakpoint) replacing sidebar: Home · Plans · Content · Scheduler · More.
- **Scheduler week grid** → list view on mobile.

### Progressive Web App
- Add manifest + service worker. Installable from Chrome/Safari. Push notifications for scheduled-post results, approval pings, new lead.

### Accessibility
- Keyboard nav pass — Tab order, visible focus rings, Esc closes modals.
- Screen-reader labels — every icon button must have `aria-label`.
- Color contrast audit — MD3 tokens pass WCAG AA; verify with axe.

---

## Phase 7 — Platform & API (later, when paying customers demand it)

**Goal:** become infrastructure, not just a tool.

- **Public REST API** — expose plans, content, scheduler endpoints with per-tenant API keys. Quota-enforced per tier.
- **Webhooks** — fire on plan.generated, post.published, lead.created. Customer can wire to their CRM.
- **Zapier / Make.com integration** — 10 triggers + 10 actions cover 80% of asks.
- **Mobile app** (React Native + shared API) — post from phone, approve drafts, see inbox. Tier-3 priority.
- **Marketplace for templates** — plans, content briefs, brand kits. Creators get revenue share.

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

## Immediate next 3 tickets (ready to start)

1. **Global toast system + replace all alert()** — half a day, unblocks every future feature that needs feedback.
2. **Onboarding website auto-analyze** — wire existing `ai_assistant.service.analyze_website` into the business-step form. One day.
3. **Social token encryption at rest** — blocker before first real paying tenant. Half a day + migration.

Do these three, in order, before Phase 2 work begins.
