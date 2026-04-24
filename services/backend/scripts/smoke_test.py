"""End-to-end smoke test for Ignify.

Exercises: register → onboarding → plan generate → regenerate-section → approve
→ content-gen (linked to plan) → schedule (manual) → mark-published
→ deep SEO audit → integrations status.

Run with backend live:
    docker compose exec backend python -m scripts.smoke_test
or locally:
    python -m scripts.smoke_test --base http://localhost:8000
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import time
import traceback
from typing import Any

import httpx


RESET = "\033[0m"
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
BOLD = "\033[1m"


class Ctx:
    def __init__(self, base: str, audit_url: str) -> None:
        self.base = base.rstrip("/")
        self.audit_url = audit_url
        self.token: str | None = None
        self.admin_token: str | None = None
        self.tenant_id: str | None = None
        self.plan_id: str | None = None
        self.content_post_id: str | None = None
        self.scheduled_id: str | None = None
        self.results: list[tuple[str, bool, str]] = []

    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def admin_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.admin_token}"} if self.admin_token else {}


async def step(name: str, ctx: Ctx, coro):
    print(f"{CYAN}▶ {name}{RESET}")
    t0 = time.perf_counter()
    try:
        await coro
        dt = (time.perf_counter() - t0) * 1000
        ctx.results.append((name, True, f"{dt:.0f} ms"))
        print(f"  {GREEN}✓ pass{RESET} ({dt:.0f} ms)\n")
    except Exception as e:
        dt = (time.perf_counter() - t0) * 1000
        msg = f"{type(e).__name__}: {e}"
        ctx.results.append((name, False, msg))
        print(f"  {RED}✗ fail{RESET} ({dt:.0f} ms)\n  {msg}")
        if "--verbose" in sys.argv:
            traceback.print_exc()
        print()


async def health(client: httpx.AsyncClient, ctx: Ctx) -> None:
    r = await client.get(f"{ctx.base}/health")
    r.raise_for_status()


async def register(client: httpx.AsyncClient, ctx: Ctx) -> None:
    email = f"smoke+{int(time.time())}@test.ignify.local"
    payload = {
        "email": email,
        "password": "Smoke12345!",
        "full_name": "Smoke Tester",
        "company_name": "Smoke Corp",
        "lang_preference": "ar",
    }
    r = await client.post(f"{ctx.base}/api/v1/auth/register", json=payload)
    r.raise_for_status()
    data = r.json()
    # Response is flat: {access_token, refresh_token} — not nested under "tokens"
    ctx.token = data.get("access_token") or data.get("tokens", {}).get("access_token")
    assert ctx.token, f"no access_token in response: {data}"
    print(f"  user: {email}")


async def activate_subscription(client: httpx.AsyncClient, ctx: Ctx) -> None:
    """Unlock the subscription gate introduced in migration p6q7r8s9t0u1.

    Steps:
    1. Look up the smoke tenant's id via /auth/me (tenant_id is on the user).
    2. Log in as the seeded superadmin (admin@ignify.com / Admin@2024).
    3. PUT /admin/tenants/{tenant_id}/subscription → subscription_active=true.

    Without this, every subscription-gated endpoint returns HTTP 402 and the
    smoke test sees a cascade of failures that aren't real regressions.

    If the seeded superadmin doesn't exist (older seed / manual wipe), raises
    a clear error so ops notices rather than silently skipping.
    """
    # 1. Get the smoke user's tenant_id.
    r = await client.get(f"{ctx.base}/api/v1/auth/me", headers=ctx.headers())
    r.raise_for_status()
    me = r.json()
    ctx.tenant_id = me.get("tenant_id")
    assert ctx.tenant_id, f"auth/me did not return tenant_id: {me}"

    # 2. Log in as superadmin.
    r = await client.post(
        f"{ctx.base}/api/v1/auth/login",
        json={"email": "admin@ignify.com", "password": "Admin@2024"},
    )
    if r.status_code != 200:
        raise RuntimeError(
            "Seeded superadmin admin@ignify.com could not log in — re-seed or "
            "update this smoke step. HTTP "
            f"{r.status_code}: {r.text[:200]}"
        )
    ctx.admin_token = r.json()["access_token"]

    # 3. Activate subscription for the fresh tenant.
    r = await client.put(
        f"{ctx.base}/api/v1/admin/tenants/{ctx.tenant_id}/subscription",
        json={"subscription_active": True},
        headers=ctx.admin_headers(),
    )
    r.raise_for_status()
    print(f"  tenant {ctx.tenant_id[:8]}… subscription activated")


async def onboarding_flow(client: httpx.AsyncClient, ctx: Ctx) -> None:
    bp = {
        "industry": "E-commerce",
        "country": "EG",
        "primary_language": "ar",
        "description": "Smoke test shop selling demo widgets to SMEs",
        "target_audience": "Small business owners 25-45",
        "products": ["Widget A", "Widget B"],
        "competitors": ["CompeteCo"],
        "website": "https://example.com",
        "business_name": "Smoke Shop",
    }
    r = await client.post(f"{ctx.base}/api/v1/onboarding/business-profile", json=bp, headers=ctx.headers())
    r.raise_for_status()
    r = await client.post(
        f"{ctx.base}/api/v1/onboarding/brand-voice",
        json={"tone": "friendly", "forbidden_words": [], "colors": {"primary": "#0A84FF"}, "fonts": {}},
        headers=ctx.headers(),
    )
    r.raise_for_status()
    r = await client.post(
        f"{ctx.base}/api/v1/onboarding/channels",
        json={"channels": ["facebook", "instagram", "website"]},
        headers=ctx.headers(),
    )
    r.raise_for_status()
    r = await client.post(f"{ctx.base}/api/v1/onboarding/complete", headers=ctx.headers())
    r.raise_for_status()


async def generate_plan(client: httpx.AsyncClient, ctx: Ctx) -> None:
    payload = {
        "title": "Smoke Test Plan",
        "period_days": 30,
        "language": "ar",
        "plan_mode": "fast",
        "primary_goal": "awareness",
        "budget_monthly_usd": 500,
    }
    r = await client.post(
        f"{ctx.base}/api/v1/plans/generate", json=payload, headers=ctx.headers(), timeout=600
    )
    r.raise_for_status()
    plan = r.json()
    ctx.plan_id = plan["id"]
    print(f"  plan_id: {ctx.plan_id}  status: {plan.get('status')}  version: {plan.get('version')}")
    # Sanity check: SWOT should live inside market_analysis
    ma = plan.get("market_analysis") or {}
    has_swot = "swot" in ma
    print(f"  market_analysis.swot present: {has_swot}")


async def regen_section(client: httpx.AsyncClient, ctx: Ctx) -> None:
    assert ctx.plan_id
    r = await client.post(
        f"{ctx.base}/api/v1/plans/{ctx.plan_id}/regenerate-section",
        json={"section": "personas", "note": "اجعل الشخصيات أكثر تركيزًا على أصحاب الأعمال الصغيرة"},
        headers=ctx.headers(),
        timeout=300,
    )
    r.raise_for_status()


async def approve_plan(client: httpx.AsyncClient, ctx: Ctx) -> None:
    assert ctx.plan_id
    r = await client.post(
        f"{ctx.base}/api/v1/plans/{ctx.plan_id}/approve", headers=ctx.headers()
    )
    r.raise_for_status()
    assert r.json().get("status") == "approved"


async def content_gen_linked(client: httpx.AsyncClient, ctx: Ctx) -> None:
    assert ctx.plan_id
    payload = {
        "brief": "اكتب منشور ترحيبي قصير للعملاء الجدد",
        "target": "post",
        "platform": "facebook",
        "language": "ar",
        "plan_id": ctx.plan_id,
    }
    r = await client.post(
        f"{ctx.base}/api/v1/content-gen/generate", json=payload, headers=ctx.headers(), timeout=180
    )
    r.raise_for_status()
    data = r.json()
    ctx.content_post_id = str(data["content_item_id"])
    print(f"  content_post_id: {ctx.content_post_id}")


async def fetch_content_post(client: httpx.AsyncClient, ctx: Ctx) -> None:
    assert ctx.content_post_id
    r = await client.get(
        f"{ctx.base}/api/v1/content/posts/{ctx.content_post_id}", headers=ctx.headers()
    )
    r.raise_for_status()
    post = r.json()
    meta = post.get("metadata") or {}
    assert str(meta.get("plan_id")) == ctx.plan_id, f"metadata.plan_id mismatch: {meta.get('plan_id')}"
    print(f"  metadata.plan_id == plan_id: OK")


async def schedule_manual(client: httpx.AsyncClient, ctx: Ctx) -> None:
    assert ctx.content_post_id
    from datetime import datetime, timedelta, timezone

    when = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    r = await client.post(
        f"{ctx.base}/api/v1/social-scheduler/schedule",
        json={
            "platforms": ["facebook"],
            "scheduled_at": when,
            "caption": "Smoke manual post",
            "media_urls": [],
            "content_post_id": ctx.content_post_id,
            "publish_mode": "manual",
        },
        headers=ctx.headers(),
    )
    if r.status_code == 400 and "connected" in r.text.lower():
        # Expected on a fresh tenant: no social account yet.
        print(f"  {YELLOW}skipped: no connected social account (expected for fresh tenant){RESET}")
        return
    r.raise_for_status()
    rows = r.json()
    assert rows, "no scheduled rows returned"
    ctx.scheduled_id = rows[0]["id"]
    print(f"  scheduled_id: {ctx.scheduled_id}  mode: {rows[0].get('publish_mode')}")


async def mark_published(client: httpx.AsyncClient, ctx: Ctx) -> None:
    if not ctx.scheduled_id:
        print(f"  {YELLOW}skipped (no scheduled post){RESET}")
        return
    r = await client.post(
        f"{ctx.base}/api/v1/social-scheduler/scheduled/{ctx.scheduled_id}/mark-published",
        json={"external_url": "https://example.com/posts/123"},
        headers=ctx.headers(),
    )
    r.raise_for_status()
    assert r.json().get("status") == "published"


async def deep_audit(client: httpx.AsyncClient, ctx: Ctx) -> None:
    r = await client.post(
        f"{ctx.base}/api/v1/seo/audit/deep",
        json={"url": ctx.audit_url, "language": "en"},
        headers=ctx.headers(),
        timeout=300,
    )
    r.raise_for_status()
    out = r.json()
    print(
        f"  score: {out.get('score')}  pages: {len(out.get('pages') or [])}  "
        f"recs: {len(out.get('recommendations') or [])}  audit_id: {out.get('audit_id')}"
    )


async def integrations_status(client: httpx.AsyncClient, ctx: Ctx) -> None:
    r = await client.get(f"{ctx.base}/api/v1/seo/integrations", headers=ctx.headers())
    r.raise_for_status()
    snap = r.json()
    print(f"  oauth_configured: {snap.get('oauth_configured')}")
    for svc in ("search_console", "analytics"):
        info = snap.get(svc) or {}
        print(f"  {svc}: connected={info.get('connected')}")


async def ai_usage_me(client: httpx.AsyncClient, ctx: Ctx) -> None:
    """Verify /ai-usage/me returns a valid usage object for the registered tenant."""
    r = await client.get(f"{ctx.base}/api/v1/ai-usage/me", headers=ctx.headers())
    r.raise_for_status()
    data = r.json()
    assert "monthly_limit_usd" in data, "missing monthly_limit_usd"
    assert "usage_usd" in data, "missing usage_usd"
    assert "remaining_usd" in data, "missing remaining_usd"
    assert "usage_pct" in data, "missing usage_pct"
    assert "has_key" in data, "missing has_key"
    assert data["monthly_limit_usd"] > 0, "monthly_limit_usd must be > 0"
    assert data["remaining_usd"] >= 0, "remaining_usd must be >= 0"
    assert 0.0 <= data["usage_pct"] <= 100.0, f"usage_pct out of range: {data['usage_pct']}"
    print(f"  limit=${data['monthly_limit_usd']:.2f}  used=${data['usage_usd']:.4f}  "
          f"remaining=${data['remaining_usd']:.2f}  pct={data['usage_pct']}%  "
          f"has_key={data['has_key']}")


async def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="http://localhost:8000")
    p.add_argument("--audit-url", default="https://example.com")
    p.add_argument("--skip-plan", action="store_true", help="Skip plan generate (slow LLM calls)")
    p.add_argument("--skip-audit", action="store_true", help="Skip deep SEO audit (slow)")
    p.add_argument("--verbose", action="store_true")
    args = p.parse_args()

    ctx = Ctx(args.base, args.audit_url)

    print(f"{BOLD}Ignify smoke test{RESET}  base={ctx.base}\n")

    async with httpx.AsyncClient(timeout=60) as client:
        await step("health", ctx, health(client, ctx))
        await step("register", ctx, register(client, ctx))
        await step("activate subscription (admin)", ctx, activate_subscription(client, ctx))
        await step("onboarding", ctx, onboarding_flow(client, ctx))
        if not args.skip_plan:
            await step("generate plan (fast)", ctx, generate_plan(client, ctx))
            if ctx.plan_id:
                await step("regenerate section (personas)", ctx, regen_section(client, ctx))
                await step("approve plan", ctx, approve_plan(client, ctx))
                await step("content-gen linked to plan", ctx, content_gen_linked(client, ctx))
                if ctx.content_post_id:
                    await step("fetch content post (scheduler prefill path)", ctx, fetch_content_post(client, ctx))
                    await step("schedule (manual)", ctx, schedule_manual(client, ctx))
                    await step("mark-published", ctx, mark_published(client, ctx))
        await step("ai-usage balance", ctx, ai_usage_me(client, ctx))
        if not args.skip_audit:
            await step("deep SEO audit", ctx, deep_audit(client, ctx))
        await step("integrations status", ctx, integrations_status(client, ctx))

    passed = sum(1 for _, ok, _ in ctx.results if ok)
    failed = len(ctx.results) - passed
    print(f"\n{BOLD}── summary ──{RESET}")
    for name, ok, info in ctx.results:
        icon = f"{GREEN}✓{RESET}" if ok else f"{RED}✗{RESET}"
        print(f"  {icon} {name:45s} {info}")
    print(f"\n{BOLD}{passed} passed, {failed} failed{RESET}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
