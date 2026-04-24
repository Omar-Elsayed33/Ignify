# Demo Account — Sales Setup

Seed a pre-populated tenant that's ready to drive sales demos without a fresh generation run during the call.

---

## Quickstart

```bash
docker compose exec backend python -m scripts.seed_demo_tenant
```

Idempotent — safe to re-run. Updates existing demo rows rather than duplicating.

## Credentials

| Field | Value |
|-------|-------|
| Dashboard URL | `http://localhost:3000/ar/login` (or your prod URL) |
| Email | `demo@ignify.com` |
| Password | `Demo@2024` |
| Tenant slug | `demo-ignify` |
| Plan | Pro |
| AI budget | $22/mo (synced) |
| Workflow | `approval_required=true` |

## What the script creates

| Item | Count | Notes |
|------|-------|-------|
| Tenant + owner user | 1 each | Verified email, active subscription, Arabic as primary |
| Business profile | — | MENA skincare e-commerce (`متجر الأمل`), realistic industry + competitors |
| Brand settings | — | Pink primary (#E91E63), friendly tone, Arabic voice |
| Approved content posts | 3 | Launch announcement, morning routine guide, clay-mask tips — all in natural Arabic |
| Creative assets | 3 | Placeholder picsum.photos URLs — **swap pre-demo** if you want real creatives |
| Scheduled posts | 2 | Manual mode, tomorrow + day-after, linked to content posts |
| AI budget config | — | `monthly_limit_usd = $22.00`, `usage_usd = $0` |

## Pre-demo checklist (5 min before the meeting)

1. Re-run the seed script to ensure everything is fresh:
   ```
   docker compose exec backend python -m scripts.seed_demo_tenant
   ```
2. Log in as `demo@ignify.com`, confirm dashboard loads with:
   - StatusFocus showing 3 pending items (approved posts, scheduled manual posts)
   - Weekly digest section (may show zeros until first publish — that's fine)
3. Optional: run creative-gen once live to swap placeholder images with real Flux output.
4. Optional: start a Fast plan generation during the demo (live AI animation is the "wow" moment).

## What the demo showcases

Walk the prospect through these, in order:

1. **Onboarding completion** — show the business profile already populated (proves multi-step onboarding works without making them watch it).
2. **Plan detail** — open any generated plan to demonstrate `ThisWeekActions` + `RealismWarnings` + range bars.
3. **Content library** — 3 pre-approved Arabic posts; click one to show the approval flow.
4. **Scheduler** — calendar view with 2 manual posts; click one to show "publish manually" flow.
5. **AIUsageWidget** — upper right shows $22 budget with $0 used. Mention: *"every tier has a clear cap — no surprise bills."*
6. **Pricing page** — walk through the 5 tiers with concrete limits.

## What the demo tenant explicitly does NOT do

- No real social accounts connected (safer — no accidental publishes during demo).
- No live plan in the DB at seed time (you generate one live if you want the wow moment).
- No real OpenRouter spend during seeding.

## Reset between demos

The script is idempotent, but if you want a pristine state:

```bash
# Delete all demo-tenant data and re-seed
docker compose exec postgres psql -U ignify -d ignify -c "
DELETE FROM social_posts WHERE tenant_id IN (SELECT id FROM tenants WHERE slug='demo-ignify');
DELETE FROM creative_assets WHERE tenant_id IN (SELECT id FROM tenants WHERE slug='demo-ignify');
DELETE FROM content_posts WHERE tenant_id IN (SELECT id FROM tenants WHERE slug='demo-ignify');
"
docker compose exec backend python -m scripts.seed_demo_tenant
```

## For production demos

In production:
- Ensure your prod DB has the Phase 6 catalog (`pro` slug, not `professional`). The script handles both, but the AI budget override in the script always sets $22 regardless.
- Change `DEMO_PASSWORD` in the script to something less guessable before running in prod. Don't check the new value into git.
- Consider a `DEMO_TENANT_INACTIVE` flag if you want to "soft-freeze" the demo between sessions.
