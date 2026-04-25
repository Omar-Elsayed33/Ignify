# Secret Rotation Playbook

**Last updated**: 2026-04-25  
**Audience**: ops / launch manager.

This is the canonical reference for rotating any secret in Ignify. Follow it any time:
- A key is suspected leaked.
- An employee with access leaves.
- A scheduled rotation date arrives.
- A vendor (OpenRouter, Replicate, Stripe) revokes a key.

---

## What's covered + where it lives

| Secret | Storage | Rotation surface |
|--------|---------|------------------|
| `SECRET_KEY` (JWT signing + Fernet derivation) | env var | Set new value → restart backend |
| `ENCRYPTION_KEY` (Fernet primary) + `ENCRYPTION_KEY_PREVIOUS` (rotation list) | env var | Add old key to PREVIOUS, set new PRIMARY → restart |
| `OPENROUTER_MANAGER_KEY` | **DB-stored admin setting** (Phase 12) | `/admin/openrouter-manager-key` UI — no redeploy |
| `OPENROUTER_API_KEY` (master fallback) | env var | Set new value → restart backend |
| Tenant OpenRouter sub-keys | DB (`tenant_ai_config.openrouter_key_encrypted`, Fernet) | Re-provision via admin tenant action |
| Social OAuth tokens | DB (`social_accounts.access_token_encrypted`, Fernet) | User re-OAuths (or wait for refresh) |
| Stripe / Paymob webhook secrets | env var | Vendor portal → set new value → restart |
| `OPS_STATUS_TOKEN` (status endpoint auth) | env var | Set new value → restart |

---

## When a leak is detected

If a secret has leaked or is suspected leaked, treat it as compromised IMMEDIATELY:

### 0. Triage (60 seconds)

1. Confirm what type of secret leaked. Different secrets have different blast radius.
2. Locate the leak source (PR, repo, message, log file). Stop the bleeding before rotating.
3. Open an incident note: time discovered, source, key ID/prefix (NEVER the full value).

### 1. OpenRouter manager key — Phase 12 path

Rotate from the admin UI; no redeploy needed.

```
Login to /admin → AI Providers → OpenRouter Manager Key
→ paste new key → Save
```

Or via API:

```bash
curl -X PUT https://api.ignify.ai/api/v1/admin/openrouter-manager-key \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"value": "<new sk-or-v1-...>"}'
```

Then revoke the old key in the OpenRouter dashboard.

### 2. OpenRouter API key (master fallback) or any env-var secret

```bash
# 1. Generate the new value at the vendor (OpenRouter / Replicate / Stripe).
# 2. Update the production env (secret manager, not .env on disk).
# 3. Rolling restart:
docker compose -f docker-compose.prod.yml up -d --no-deps backend worker worker-beat
# 4. Revoke the old value at the vendor.
# 5. Confirm logs show no auth errors for ~10 min.
```

### 3. Tenant OpenRouter sub-key compromise

A tenant's individual sub-key can be revoked + re-provisioned without affecting other tenants:

```bash
docker compose exec backend python -c "
import asyncio, uuid
from app.db.database import async_session
from app.db.models import TenantOpenRouterConfig
from app.core.openrouter_provisioning import delete_key, provision_key
from app.core.crypto import encrypt_token
from sqlalchemy import select

async def rotate(tenant_id):
    async with async_session() as db:
        cfg = (await db.execute(
            select(TenantOpenRouterConfig).where(
                TenantOpenRouterConfig.tenant_id == uuid.UUID(tenant_id)
            )
        )).scalar_one()
        if cfg.openrouter_key_id:
            await delete_key(cfg.openrouter_key_id)
        new = await provision_key(tenant_id, '', 'pro', db=db)
        cfg.openrouter_key_id = new['key_id']
        cfg.openrouter_key_encrypted = encrypt_token(new['key'])
        await db.commit()
        print(f'rotated: {new[\"key_id\"]}')

asyncio.run(rotate('THE-TENANT-UUID'))
"
```

### 4. SECRET_KEY rotation — handle with care

