"""PDF generation utilities for Plans and Weekly Reports.

Uses WeasyPrint to render HTML+CSS to PDF. Templates are kept as inline
Python f-strings for simplicity; AR content is rendered RTL via CSS
`direction: rtl` and `font-family: "Noto Sans Arabic", "DejaVu Sans"`.
"""
from __future__ import annotations

import html as _html
import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _esc(value: Any) -> str:
    if value is None:
        return ""
    return _html.escape(str(value))


def _t(ar: str, en: str, lang: str) -> str:
    return ar if lang == "ar" else en


_BASE_CSS = """
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body {
  font-family: "Noto Sans Arabic", "DejaVu Sans", "Helvetica", sans-serif;
  color: #1f2937;
  font-size: 11pt;
  line-height: 1.5;
}
body.rtl { direction: rtl; }
h1 { font-size: 24pt; color: #FF6B00; margin: 0 0 8pt 0; }
h2 { font-size: 16pt; color: #111827; margin: 18pt 0 8pt 0;
     border-bottom: 1px solid #e5e7eb; padding-bottom: 4pt; }
h3 { font-size: 12pt; color: #374151; margin: 10pt 0 4pt 0; }
p  { margin: 4pt 0; }
.cover {
  page-break-after: always;
  padding: 40pt 0;
  text-align: center;
  border-bottom: 2px solid #FF6B00;
}
.cover .brand { font-size: 14pt; letter-spacing: 2pt; color: #FF6B00; }
.cover .meta  { margin-top: 30pt; color: #6b7280; font-size: 10pt; }
.section { page-break-inside: avoid; margin-top: 8pt; }
.card {
  border: 1px solid #e5e7eb; border-radius: 6pt;
  padding: 10pt; margin: 6pt 0; background: #fafafa;
}
.grid-3 { display: flex; flex-wrap: wrap; gap: 8pt; }
.grid-3 > .card { width: calc(33.3% - 8pt); }
table { width: 100%; border-collapse: collapse; margin: 6pt 0; font-size: 10pt; }
th, td { border: 1px solid #e5e7eb; padding: 5pt 7pt; text-align: start; vertical-align: top; }
th { background: #f3f4f6; font-weight: 600; color: #374151; }
ul { margin: 4pt 0; padding-inline-start: 18pt; }
.kpi-row { display: flex; gap: 8pt; margin: 6pt 0; }
.kpi-box {
  flex: 1; border: 1px solid #e5e7eb; border-radius: 6pt;
  padding: 8pt; text-align: center;
}
.kpi-box .v { font-size: 18pt; font-weight: 700; color: #FF6B00; }
.kpi-box .l { font-size: 9pt; color: #6b7280; text-transform: uppercase; }
.muted { color: #6b7280; font-size: 9pt; }
"""


def generate_html(template_name: str, context: dict, lang: str = "en") -> str:
    """Render one of the named templates. Kept intentionally simple."""
    if template_name == "plan":
        return _render_plan_html(context, lang)
    if template_name == "weekly_report":
        return _render_weekly_report_html(context, lang)
    raise ValueError(f"Unknown template: {template_name}")


def html_to_pdf(html: str) -> bytes:
    """Convert HTML string to PDF bytes using WeasyPrint."""
    # Import lazily so openapi schema / unit tests don't require native libs.
    from weasyprint import HTML  # type: ignore

    return HTML(string=html).write_pdf()


# ── Plan PDF ─────────────────────────────────────────────────────────────────

def _render_list(items: Any) -> str:
    if not items:
        return '<p class="muted">—</p>'
    if isinstance(items, str):
        return f"<p>{_esc(items)}</p>"
    if isinstance(items, dict):
        return _render_kv(items)
    if isinstance(items, list):
        if all(isinstance(i, (str, int, float)) for i in items):
            return "<ul>" + "".join(f"<li>{_esc(i)}</li>" for i in items) + "</ul>"
        return "".join(f'<div class="card">{_render_list(i)}</div>' for i in items)
    return f"<p>{_esc(items)}</p>"


def _render_kv(obj: dict) -> str:
    rows = []
    for k, v in obj.items():
        label = _esc(k.replace("_", " ").title())
        rows.append(f"<h3>{label}</h3>{_render_list(v)}")
    return "".join(rows)


