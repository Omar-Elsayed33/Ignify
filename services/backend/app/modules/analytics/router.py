import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.db.models import (
    AdCampaign,
    Campaign,
    Channel,
    ContentPost,
    CreditBalance,
    Lead,
    Report,
    ReportSnapshot,
    SocialPost,
)
from app.dependencies import CurrentUser, DbSession
from app.modules.analytics.schemas import (
    OverviewResponse,
    ReportCreate,
    ReportResponse,
    ReportSnapshotCreate,
    ReportSnapshotResponse,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(user: CurrentUser, db: DbSession):
    tid = user.tenant_id

    leads_count = (await db.execute(select(func.count(Lead.id)).where(Lead.tenant_id == tid))).scalar() or 0
    campaigns_count = (await db.execute(select(func.count(Campaign.id)).where(Campaign.tenant_id == tid))).scalar() or 0
    channels_count = (await db.execute(select(func.count(Channel.id)).where(Channel.tenant_id == tid))).scalar() or 0
    content_count = (await db.execute(select(func.count(ContentPost.id)).where(ContentPost.tenant_id == tid))).scalar() or 0
    social_count = (await db.execute(select(func.count(SocialPost.id)).where(SocialPost.tenant_id == tid))).scalar() or 0
    ad_count = (await db.execute(select(func.count(AdCampaign.id)).where(AdCampaign.tenant_id == tid))).scalar() or 0

    balance_result = await db.execute(select(CreditBalance).where(CreditBalance.tenant_id == tid))
    balance = balance_result.scalar_one_or_none()
    credit_balance = balance.balance if balance else 0

    return OverviewResponse(
        total_leads=leads_count,
        total_campaigns=campaigns_count,
        total_channels=channels_count,
        total_content_posts=content_count,
        total_social_posts=social_count,
        total_ad_campaigns=ad_count,
        credit_balance=credit_balance,
    )


# ── Reports ──


@router.get("/reports", response_model=list[ReportResponse])
async def list_reports(user: CurrentUser, db: DbSession, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(Report)
        .where(Report.tenant_id == user.tenant_id)
        .order_by(Report.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(data: ReportCreate, user: CurrentUser, db: DbSession):
    report = Report(
        tenant_id=user.tenant_id,
        name=data.name,
        report_type=data.report_type,
        config=data.config or {},
    )
    db.add(report)
    await db.flush()
    return report


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(report_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.tenant_id == user.tenant_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(report_id: uuid.UUID, user: CurrentUser, db: DbSession):
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.tenant_id == user.tenant_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    await db.delete(report)
    await db.flush()


# ── Snapshots ──


@router.get("/reports/{report_id}/snapshots", response_model=list[ReportSnapshotResponse])
async def list_snapshots(report_id: uuid.UUID, user: CurrentUser, db: DbSession):
    rpt_result = await db.execute(
        select(Report).where(Report.id == report_id, Report.tenant_id == user.tenant_id)
    )
    if not rpt_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    result = await db.execute(
        select(ReportSnapshot).where(ReportSnapshot.report_id == report_id).order_by(ReportSnapshot.created_at.desc())
    )
    return result.scalars().all()


@router.post("/reports/{report_id}/snapshots", response_model=ReportSnapshotResponse, status_code=status.HTTP_201_CREATED)
async def create_snapshot(report_id: uuid.UUID, data: ReportSnapshotCreate, user: CurrentUser, db: DbSession):
    rpt_result = await db.execute(
        select(Report).where(Report.id == report_id, Report.tenant_id == user.tenant_id)
    )
    if not rpt_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    snapshot = ReportSnapshot(
        report_id=report_id,
        data=data.data or {},
        period_start=data.period_start,
        period_end=data.period_end,
    )
    db.add(snapshot)
    await db.flush()
    return snapshot
