"""Service helpers for the Meta Ads orchestrator endpoints."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import meta_ads
from app.db.models import AdAccount, AdCampaign, AdPerformance, AdPlatform, SocialAccount


async def sync_meta_ad_accounts(db: AsyncSession, tenant_id: uuid.UUID) -> list[AdAccount]:
    """Pull ad accounts from Meta using the tenant's first connected social token,
    then upsert AdAccount rows. Falls back to stub data when creds are missing.
    """
    # Pick any Meta-linked social account for a token
    token = ""
    result = await db.execute(
        select(SocialAccount).where(
            and_(
                SocialAccount.tenant_id == tenant_id,
                SocialAccount.is_active == True,  # noqa: E712
            )
        )
    )
    for acct in result.scalars().all():
        plat = acct.platform.value if hasattr(acct.platform, "value") else str(acct.platform)
        if plat in ("facebook", "instagram") and acct.access_token_encrypted:
            token = acct.access_token_encrypted
            break

    accounts = await meta_ads.list_ad_accounts(token)

    stored: list[AdAccount] = []
    for a in accounts:
        external_id = a.get("id") or a.get("account_id") or ""
        if not external_id:
            continue
        existing_q = await db.execute(
            select(AdAccount).where(
                and_(
                    AdAccount.tenant_id == tenant_id,
                    AdAccount.platform == AdPlatform.meta,
                    AdAccount.account_id == external_id,
                )
            )
        )
        row = existing_q.scalar_one_or_none()
        if row:
            row.name = a.get("name") or row.name
            row.access_token_encrypted = token or row.access_token_encrypted
            row.is_active = True
        else:
            row = AdAccount(
                tenant_id=tenant_id,
                platform=AdPlatform.meta,
                account_id=external_id,
                name=a.get("name") or external_id,
                access_token_encrypted=token,
                is_active=True,
            )
            db.add(row)
        stored.append(row)
    await db.flush()
    return stored


async def launch_campaign_on_meta(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    account_row: AdAccount,
    page_id: str,
    campaign: dict[str, Any],
    adset: dict[str, Any],
    creative: dict[str, Any],
    targeting_spec: dict[str, Any],
    duration_days: int,
) -> dict[str, Any]:
    """Create campaign → adset → creative → ad on Meta and persist AdCampaign row."""
    token = account_row.access_token_encrypted or ""
    external_acct_id = account_row.account_id  # "act_<id>"

    # 1. Campaign
    camp_resp = await meta_ads.create_campaign(
        external_acct_id,
        token,
        name=campaign.get("name") or "Campaign",
        objective=campaign.get("objective") or "OUTCOME_TRAFFIC",
        daily_budget_cents=int(campaign.get("daily_budget_cents") or 500),
    )
    ext_campaign_id = str(camp_resp.get("id") or "")

    # 2. Ad Set
    start = datetime.now(timezone.utc)
    end = start + timedelta(days=max(duration_days, 1))
    adset_resp = await meta_ads.create_adset(
        external_acct_id,
        token,
        campaign_id=ext_campaign_id,
        name=adset.get("name") or f"{campaign.get('name')} AdSet",
        targeting=targeting_spec,
        daily_budget_cents=int(adset.get("daily_budget_cents") or campaign.get("daily_budget_cents") or 500),
        billing_event=adset.get("billing_event") or "IMPRESSIONS",
        optimization_goal=adset.get("optimization_goal") or "LINK_CLICKS",
        start_time=start.isoformat(),
        end_time=end.isoformat(),
    )
    ext_adset_id = str(adset_resp.get("id") or "")

    # 3. Creative (upload image first if provided)
    image_hash = None
    img_url = creative.get("image_url")
    if img_url:
        try:
            image_hash = await meta_ads.upload_image(external_acct_id, token, img_url)
        except Exception:  # noqa: BLE001
            image_hash = None

    creative_resp = await meta_ads.create_ad_creative(
        external_acct_id,
        token,
        name=f"{campaign.get('name')} Creative",
        page_id=page_id,
        link=creative.get("link") or "https://example.com",
        message=creative.get("message") or "",
        image_hash=image_hash,
    )
    ext_creative_id = str(creative_resp.get("id") or "")

    # 4. Ad
    ad_resp = await meta_ads.create_ad(
        external_acct_id,
        token,
        name=f"{campaign.get('name')} Ad",
        adset_id=ext_adset_id,
        creative_id=ext_creative_id,
    )
    ext_ad_id = str(ad_resp.get("id") or "")

    # 5. Persist AdCampaign row
    daily = float(campaign.get("daily_budget_usd") or 0)
    row = AdCampaign(
        tenant_id=tenant_id,
        ad_account_id=account_row.id,
        platform=AdPlatform.meta,
        campaign_id_external=ext_campaign_id,
        name=campaign.get("name") or "Campaign",
        status="paused",
        budget_daily=daily or None,
        budget_total=(daily * duration_days) if daily else None,
        start_date=start.date(),
        end_date=end.date(),
        config={
            "objective": campaign.get("objective"),
            "external_adset_id": ext_adset_id,
            "external_creative_id": ext_creative_id,
            "external_ad_id": ext_ad_id,
            "targeting": targeting_spec,
            "creative": creative,
            "page_id": page_id,
        },
    )
    db.add(row)
    await db.flush()

    stub = ext_campaign_id.startswith("stub_")
    return {
        "campaign_row_id": row.id,
        "external_campaign_id": ext_campaign_id,
        "external_adset_id": ext_adset_id,
        "external_creative_id": ext_creative_id,
        "external_ad_id": ext_ad_id,
        "stub": stub,
    }


def _get_token_for_campaign(account_row: AdAccount) -> str:
    return account_row.access_token_encrypted or ""


async def update_campaign_status_on_meta(
    db: AsyncSession, *, tenant_id: uuid.UUID, campaign_id: uuid.UUID, status: str
) -> AdCampaign | None:
    """status: ACTIVE | PAUSED | ARCHIVED (Meta) — we also update local status."""
    result = await db.execute(
        select(AdCampaign).where(
            AdCampaign.id == campaign_id, AdCampaign.tenant_id == tenant_id
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        return None
    acc_q = await db.execute(select(AdAccount).where(AdAccount.id == campaign.ad_account_id))
    account = acc_q.scalar_one_or_none()
    token = _get_token_for_campaign(account) if account else ""
    if campaign.campaign_id_external:
        try:
            await meta_ads.update_campaign_status(campaign.campaign_id_external, token, status)
        except Exception:  # noqa: BLE001
            pass
    local_map = {"ACTIVE": "active", "PAUSED": "paused", "ARCHIVED": "completed"}
    campaign.status = local_map.get(status, status.lower())
    await db.flush()
    return campaign


async def fetch_and_cache_insights(
    db: AsyncSession, *, tenant_id: uuid.UUID, campaign_id: uuid.UUID
) -> dict[str, Any] | None:
    result = await db.execute(
        select(AdCampaign).where(
            AdCampaign.id == campaign_id, AdCampaign.tenant_id == tenant_id
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign or not campaign.campaign_id_external:
        return None
    acc_q = await db.execute(select(AdAccount).where(AdAccount.id == campaign.ad_account_id))
    account = acc_q.scalar_one_or_none()
    token = _get_token_for_campaign(account) if account else ""

    raw = await meta_ads.get_campaign_insights(campaign.campaign_id_external, token)
    items = raw.get("data") or []
    if not items:
        return {"campaign_id": campaign_id, "impressions": 0, "clicks": 0, "spend": 0.0}
    row = items[0]

    def _f(v, default=0.0):
        try:
            return float(v)
        except (TypeError, ValueError):
            return default

    def _i(v, default=0):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return default

    impressions = _i(row.get("impressions"))
    clicks = _i(row.get("clicks"))
    spend = _f(row.get("spend"))
    ctr = _f(row.get("ctr"), default=None) if row.get("ctr") is not None else None
    cpc = _f(row.get("cpc"), default=None) if row.get("cpc") is not None else None
    reach = _i(row.get("reach")) if row.get("reach") is not None else None

    # Upsert today's AdPerformance row
    today = date.today()
    perf_q = await db.execute(
        select(AdPerformance).where(
            AdPerformance.ad_campaign_id == campaign.id, AdPerformance.date == today
        )
    )
    perf = perf_q.scalar_one_or_none()
    if perf:
        perf.impressions = impressions
        perf.clicks = clicks
        perf.spend = spend
        perf.ctr = ctr
        perf.cpc = cpc
    else:
        perf = AdPerformance(
            ad_campaign_id=campaign.id,
            date=today,
            impressions=impressions,
            clicks=clicks,
            spend=spend,
            ctr=ctr,
            cpc=cpc,
        )
        db.add(perf)
    await db.flush()

    return {
        "campaign_id": campaign_id,
        "impressions": impressions,
        "clicks": clicks,
        "spend": spend,
        "ctr": ctr,
        "cpc": cpc,
        "reach": reach,
    }