def _render_plan_html(ctx: dict, lang: str) -> str:
    rtl = "rtl" if lang == "ar" else ""
    plan = ctx.get("plan", {})
    tenant = ctx.get("tenant_name") or ""
    title = plan.get("title") or _t("خطة تسويقية", "Marketing Plan", lang)
    period = plan.get("period_days") or "—"
    created = plan.get("created_at")
    created_s = ""
    if isinstance(created, datetime):
        created_s = created.strftime("%Y-%m-%d")
    elif created:
        created_s = str(created)[:10]

    # Personas (up to 3 cards)
    personas = plan.get("personas") or []
    persona_cards = ""
    if isinstance(personas, list):
        for p in personas[:3]:
            if not isinstance(p, dict):
                continue
            persona_cards += (
                '<div class="card">'
                f"<h3>{_esc(p.get('name') or _t('شخصية','Persona',lang))}</h3>"
                f"{_render_list({k:v for k,v in p.items() if k != 'name'})}"
                "</div>"
            )
    if not persona_cards:
        persona_cards = '<p class="muted">—</p>'

    # Channels table
    channels = plan.get("channels") or []
    ch_rows = ""
    if isinstance(channels, list):
        for c in channels:
            if isinstance(c, dict):
                ch_rows += (
                    "<tr>"
                    f"<td>{_esc(c.get('name') or c.get('channel') or '—')}</td>"
                    f"<td>{_esc(c.get('priority') or c.get('weight') or '—')}</td>"
                    f"<td>{_esc(c.get('cadence') or c.get('frequency') or '—')}</td>"
                    f"<td>{_esc(c.get('notes') or c.get('description') or '—')}</td>"
                    "</tr>"
                )
            else:
                ch_rows += f"<tr><td colspan='4'>{_esc(c)}</td></tr>"
    if not ch_rows:
        ch_rows = f"<tr><td colspan='4' class='muted'>—</td></tr>"

    # Calendar table (first 30 rows)
    calendar = plan.get("calendar") or []
    cal_rows = ""
    if isinstance(calendar, list):
        for entry in calendar[:30]:
            if isinstance(entry, dict):
                cal_rows += (
                    "<tr>"
                    f"<td>{_esc(entry.get('day') or entry.get('date') or '—')}</td>"
                    f"<td>{_esc(entry.get('channel') or '—')}</td>"
                    f"<td>{_esc(entry.get('format') or '—')}</td>"
                    f"<td>{_esc(entry.get('topic') or entry.get('title') or '—')}</td>"
                    "</tr>"
                )
    if not cal_rows:
        cal_rows = f"<tr><td colspan='4' class='muted'>—</td></tr>"

    # KPIs table
    kpis = plan.get("kpis") or []
    kpi_rows = ""
    if isinstance(kpis, list):
        for k in kpis:
            if isinstance(k, dict):
                kpi_rows += (
                    "<tr>"
                    f"<td>{_esc(k.get('name') or k.get('metric') or '—')}</td>"
                    f"<td>{_esc(k.get('target') or k.get('value') or '—')}</td>"
                    f"<td>{_esc(k.get('unit') or '—')}</td>"
                    f"<td>{_esc(k.get('notes') or k.get('description') or '—')}</td>"
                    "</tr>"
                )
    if not kpi_rows:
        kpi_rows = f"<tr><td colspan='4' class='muted'>—</td></tr>"

    market = plan.get("market_analysis") or {}

    labels = {
        "cover_sub": _t("خطة تسويقية شاملة", "Comprehensive marketing plan", lang),
        "tenant": _t("المنشأة", "Tenant", lang),
        "date": _t("التاريخ", "Date", lang),
        "period": _t("الفترة (أيام)", "Period (days)", lang),
        "market": _t("تحليل السوق", "Market Analysis", lang),
        "personas": _t("الجمهور المستهدف", "Target Personas", lang),
        "channels": _t("القنوات", "Channels", lang),
        "calendar": _t("التقويم", "Content Calendar", lang),
        "kpis": _t("مؤشرات الأداء", "Key Performance Indicators", lang),
        "ch_name": _t("القناة", "Channel", lang),
        "ch_priority": _t("الأولوية", "Priority", lang),
        "ch_cadence": _t("التكرار", "Cadence", lang),
        "ch_notes": _t("ملاحظات", "Notes", lang),
        "cal_day": _t("اليوم", "Day", lang),
        "cal_format": _t("الصيغة", "Format", lang),
        "cal_topic": _t("الموضوع", "Topic", lang),
        "kpi_name": _t("المؤشر", "Metric", lang),
        "kpi_target": _t("الهدف", "Target", lang),
        "kpi_unit": _t("الوحدة", "Unit", lang),
        "kpi_notes": _t("ملاحظات", "Notes", lang),
    }

    return f"""<!DOCTYPE html>
<html lang="{lang}" dir="{'rtl' if lang == 'ar' else 'ltr'}">
<head><meta charset="utf-8"><title>{_esc(title)}</title>
<style>{_BASE_CSS}</style></head>
<body class="{rtl}">
  <div class="cover">
    <div class="brand">IGNIFY</div>
    <h1>{_esc(title)}</h1>
    <p>{labels['cover_sub']}</p>
    <div class="meta">
      <div>{labels['tenant']}: {_esc(tenant)}</div>
      <div>{labels['date']}: {_esc(created_s)}</div>
      <div>{labels['period']}: {_esc(period)}</div>
    </div>
  </div>

  <div class="section"><h2>{labels['market']}</h2>{_render_list(market)}</div>
  <div class="section"><h2>{labels['personas']}</h2><div class="grid-3">{persona_cards}</div></div>

  <div class="section"><h2>{labels['channels']}</h2>
    <table><thead><tr>
      <th>{labels['ch_name']}</th><th>{labels['ch_priority']}</th>
      <th>{labels['ch_cadence']}</th><th>{labels['ch_notes']}</th>
    </tr></thead><tbody>{ch_rows}</tbody></table>
  </div>

  <div class="section"><h2>{labels['calendar']}</h2>
    <table><thead><tr>
      <th>{labels['cal_day']}</th><th>{labels['ch_name']}</th>
      <th>{labels['cal_format']}</th><th>{labels['cal_topic']}</th>
    </tr></thead><tbody>{cal_rows}</tbody></table>
  </div>

  <div class="section"><h2>{labels['kpis']}</h2>
    <table><thead><tr>
      <th>{labels['kpi_name']}</th><th>{labels['kpi_target']}</th>
      <th>{labels['kpi_unit']}</th><th>{labels['kpi_notes']}</th>
    </tr></thead><tbody>{kpi_rows}</tbody></table>
  </div>
</body></html>
"""


