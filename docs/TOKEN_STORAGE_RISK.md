# Frontend Token Storage — Risk Assessment + Decision

**Last updated**: 2026-04-25  
**Owner**: frontend lead.

---

## Current state

The Ignify dashboard stores both the access token and the refresh token in `localStorage` via Zustand persistence (`dashboard/src/store/auth.store.ts`, key `ignify_auth`). The API wrapper (`dashboard/src/lib/api.ts`) reads them on every request.

```ts
// auth.store.ts
persist(
  (set) => ({ user, tenant, accessToken, refreshToken, ... }),
  { name: "ignify_auth" }
)
```

## Risk

XSS attacks against the dashboard can read `localStorage` and exfiltrate both tokens. With the refresh token an attacker can mint new access tokens indefinitely — a full account takeover.

## Decision (Phase 12): **Option A — Mitigate now, migrate later**

Option B (HttpOnly cookies for refresh tokens, in-memory access tokens) is the correct long-term fix but requires:
- Backend changes: cookie-set endpoints, CORS credential mode, CSRF protection.
- Frontend changes: remove tokens from store, replace API wrapper auth header path.
- Coordinated rollout: all clients (dashboard, future mobile) need to follow.

This is ~1–2 weeks of focused work. **For first-customer launch we accept the risk and ship Option A**, with Option B tracked as the next-phase follow-up.

---

## Option A — current mitigations in place

### 1. Strict input sanitization

Every user-controlled string rendered into the DOM goes through React's default escaping. The codebase has zero `dangerouslySetInnerHTML` calls outside of intentional rich-content rendering (verified via grep).

```bash
grep -r "dangerouslySetInnerHTML" dashboard/src
# Must return zero results, or every result must be reviewed.
```

### 2. Content-Security-Policy header

To be added at the Nginx gateway in production. The CSP must:
- `default-src 'self'`
- `script-src 'self'` (no inline scripts allowed)
- `connect-src 'self' https://api.ignify.ai`
- Disallow inline event handlers

This is enforced in the Nginx config (NOT in the Next.js layer — Nginx is the edge).

### 3. Short access-token lifetime

Reduce blast radius of a leaked access token. The backend defaults are:
- Access token: 7 days (too long for an XSS-bound token)
- Refresh token: 30 days

**Action item**: shorten access token to 60 minutes and refresh token to 14 days. This makes a stolen access token expire fast; refresh-token rotation on every refresh further limits replay.

```python
# app/core/config.py
ACCESS_TOKEN_EXPIRE_MINUTES = 60        # was 60 * 24 * 7
REFRESH_TOKEN_EXPIRE_DAYS = 14          # was 30
```

### 4. Refresh-on-401 flow review

The current API wrapper (`api.ts`) calls `refreshAccessToken()` on any 401. This is correct — what we want to verify:
- The new access token replaces the old in localStorage immediately
- A failed refresh redirects to `/login` and CLEARS both tokens
- No request retries past the second attempt (avoid an infinite refresh loop)

Confirmed by reading `api.ts:81-95` — all three are in place.

### 5. Subresource integrity for third-party scripts

If the dashboard loads any external script (analytics, fonts), use SRI hashes. Current state: dashboard loads Google Fonts only (low risk; consider self-hosting), no external JS.

---

## Option B — follow-up scope (deferred to Phase 13)

When this lands, it removes the XSS-token-leak vector entirely:

### Backend changes

1. New endpoint `POST /auth/login-cookie` that issues:
   - JWT access token in response body (read by frontend, stored in JS memory only)
   - Refresh token as `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=1209600`

2. `POST /auth/refresh` reads the refresh cookie, issues a new access token (response body) + rotates the refresh cookie.

3. `POST /auth/logout` clears the cookie via `Set-Cookie: refresh_token=; Max-Age=0`.

4. CORS: `allow_credentials=True` and origins list must be exact (no wildcard).

5. CSRF token for `POST /auth/refresh` (since cookies are auto-sent).

### Frontend changes

1. Auth store stops persisting `refreshToken` (keep `user` + `tenant` for UI hydration).
2. Access token kept in JS memory only (not in localStorage).
3. `fetch()` calls use `credentials: 'include'` so the refresh cookie is sent.
4. On page load: silent refresh via `/auth/refresh` to get a fresh access token into memory.

### Risks of Option B

- Mobile app (when built) needs different token handling (cookies don't work for native).
- Any tab that wasn't open during refresh has an expired access token in memory and must silent-refresh on next request.
- CSRF protection becomes load-bearing.

---

## Tracking

This document is the source of truth for the decision. When Option B ships:
- Replace this file's "Decision" section.
- Add a `phase-13-cookie-auth-migration` commit.
- Verify the XSS risk is closed by a security review.

---

*Anyone considering changes to `dashboard/src/lib/api.ts` or `dashboard/src/store/auth.store.ts` should re-read this doc first. The current state is intentional.*
