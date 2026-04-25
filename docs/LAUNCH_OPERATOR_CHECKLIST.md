# Ignify — Launch Operator Checklist

**Owner**: ops / founder (the one with access to production env vars, DNS, DB).
**Goal**: get from "code is ready" to "first paying customer can sign up".
**Expected time**: ~3–5 business days assuming all external vendors respond normally.

Everything below is **operator-owned** — no engineering work required, but the items must be done before marketing traffic hits the site.

---

## 1. Infrastructure prerequisites

- [ ] Production domain registered and DNS pointing to the load balancer / Nginx gateway
- [ ] TLS certificate issued (Let's Encrypt via certbot, or AWS ACM, or Cloudflare)
- [ ] HTTPS redirect enforced at the gateway (no `http://` traffic served)
- [ ] Managed PostgreSQL 16 provisioned with automated daily backups (PITR ≥ 7 days)
- [ ] Managed Redis 7 with AOF persistence
- [ ] Production S3 bucket (or MinIO cluster) with versioning + lifecycle rules
- [ ] Static asset CDN in front of MinIO (optional but recommended for creative URLs)

---

## 2. Required environment variables

The backend's `assert_safe_to_boot()` validator will refuse to start in production (`DEBUG=false`) if any **required** var is missing/unsafe. Set these before the first real boot.

### Required — boot will fail without these

| Var | Rule | How to generate |
|-----|------|-----------------|
| `DEBUG` | `false` | Manual set |
| `SECRET_KEY` | ≥ 64 random chars, not the dev sentinel | `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DATABASE_URL` | Points to managed PG, not dev password | Use the managed-service connection string |
| `REDIS_URL` | Managed Redis URL | — |
| `OPENROUTER_API_KEY` | Valid OpenRouter master inference key | From openrouter.ai/keys |
| ~~`OPENROUTER_MANAGER_KEY`~~ | **Removed in Phase 12** — manager key is now set via the admin UI at `/admin` and stored encrypted in the DB. Env var no longer needed. See `docs/SECURITY_SECRET_ROTATION.md` §1. | n/a |
| `CORS_ORIGINS` | JSON array of production domains only | `["https://app.ignify.ai"]` |

### Required for first customer experience

| Var | Why | Notes |
|-----|-----|-------|
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Email verification + password reset | Set `EMAIL_VERIFICATION_REQUIRED=true` once SMTP is confirmed working |
| `SENTRY_DSN` | Production error tracking | Create a project at sentry.io and copy the DSN |
| `REPLICATE_API_TOKEN` | Image generation | From replicate.com/account |
| `META_APP_ID` + `META_APP_SECRET` | Facebook/Instagram OAuth | Required for social scheduling — see docs/SOCIAL_PLATFORM_SETUP.md |

### Deprecated — must NOT be set for LLM

These emit a startup WARN log. Text generation routes through OpenRouter only (see docs/AI_PROVIDER_POLICY.md):

- `ANTHROPIC_API_KEY` — **leave blank**
- `GOOGLE_API_KEY` — **leave blank**
- `OPENAI_API_KEY` — leave blank UNLESS using semantic search (embeddings). For v1 launch, leave blank.

---

## 3. Email deliverability (SPF / DKIM / DMARC)

Without these DNS records, verification emails land in spam. Every prospective customer who can't verify their email churns before they see the product.

- [ ] Pick an SMTP provider (SendGrid, Postmark, SES, or Mailgun)
- [ ] Verify the sending domain inside the provider's dashboard
- [ ] Add the three DNS records they give you:
  - **SPF** — `TXT @ "v=spf1 include:<provider> -all"`
  - **DKIM** — provider-generated key at `<selector>._domainkey`
  - **DMARC** — `TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:postmaster@ignify.ai"`
- [ ] Warm up the sending domain (don't send 10k emails on day 1 — send 50, then 200, then 1000 over a week)
- [ ] Test with https://www.mail-tester.com/ — target score ≥ 9.0/10

---

## 4. Secret rotation + storage

The default dev `SECRET_KEY` is a sentinel that `assert_safe_to_boot()` refuses to boot against. After rotating:

- [ ] Generate a 64-char random value (`secrets.token_urlsafe(64)`)
- [ ] Store in a real secret manager: AWS Secrets Manager, HashiCorp Vault, or (minimum) env vars via a secure CI/CD secret, NOT a `.env` file on disk
- [ ] Ensure the manager key is separately stored and only accessible to the backend runtime user
- [ ] Document the key-rotation procedure (we use `ENCRYPTION_KEY_PREVIOUS` for graceful Fernet rotation — see Phase 2)

---

## 5. OpenRouter provisioning verification

Before inviting real tenants:

- [ ] `curl https://openrouter.ai/api/v1/keys -H "Authorization: Bearer $OPENROUTER_MANAGER_KEY"` returns 200
- [ ] Manager key has the "Manage keys" scope (visible in openrouter.ai/settings/keys)
- [ ] Register a test tenant in the dashboard, confirm a sub-key is created in OpenRouter with **name = tenant UUID** (no `ignify-` prefix — this was fixed in Phase 11)
- [ ] Delete the test tenant's key from OpenRouter after verification so spend stays at $0

```bash
# Smoke test — run against a staging tenant
docker compose exec backend python -c "
from app.core.openrouter_provisioning import provision_key
import asyncio, uuid
result = asyncio.run(provision_key(str(uuid.uuid4()), 'Test Biz', 'starter'))
print(result)
"
```

Expected output:
```python
{'key_id': 'kid-...', 'key': 'sk-or-...', 'limit': 6.0}
```

---

## 6. Billing — payment gateway status

**Current reality (2026-04-25)**: Stripe and Paymob KYC is NOT YET COMPLETE. Offline payment flow is the only active subscription method.

### If KYC still pending (likely on day 1)

- [ ] Verify offline flow works end-to-end: tenant submits → admin approves → subscription activates → budget syncs
- [ ] Set `STRIPE_SECRET_KEY=""` and `PAYMOB_API_KEY=""` explicitly (rather than leaving unset) — ensures `/billing/checkout` returns the stub URL rather than attempting a real charge
- [ ] Display bank transfer details in the billing page (Banque Misr / your bank)
- [ ] Ensure `/settings/billing` shows the "subscribe by bank transfer / WhatsApp" path prominently
- [ ] WhatsApp support number is set in `NEXT_PUBLIC_SUPPORT_WHATSAPP` for the landing-page CTA

### When KYC completes (follow-up)

- [ ] Set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- [ ] Configure webhook endpoint at `https://api.ignify.ai/api/v1/billing/webhooks/stripe`
- [ ] Test with a $1 real card charge before enabling publicly
- [ ] Document the refund process internally

---

## 7. Legal / compliance

- [ ] Terms of Service reviewed by legal counsel and published
- [ ] Privacy Policy reviewed and published (GDPR + MENA-specific local laws)
- [ ] Refund Policy published
- [ ] DPA template available for enterprise customers
- [ ] Cookie consent banner on the website for EU visitors
- [ ] "Powered by Ignify" removed from white-label tenants (already enforced via `hide_powered_by` brand setting)

---

## 8. One-shot operator tasks (run once at launch)

### Bulk-encrypt any legacy plaintext tokens

If the DB has any rows from dev/staging with plaintext tokens:

```bash
docker compose exec backend python -m scripts.encrypt_existing_tokens --dry-run
# Review the output, then without --dry-run:
docker compose exec backend python -m scripts.encrypt_existing_tokens
```

Expected final state: `scanned=0 encrypted=0`. If your first run shows `scanned=N encrypted=N`, run again — second run must show 0.

### Seed plan mode configs

Idempotent. Safe to re-run.

```bash
docker compose exec backend python -m scripts.seed_plan_modes
```

### Verify migrations at head

```bash
docker compose exec backend alembic current
# Expected: s9t0u1v2w3x4 (head) — or whatever the latest migration is
```

---

## 9. Monitoring + alerting

- [ ] Sentry production project created, DSN configured, first test error confirmed visible
- [ ] Uptime monitor (BetterStack / Pingdom) hitting `/ops/ready` every 60s with alert on 503
- [ ] `/ops/status` behind `OPS_STATUS_TOKEN` in production (info-disclosure prevention)
- [ ] Log aggregation configured (Loki / CloudWatch / Datadog)
- [ ] Slack / PagerDuty channel for production alerts
- [ ] At-least-one on-call person with access to the DB, Redis, and Sentry

---

## 10. Pre-launch final checks

Run in order on launch day:

1. [ ] `docker compose ps` — all 9 containers `healthy`
2. [ ] `curl https://api.ignify.ai/ops/ready` → `200 {"ready": true, ...}`
3. [ ] `docker compose exec backend alembic current` → at head
4. [ ] Register a test tenant on the production dashboard, complete onboarding, generate a Fast plan
5. [ ] Confirm the plan landed in DB with `cost_usd > 0` and the tenant's OpenRouter key shows usage
6. [ ] Delete the test tenant (or convert to a "Customer Zero" demo account — see DEMO_ACCOUNT_SETUP.md)
7. [ ] Invite the first real customer

---

## Current live status (captured from `/ops/status` today)

```json
{
  "db": "ok", "redis": "ok", "minio": "ok",
  "worker": {"status": "ok", "worker_count": 1},
  "providers": {
    "openrouter": true,
    "openai": false, "anthropic": false, "google": false,
    "replicate": false, "elevenlabs": false,
    "stripe": false, "paymob": false, "paytabs": false,
    "meta": false, "smtp": false
  }
}
```

**Providers needed before launch**: `smtp`, `replicate`, `meta`, and optionally `sentry`. The rest (Stripe, Paymob, PayTabs) can wait until KYC completes; offline billing is the active path.

---

*This doc is the single source of truth for launch-day ops work. If any step above is unclear, file it as an issue before launch — don't guess.*
