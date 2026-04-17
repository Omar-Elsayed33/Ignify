# Social Platform Setup Guide

This guide walks you (the **Ignify SaaS operator**) through registering one OAuth
app per social platform so your customers can click **Connect** in the dashboard
and publish to their own accounts.

> **You register the app once.** Your customers (tenants) don't touch any
> developer portal — they only authorize their own social account against
> the app you registered.

---

## Callback URLs you'll need (copy-paste)

Every platform needs a redirect URI registered in its developer portal. For
local dev, the backend listens on port 8000:

| Platform   | Redirect URI |
|------------|--------------|
| Meta (FB + IG) | `http://localhost:8000/api/v1/social-scheduler/oauth/meta/callback` |
| LinkedIn   | `http://localhost:8000/api/v1/social-scheduler/oauth/linkedin/callback` |
| X (Twitter)| `http://localhost:8000/api/v1/social-scheduler/oauth/x/callback` |
| YouTube    | `http://localhost:8000/api/v1/social-scheduler/oauth/youtube/callback` |
| TikTok     | `http://localhost:8000/api/v1/social-scheduler/oauth/tiktok/callback` |
| Snapchat   | `http://localhost:8000/api/v1/social-scheduler/oauth/snapchat/callback` |
| Google SEO | `http://localhost:8000/api/v1/seo/integrations/oauth/google/callback` |

For production, swap `http://localhost:8000` for your real domain (e.g. `https://api.ignify.ai`).

---

## 1. Meta (Facebook + Instagram)

**One app, two platforms.** A single OAuth grant returns Facebook Pages *and*
the Instagram Business accounts linked to them.

1. Open https://developers.facebook.com/apps → **Create App** → pick **Business**.
2. Add products: **Facebook Login for Business** and **Instagram Graph API**.
3. Settings → Basic → copy **App ID** and **App Secret**.
4. Facebook Login for Business → Settings → add the redirect URI above.
5. App Review → request these permissions (needed for production, but works in dev with test users without approval):
   - `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`
   - `instagram_basic`, `instagram_content_publish`
   - `business_management`, `ads_management`, `ads_read`
6. In `.env` set:
   ```
   META_APP_ID=<App ID>
   META_APP_SECRET=<App Secret>
   ```

**Requirement on the customer side:** their Facebook account must manage at
least one Page, and for Instagram they need a Business or Creator account
linked to that Page.

---

## 2. LinkedIn

Publishes to a **personal profile**. Posting to a Company Page requires the
`w_organization_social` scope + page URN — deferred.

1. Open https://www.linkedin.com/developers/apps → **Create app**.
2. Associate with a Company Page (any page will do — required by LinkedIn).
3. Auth tab → add the redirect URI above.
4. Products tab → request:
   - **Sign In with LinkedIn using OpenID Connect** (auto-approved)
   - **Share on LinkedIn** (auto-approved)
5. Auth tab → copy **Client ID** and **Client Secret**.
6. In `.env` set:
   ```
   LINKEDIN_CLIENT_ID=<Client ID>
   LINKEDIN_CLIENT_SECRET=<Client Secret>
   ```