`SECRET_KEY` is the basis for both JWT signing AND (when `ENCRYPTION_KEY` is unset) Fernet token encryption. Naive rotation breaks every encrypted token in the DB.

**Safe path**:

```bash
# Step 1: introduce ENCRYPTION_KEY so SECRET_KEY can rotate independently of crypto.
ENCRYPTION_KEY=<old-secret-key>          # current effective fernet basis
ENCRYPTION_KEY_PREVIOUS=                 # empty for now
# Restart — no behavioral change, but encryption is now decoupled.

# Step 2: rotate SECRET_KEY.
SECRET_KEY=<new-64-char-random>
# Restart — JWTs reissued; Fernet still uses ENCRYPTION_KEY (unchanged).
# All sessions are invalidated (users re-login). Encrypted tokens still decrypt.

# Step 3 (optional, on later rotation): rotate ENCRYPTION_KEY itself.
ENCRYPTION_KEY=<new-fernet-basis>
ENCRYPTION_KEY_PREVIOUS=<old-fernet-basis>
# Restart. Old ciphertext decrypts via PREVIOUS; new writes use PRIMARY.
# Run a sweep with rotate_encryption() to lazily re-encrypt under PRIMARY.
# Once usage_synced: remove ENCRYPTION_KEY_PREVIOUS.
```

---

## Preventing future leaks

### Repository hygiene

- `.env` and `.env.*` files are gitignored (verified by `.gitignore` lines 8–14). Re-check after any restructure with `git check-ignore -v infra/docker/.env`.
- Never paste real key values into commit messages, PR descriptions, comments, or screenshots.
- Run a pre-commit hook that scans staged content for `sk-or-v1-[a-f0-9]{40,}`, `sk-proj-`, `sk-ant-` patterns. (Suggested: `gitleaks`.)
- After any merge, scan the diff for high-entropy strings.

### Storage hygiene

- All sensitive env vars MUST live in a secret manager (AWS Secrets Manager, HashiCorp Vault, Doppler) — never in plaintext `.env` files on production hosts.
- The dev `.env` file is for dev-only stub values. Real keys should not even sit there for local development of admin features — use the admin UI to enter the key once and let it persist in the (dev) DB.
- Encrypted-at-rest secrets in the DB use Fernet (`app.core.crypto`). Never log decrypted values; the `decrypt_token()` helper has no logging path that would print the result.

### Access hygiene

- Production DB access: ≤3 engineers, MFA required.
- Admin UI access: superadmin role only, audited via `audit_logs` table.
- Vendor accounts (OpenRouter, Stripe, Replicate, Meta): unique emails per engineer, MFA, no shared logins.

---

## What was rotated as part of Phase 12

| Asset | Action |
|-------|--------|
| Local `.env` `OPENROUTER_API_KEY` | Replaced with `replace_me` placeholder. Original treated as compromised. **You must rotate at openrouter.ai before resuming any LLM work locally.** |
| `OPENROUTER_MANAGER_KEY` env var | Removed entirely from `.env`, `.env.example`, `.env.prod.example`. Now managed via admin UI (`/admin/openrouter-manager-key`). |
| `.gitignore` | Added `.env.*` glob so `.env.prod` and future variants are auto-ignored. Re-allowed `*.example` files. |

---

## Verifying rotation worked

After any rotation:

1. `curl /ops/status -H "X-Ops-Token: $TOKEN"` → confirm `providers.openrouter: true`
2. Trigger a test plan-gen → confirm completes without 401
3. Sentry shows zero auth errors in the next 10 min
4. Old key returns 401 when used directly against the vendor's API

---

## Out-of-band emergency procedure

If you can't reach the admin UI (DB down, JWT signing key compromised, etc.):

1. SSH to a backend host with secret-manager access.
2. Update env var directly in the secret manager.
3. `docker compose restart backend worker` (rolling).
4. Once UP: rotate via admin UI as a follow-up to consolidate state.

---

*If a question isn't answered above, the right person to ask is whoever last touched `app/core/crypto.py`. The encryption story is intentionally simple — there are no other moving parts.*
