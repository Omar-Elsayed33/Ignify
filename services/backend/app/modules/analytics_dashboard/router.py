"""Analytics Dashboard router: KPIs, trends, weekly reports, AI-generated reports."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select

from app.core.pdf import build_weekly_report_pdf
from app.db.models import Tenant
from app.dependencies import CurrentUser, CurrentUserFlex, DbSession
from app.modules.analytics_dashboard.schemas import (
    AgentReportResponse,
    DashboardResponse,
    KPITrendResponse,
    WeeklyReportResponse,
    period_to_days,
)
from app.modules.analytics_dashboard.service import (
    build_dashboard,
    build_kpi_trend,
    build_weekly_report,
    dashboard_to_metrics_dict,
)

router = APIRouter(prefix="/analytics-dashboard", tags=["analytics"])


@router.get("/overview", response_model=DashboardResponse)
async def get_overview(
    user: CurrentUser,
    db: DbSession,
    period: str = Query("7d", pattern="^(7d|30d|90d)$"),
):
    return await build_dashboard(db, user.tenant_id, period_to_days(period))


@router.get("/kpis/{key}", response_model=KPITrendResponse)
async def get_kpi_trend(
    key: str,
    user: CurrentUser,
    db: DbSession,
    period: str = Query("7d", pattern="^(7d|30d|90d)$"),
):
    if key not in {"reach", "engagement", "impressions"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown KPI key: {key}"
        )
    return await build_kpi_trend(db, user.tenant_id, key, period_to_days(period))


@router.get("/report/weekly", response_model=WeeklyReportResponse)
async def get_weekly_report(user: CurrentUser, db: DbSession):
    return await build_weekly_report(db, user.tenant_id)


@router.get("/report/weekly.pdf")
async def get_weekly_report_pdf(
    user: CurrentUserFlex,
    db: DbSession,
    lang: str = Query("en", pattern="^(ar|en)$"),
):
    """Download the weekly report as a PDF (EN/AR).

    Also runs the analytics agent to enrich the PDF with insights &
    recommendations. On agent failure we still return the KPI-only PDF.
    """
    dashboard = await build_dashboard(db, user.tenant_id, 7)
    metrics = dashboard_to_metrics_dict(dashboard)

    insights: list[str] = []
    recommendations: list[str] = []
    try:
        from app.agents.registry import get_agent

        agent = get_agent("analytics", tenant_id=str(user.tenant_id))
        result = await agent.run(
            {
                "tenant_id": str(user.tenant_id),
                "period_days": 7,
                "metrics": metrics,
                "trends": {
                    "reach": metrics["reach_trend"],
                    "engagement": metrics["engagement_trend"],
                },
                "top_posts": metrics["top_posts"],
                "language": lang,
            },
            thread_id=f"weekly-pdf-{user.tenant_id}",
        )
        insights = list(result.get("insights") or [])
        recommendations = list(result.get("recommendations") or [])
    except Exception:
        pass

    t_res = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = t_res.scalar_one_or_none()

    try:
        pdf_bytes = build_weekly_report_pdf(
            tenant, metrics, insights, recommendations, lang=lang
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    filename = f"weekly-report-{lang}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class ReportGenerateRequest(BaseModel):
    period: str = "7d"
    language: str = "en"


@router.post("/report/generate", response_model=AgentReportResponse)
async def generate_report(
    data: ReportGenerateRequest,
    user: CurrentUser,
    db: DbSession,
):
    from app.agents.registry import get_agent

    dashboard = await build_dashboard(db, user.tenant_id, period_to_days(data.period))
    metrics = dashboard_to_metrics_dict(dashboard)

    agent = get_agent("analytics", tenant_id=str(user.tenant_id))
    result = await agent.run(
        {
            "tenant_id": str(user.tenant_id),
            "period_days": period_to_days(data.period),
            "metrics": metrics,
            "trends": {
                "reach": metrics["reach_trend"],
                "engagement": metrics["engagement_trend"],
            },
            "top_posts": metrics["top_posts"],
            "language": data.language,
        },
        thread_id=f"analytics-report-{user.tenant_id}",
    )

    return AgentReportResponse(
        summary=result.get("summary") or "",
        insights=result.get("insights") or [],
        recommendations=result.get("recommendations") or [],
    )