**Token lifetime:** 60 days. Refresh tokens are issued but not yet persisted
(we don't have a DB column for them). Re-connect when expired.

---

## 3. X (Twitter)

> **⚠️ Costs $200/month (Basic tier) to publish.** Free tier is read-only as
> of 2024. Sign-in and OAuth work on the free tier.

1. Open https://developer.x.com/en/portal/dashboard → **Sign up** for a developer account.
2. Upgrade to **Basic** plan if you want to post (the free plan reads only).
3. Create a Project + App inside it.
4. User authentication settings:
   - App permissions: **Read and write**
   - Type of App: **Web App**
   - Callback URI: the one above
5. Keys and tokens → **OAuth 2.0** → copy **Client ID** and **Client Secret**.
6. In `.env` set:
   ```
   X_CLIENT_ID=<Client ID>
   X_CLIENT_SECRET=<Client Secret>
   ```

**Media uploads** still use API v1.1 which the Basic plan also covers.

---

## 4. YouTube

1. Open https://console.cloud.google.com/apis/credentials.
2. Create a new project (e.g. "Ignify-YouTube") OR reuse an existing one.
3. Enable **YouTube Data API v3** under APIs & Services → Library.
4. OAuth consent screen → configure as **External**, scopes include:
   - `.../auth/youtube.upload`
   - `.../auth/youtube.readonly`
5. Credentials → Create Credentials → **OAuth client ID** → **Web application**.
6. Authorized redirect URIs → add the one above.
7. Copy **Client ID** and **Client Secret**.
8. In `.env` set:
   ```
   YOUTUBE_CLIENT_ID=<Client ID>
   YOUTUBE_CLIENT_SECRET=<Client Secret>
   ```

> Use a **separate** OAuth client from the Google SEO one (`GOOGLE_OAUTH_*`) —
> they need different scopes and isolating them avoids unintended access grants.

**Video size limit:** current connector uses simple multipart upload (≤256 MB).
For larger files, resumable upload is needed — deferred.

---

## 5. TikTok

> **⚠️ Requires TikTok app review for `video.publish`.** Sandbox mode lets
> you post to the developer's own TikTok account only.

1. Open https://developers.tiktok.com/apps/ → **Create app**.
2. Configure app → fill in description, icon, categories.
3. Add the redirect URI above.
4. Request scopes:
   - `user.info.basic`
   - `video.upload`
   - `video.publish` (needs review for production)
5. Copy **Client Key** and **Client Secret**.
6. In `.env` set:
   ```
   TIKTOK_CLIENT_KEY=<Client Key>
   TIKTOK_CLIENT_SECRET=<Client Secret>
   ```

**Publishing:** the connector uses `PULL_FROM_URL`, meaning TikTok downloads
the video from the URL Ignify provides. The `media_urls[0]` must be publicly
reachable — not a short-lived signed URL. Our MinIO bucket needs to be public
OR you need a CDN in front.

---

## 6. Snapchat

> **⚠️ No public posting API exists.** The connector only OAuths in so you can
> show Snapchat as "connected" in the UI. `publish()` raises `NotImplementedError`.
> In practice: customers should use **manual publish mode** for Snapchat.

1. Open https://kit.snapchat.com/portal → sign in with a Snapchat account.
2. Create a new OAuth application.
3. Add the redirect URI above.
4. Scopes: `display_name` + `external_id`.
5. Copy **Client ID** and **Client Secret**.
6. In `.env` set:
   ```
   SNAPCHAT_CLIENT_ID=<Client ID>
   SNAPCHAT_CLIENT_SECRET=<Client Secret>
   ```

---

## 7. Google Search Console + Analytics 4

Separate OAuth app from YouTube. Used by the SEO module, not the scheduler.

1. https://console.cloud.google.com/apis/credentials — same project is fine.
2. Enable: **Search Console API**, **Google Analytics Admin API**, **Google Analytics Data API**.
3. Create another **OAuth client ID** → **Web application**.
4. Authorized redirect URI: `http://localhost:8000/api/v1/seo/integrations/oauth/google/callback`.
5. In `.env` set:
   ```
   GOOGLE_OAUTH_CLIENT_ID=<Client ID>
   GOOGLE_OAUTH_CLIENT_SECRET=<Client Secret>
   ```

---

## After editing `.env`

```bash
cd infra/docker
docker compose restart backend worker
```

Then open `/ar/scheduler/accounts`. Each platform card will show:
- **جاهز للربط** (green button) — OAuth is configured, customer can click **Connect**
- **غير مُعدّ على الخادم** (disabled button) — `.env` missing creds

---

## Verifying a connector works

```bash
# Check which connectors the backend reports as configured
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/social-scheduler/connectors
```

Expected:
```json
{
  "connectors": [
    {"platform": "facebook",  "configured": true,  "requires_media": false, "supports_refresh": false},
    {"platform": "instagram", "configured": true,  "requires_media": true,  "supports_refresh": false},
    {"platform": "linkedin",  "configured": true,  "requires_media": false, "supports_refresh": true},
    ...
  ]
}
```

---

## Production checklist

- [ ] Replace `http://localhost:8000` in every redirect URI with your real backend domain.
- [ ] Meta: submit for App Review with the scopes listed above.
- [ ] LinkedIn: verify the Company Page that owns the app.
- [ ] X: upgrade to Basic plan if you want to publish tweets.
- [ ] TikTok: submit for `video.publish` review.
- [ ] Store `*_CLIENT_SECRET` values in a secrets manager (AWS/GCP Secret Manager), NOT in the git-tracked `.env`.
- [ ] Set Postgres `social_accounts.access_token_encrypted` to actually encrypt (currently plaintext — TODO).