def build_plan_pdf(plan_row: Any, lang: str = "en", tenant_name: str | None = None) -> bytes:
    """Produce a full marketing plan PDF from a MarketingPlan ORM row or dict."""
    if hasattr(plan_row, "__table__"):  # ORM row
        plan = {
            "title": plan_row.title,
            "period_days": getattr(plan_row, "period_days", None),
            "created_at": getattr(plan_row, "created_at", None),
            "goals": getattr(plan_row, "goals", None),
            "personas": getattr(plan_row, "personas", None),
            "channels": getattr(plan_row, "channels", None),
            "calendar": getattr(plan_row, "calendar", None),
            "kpis": getattr(plan_row, "kpis", None),
            "market_analysis": getattr(plan_row, "market_analysis", None),
        }
    else:
        plan = dict(plan_row)
    html = generate_html("plan", {"plan": plan, "tenant_name": tenant_name or ""}, lang)
    return html_to_pdf(html)


# ── Weekly Report PDF ────────────────────────────────────────────────────────

def _render_weekly_report_html(ctx: dict, lang: str) -> str:
    rtl = "rtl" if lang == "ar" else ""
    tenant = ctx.get("tenant_name") or ""
    metrics = ctx.get("metrics") or {}
    insights = ctx.get("insights") or []
    recommendations = ctx.get("recommendations") or []

    kpis = metrics.get("kpis") or []
    kpi_boxes = ""
    if isinstance(kpis, list):
        for k in kpis:
            if not isinstance(k, dict):
                continue
            label = k.get("label_ar" if lang == "ar" else "label_en") or k.get("key") or ""
            val = k.get("value", "—")
            try:
                val = f"{float(val):,.0f}"
            except (TypeError, ValueError):
                val = str(val)
            kpi_boxes += (
                f'<div class="kpi-box"><div class="v">{_esc(val)}</div>'
                f'<div class="l">{_esc(label)}</div></div>'
            )
    if not kpi_boxes:
        kpi_boxes = f'<p class="muted">—</p>'

    # Reach / engagement trend as tables
    reach = metrics.get("reach_trend") or []
    eng = metrics.get("engagement_trend") or []

    def _trend_rows(points: list) -> str:
        rows = ""
        if isinstance(points, list):
            for p in points[:14]:
                if isinstance(p, dict):
                    rows += f"<tr><td>{_esc(p.get('date'))}</td><td>{_esc(p.get('value'))}</td></tr>"
        return rows or f"<tr><td colspan='2' class='muted'>—</td></tr>"

    top_posts = metrics.get("top_posts") or []
    tp_rows = ""
    if isinstance(top_posts, list):
        for p in top_posts[:10]:
            if isinstance(p, dict):
                tp_rows += (
                    "<tr>"
                    f"<td>{_esc(p.get('platform'))}</td>"
                    f"<td>{_esc(p.get('caption'))[:80]}</td>"
                    f"<td>{_esc(p.get('reach'))}</td>"
                    f"<td>{_esc(p.get('engagement'))}</td>"
                    "</tr>"
                )
    if not tp_rows:
        tp_rows = f"<tr><td colspan='4' class='muted'>—</td></tr>"

    insights_html = (
        "<ul>" + "".join(f"<li>{_esc(i)}</li>" for i in insights) + "</ul>"
        if insights else f'<p class="muted">—</p>'
    )
    recs_html = (
        "<ul>" + "".join(f"<li>{_esc(r)}</li>" for r in recommendations) + "</ul>"
        if recommendations else f'<p class="muted">—</p>'
    )

    labels = {
        "title": _t("التقرير الأسبوعي", "Weekly Report", lang),
        "sub": _t("ملخص الأداء والتوصيات", "Performance summary & recommendations", lang),
        "tenant": _t("المنشأة", "Tenant", lang),
        "date": _t("تاريخ التوليد", "Generated on", lang),
        "kpis": _t("المؤشرات الرئيسية", "Key Metrics", lang),
        "reach": _t("الوصول بمرور الوقت", "Reach over time", lang),
        "eng": _t("التفاعل بمرور الوقت", "Engagement over time", lang),
        "top": _t("أفضل المنشورات", "Top Posts", lang),
        "insights": _t("الرؤى", "Insights", lang),
        "recs": _t("التوصيات", "Recommendations", lang),
        "col_date": _t("التاريخ", "Date", lang),
        "col_val": _t("القيمة", "Value", lang),
        "col_platform": _t("المنصة", "Platform", lang),
        "col_caption": _t("النص", "Caption", lang),
        "col_reach": _t("الوصول", "Reach", lang),
        "col_eng": _t("التفاعل", "Engagement", lang),
    }
    today = datetime.utcnow().strftime("%Y-%m-%d")

    return f"""<!DOCTYPE html>
<html lang="{lang}" dir="{'rtl' if lang == 'ar' else 'ltr'}">
<head><meta charset="utf-8"><title>{labels['title']}</title>
<style>{_BASE_CSS}</style></head>
<body class="{rtl}">
  <div class="cover">
    <div class="brand">IGNIFY</div>
    <h1>{labels['title']}</h1>
    <p>{labels['sub']}</p>
    <div class="meta">
      <div>{labels['tenant']}: {_esc(tenant)}</div>
      <div>{labels['date']}: {today}</div>
    </div>
  </div>

  <div class="section"><h2>{labels['kpis']}</h2>
    <div class="kpi-row">{kpi_boxes}</div>
  </div>

  <div class="section"><h2>{labels['reach']}</h2>
    <table><thead><tr><th>{labels['col_date']}</th><th>{labels['col_val']}</th></tr></thead>
    <tbody>{_trend_rows(reach)}</tbody></table>
  </div>

  <div class="section"><h2>{labels['eng']}</h2>
    <table><thead><tr><th>{labels['col_date']}</th><th>{labels['col_val']}</th></tr></thead>
    <tbody>{_trend_rows(eng)}</tbody></table>
  </div>

  <div class="section"><h2>{labels['top']}</h2>
    <table><thead><tr>
      <th>{labels['col_platform']}</th><th>{labels['col_caption']}</th>
      <th>{labels['col_reach']}</th><th>{labels['col_eng']}</th>
    </tr></thead><tbody>{tp_rows}</tbody></table>
  </div>

  <div class="section"><h2>{labels['insights']}</h2>{insights_html}</div>
  <div class="section"><h2>{labels['recs']}</h2>{recs_html}</div>
</body></html>
"""


def build_weekly_report_pdf(
    tenant: Any, metrics: dict, insights: list[str], recommendations: list[str] | None = None,
    lang: str = "en",
) -> bytes:
    tenant_name = getattr(tenant, "name", None) if tenant else None
    html = generate_html(
        "weekly_report",
        {
            "tenant_name": tenant_name or "",
            "metrics": metrics,
            "insights": insights or [],
            "recommendations": recommendations or [],
        },
        lang,
    )
    return html_to_pdf(html)
