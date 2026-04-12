"""PDF generation for Plans and Weekly Reports.

Uses WeasyPrint to render HTML+CSS to PDF. Plan PDFs are built from a
Jinja2 template with embedded SVG charts (from ``app.core.pdf_charts``)
for a rich, multi-page, design-forward deliverable.
"""
from __future__ import annotations

import html as _html
import logging
from datetime import datetime
from typing import Any

from jinja2 import Environment, BaseLoader, select_autoescape

from app.core.pdf_charts import (
    bar_chart,
    donut_chart,
    funnel_chart,
    line_chart_growth,
)

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _esc(value: Any) -> str:
    if value is None:
        return ""
    return _html.escape(str(value))


def _t(ar: str, en: str, lang: str) -> str:
    return ar if lang == "ar" else en


# ── Weekly report (legacy) base CSS, retained for that template ──────────────

_WEEKLY_CSS = """
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body {
  font-family: "Noto Sans Arabic", "DejaVu Sans", "Helvetica", sans-serif;
  color: #1f2937; font-size: 11pt; line-height: 1.5;
}
body.rtl { direction: rtl; }
h1 { font-size: 24pt; color: #FF6B00; margin: 0 0 8pt 0; }
h2 { font-size: 16pt; color: #111827; margin: 18pt 0 8pt 0;
     border-bottom: 1px solid #e5e7eb; padding-bottom: 4pt; }
h3 { font-size: 12pt; color: #374151; margin: 10pt 0 4pt 0; }
.cover { page-break-after: always; padding: 40pt 0; text-align: center;
         border-bottom: 2px solid #FF6B00; }
.cover .brand { font-size: 14pt; letter-spacing: 2pt; color: #FF6B00; }
.cover .meta  { margin-top: 30pt; color: #6b7280; font-size: 10pt; }
.section { page-break-inside: avoid; margin-top: 8pt; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0; font-size: 10pt; }
th, td { border: 1px solid #e5e7eb; padding: 5pt 7pt; text-align: start; vertical-align: top; }
th { background: #f3f4f6; font-weight: 600; color: #374151; }
ul { margin: 4pt 0; padding-inline-start: 18pt; }
.kpi-row { display: flex; gap: 8pt; margin: 6pt 0; }
.kpi-box { flex: 1; border: 1px solid #e5e7eb; border-radius: 6pt; padding: 8pt; text-align: center; }
.kpi-box .v { font-size: 18pt; font-weight: 700; color: #FF6B00; }
.kpi-box .l { font-size: 9pt; color: #6b7280; text-transform: uppercase; }
.muted { color: #6b7280; font-size: 9pt; }
"""


def generate_html(template_name: str, context: dict, lang: str = "en") -> str:
    if template_name == "plan":
        return _render_plan_html(context, lang)
    if template_name == "weekly_report":
        return _render_weekly_report_html(context, lang)
    raise ValueError(f"Unknown template: {template_name}")


def html_to_pdf(html: str) -> bytes:
    from weasyprint import HTML  # type: ignore
    return HTML(string=html).write_pdf()


# ── Plan PDF (Jinja2 + charts) ───────────────────────────────────────────────

_PLAN_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&family=Reem+Kufi:wght@500;700&family=Manrope:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');

@page {
  size: A4;
  margin: 22mm 18mm 22mm 18mm;
  @bottom-center {
    content: "Page " counter(page) " of " counter(pages);
    font-size: 9pt;
    color: #594139;
    font-family: Manrope, Arial, sans-serif;
  }
}
@page :first { margin: 0; @bottom-center { content: ""; } }

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Manrope', 'Tajawal', 'DejaVu Sans', sans-serif;
  color: #1b1b24;
  font-size: 10.5pt;
  line-height: 1.55;
}
body.rtl { direction: rtl; font-family: 'Tajawal', 'Manrope', sans-serif; }

h1, h2, h3, h4 {
  font-family: 'Space Grotesk', 'Reem Kufi', 'Tajawal', sans-serif;
  color: #1b1b24;
  margin: 0 0 8pt 0;
}
body.rtl h1, body.rtl h2, body.rtl h3, body.rtl h4 {
  font-family: 'Reem Kufi', 'Tajawal', sans-serif;
}
h1 { font-size: 26pt; letter-spacing: -0.5pt; }
h2 { font-size: 17pt; color: #ab3500; border-bottom: 2px solid #f3dcd2;
     padding-bottom: 4pt; margin: 22pt 0 10pt 0; }
h3 { font-size: 12.5pt; color: #680eac; margin-top: 10pt; }
p { margin: 4pt 0; }

.cover {
  page-break-after: always;
  background: linear-gradient(135deg, #FF6B35 0%, #FF3D71 50%, #7B2CBF 100%);
  color: white;
  padding: 70mm 20mm 40mm 20mm;
  min-height: 297mm;
}
.cover .brand {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14pt; letter-spacing: 6pt; text-transform: uppercase;
  opacity: 0.9;
}
.cover h1 { color: white; font-size: 42pt; margin: 20pt 0 6pt 0; }
.cover .sub { opacity: 0.92; font-size: 13pt; }
.cover .meta {
  margin-top: 40pt; font-size: 10.5pt; opacity: 0.95; line-height: 1.9;
}
.cover .badge {
  display: inline-block; background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.35);
  padding: 4pt 12pt; border-radius: 999pt; font-size: 9.5pt;
  letter-spacing: 1pt; text-transform: uppercase; margin-top: 14pt;
}
.cover .tag-gen {
  margin-top: 28pt; font-size: 9.5pt; opacity: 0.75;
}

.section { page-break-inside: avoid; margin-bottom: 12mm; }
.section + .section { }
.card {
  border: 1px solid #ecdccf;
  border-radius: 10pt;
  padding: 12pt 14pt;
  margin: 6pt 0;
  background: #fffaf5;
  page-break-inside: avoid;
}
.grid-3 { display: flex; flex-wrap: wrap; gap: 8pt; }
.grid-3 > .card { width: calc(33.3% - 8pt); }
.grid-2 { display: flex; flex-wrap: wrap; gap: 10pt; }
.grid-2 > .card { width: calc(50% - 10pt); }

table { width: 100%; border-collapse: collapse; margin: 6pt 0; font-size: 9.5pt; }
th, td { border: 1px solid #ecdccf; padding: 6pt 8pt; text-align: start; vertical-align: top; }
th { background: #fff1e6; font-weight: 600; color: #ab3500; }
ul { margin: 4pt 0; padding-inline-start: 18pt; }

.chip {
  display: inline-block;
  background: #f1dbff; color: #680eac;
  padding: 3pt 10pt; border-radius: 999pt;
  font-size: 9pt; font-weight: 600; margin: 2pt 2pt 2pt 0;
}
.chip.orange { background: #ffe1d1; color: #ab3500; }
.chip.ok { background: #d6f5e1; color: #106f33; }

.swot { display: flex; flex-wrap: wrap; gap: 8pt; }
.swot > div { width: calc(50% - 8pt); border-radius: 10pt; padding: 10pt; }
.swot .s { background: #d6f5e1; }
.swot .w { background: #ffe2e2; }
.swot .o { background: #e1ecff; }
.swot .t { background: #fff0cf; }
.swot h4 { margin: 0 0 4pt 0; font-size: 11pt; }

.kpi-row { display: flex; gap: 8pt; margin: 6pt 0; }
.kpi-box { flex: 1; border: 1px solid #ecdccf; border-radius: 10pt;
           padding: 10pt; text-align: center; background: #fffaf5; }
.kpi-box .v { font-size: 20pt; font-weight: 700; color: #ab3500; font-family: 'Space Grotesk', sans-serif; }
.kpi-box .l { font-size: 9pt; color: #594139; text-transform: uppercase; letter-spacing: 1pt; }

.muted { color: #9a7b6a; font-size: 9pt; }
.center { text-align: center; }
.chart-wrap { text-align: center; margin: 8pt 0; }

.budget-tier {
  border: 1px solid #ecdccf; border-radius: 10pt; padding: 12pt;
  background: #fffaf5; margin-bottom: 8pt;
}
.budget-tier h3 { margin: 0; color: #ab3500; }
.budget-tier .usd { font-size: 22pt; font-weight: 700;
  font-family: 'Space Grotesk', sans-serif; color: #1b1b24; }
.budget-tier .stats { display: flex; gap: 14pt; margin-top: 6pt; font-size: 10pt; }
.budget-tier .stats b { color: #680eac; }

.platform-row {
  display: flex; align-items: center; gap: 10pt;
  border: 1px solid #ecdccf; border-radius: 10pt; padding: 10pt 12pt;
  background: #fffaf5; margin-bottom: 6pt;
}
.platform-row .rank {
  width: 32pt; height: 32pt; border-radius: 999pt;
  background: linear-gradient(135deg, #FF6B35, #7B2CBF);
  color: white; font-weight: 700; font-family: 'Space Grotesk', sans-serif;
  display: flex; align-items: center; justify-content: center;
  font-size: 14pt;
}
.platform-row .name { font-weight: 700; font-size: 12pt; }
.platform-row .score { margin-inline-start: auto; font-weight: 700; color: #ab3500; }
"""


_PLAN_TEMPLATE = """<!DOCTYPE html>
<html lang="{{ lang }}" dir="{{ 'rtl' if lang == 'ar' else 'ltr' }}">
<head>
<meta charset="utf-8">
<title>{{ plan.title|e }}</title>
<style>{{ css|safe }}</style>
</head>
<body class="{{ 'rtl' if lang == 'ar' else '' }}">

  {# 1. COVER #}
  <div class="cover">
    <div class="brand">IGNIFY</div>
    <h1>{{ plan.title|e }}</h1>
    <div class="sub">{{ labels.cover_sub }}</div>
    <div class="meta">
      <div><b>{{ labels.tenant }}:</b> {{ tenant_name|e }}</div>
      <div><b>{{ labels.date }}:</b> {{ created_s }}</div>
      <div><b>{{ labels.period }}:</b>
        {{ plan.period_start or '' }} → {{ plan.period_end or '' }}
        ({{ plan.period_days or '—' }} {{ labels.days }})
      </div>
      <div><span class="badge">{{ plan.status or 'draft' }}</span></div>
    </div>
    <div class="tag-gen">{{ labels.generated_by }}</div>
  </div>

  {# 2. EXECUTIVE SUMMARY #}
  <div class="section">
    <h2>{{ labels.exec_summary }}</h2>
    {% if exec_summary %}
      <p>{{ exec_summary|e }}</p>
    {% else %}
      <p class="muted">—</p>
    {% endif %}
    {% if plan.goals %}
      <h3>{{ labels.goals }}</h3>
      <ul>
      {% for g in plan.goals %}<li>{{ g|e if g is string else g|tojson }}</li>{% endfor %}
      </ul>
    {% endif %}
  </div>

  {# 3. MARKET ANALYSIS #}
  <div class="section">
    <h2>{{ labels.market }}</h2>
    {% if market.summary %}<p>{{ market.summary|e }}</p>{% endif %}

    {% if market.competitors %}
      <h3>{{ labels.competitors }}</h3>
      <div class="grid-3">
      {% for c in market.competitors[:3] %}
        <div class="card">
          <b>{{ (c.name if c is mapping else c)|e }}</b>
          {% if c is mapping %}
            {% for k, v in c.items() if k != 'name' %}
              <div class="muted">{{ k|e }}: {{ v|e if v is string else v|tojson }}</div>
            {% endfor %}
          {% endif %}
        </div>
      {% endfor %}
      </div>
    {% endif %}

    {% if market.swot %}
      <h3>{{ labels.swot }}</h3>
      <div class="swot">
        <div class="s"><h4>{{ labels.strengths }}</h4>
          <ul>{% for x in (market.swot.strengths or []) %}<li>{{ x|e }}</li>{% endfor %}</ul></div>
        <div class="w"><h4>{{ labels.weaknesses }}</h4>
          <ul>{% for x in (market.swot.weaknesses or []) %}<li>{{ x|e }}</li>{% endfor %}</ul></div>
        <div class="o"><h4>{{ labels.opportunities }}</h4>
          <ul>{% for x in (market.swot.opportunities or []) %}<li>{{ x|e }}</li>{% endfor %}</ul></div>
        <div class="t"><h4>{{ labels.threats }}</h4>
          <ul>{% for x in (market.swot.threats or []) %}<li>{{ x|e }}</li>{% endfor %}</ul></div>
      </div>
    {% endif %}

    {% if market.trends %}
      <h3>{{ labels.trends }}</h3>
      <ul>
      {% for tr in market.trends %}<li>{{ tr|e if tr is string else tr|tojson }}</li>{% endfor %}
      </ul>
    {% endif %}
  </div>

  {# 4. TARGET AUDIENCE #}
  <div class="section">
    <h2>{{ labels.personas }}</h2>
    {% if personas %}
    <div class="grid-3">
      {% for p in personas[:3] %}
      <div class="card">
        <h3 style="margin-top:0">{{ (p.name or labels.persona)|e }}</h3>
        {% if p.age_range %}<div><b>{{ labels.age }}:</b> {{ p.age_range|e }}</div>{% endif %}
        {% if p.role %}<div><b>{{ labels.role }}:</b> {{ p.role|e }}</div>{% endif %}
        {% if p.goals %}<div><b>{{ labels.goals_p }}:</b>
          {% for g in p.goals %}<span class="chip">{{ g|e }}</span>{% endfor %}
        </div>{% endif %}
        {% if p.pains %}<div style="margin-top:4pt"><b>{{ labels.pains }}:</b>
          {% for g in p.pains %}<span class="chip orange">{{ g|e }}</span>{% endfor %}
        </div>{% endif %}
        {% if p.channels %}<div style="margin-top:4pt"><b>{{ labels.channels }}:</b>
          {% for g in p.channels %}<span class="chip ok">{{ g|e }}</span>{% endfor %}
        </div>{% endif %}
      </div>
      {% endfor %}
    </div>
    {% else %}<p class="muted">—</p>{% endif %}
  </div>

  {# 5. CHANNEL STRATEGY — bar chart #}
  <div class="section">
    <h2>{{ labels.channels_section }}</h2>
    {% if channel_bar_svg %}
    <div class="chart-wrap">{{ channel_bar_svg|safe }}</div>
    {% endif %}
    {% if channels %}
    <table>
      <thead><tr>
        <th>{{ labels.ch_name }}</th><th>{{ labels.ch_priority }}</th>
        <th>{{ labels.ch_cadence }}</th><th>{{ labels.ch_notes }}</th>
      </tr></thead>
      <tbody>
      {% for c in channels %}
      <tr>
        <td>{{ (c.channel or c.name or '—')|e }}</td>
        <td>{{ (c.priority or c.weight or '—')|e }}</td>
        <td>{{ (c.posting_frequency_per_week or c.cadence or c.frequency or '—')|e }}</td>
        <td>{{ (c.rationale or c.notes or c.description or '—')|e }}</td>
      </tr>
      {% endfor %}
      </tbody>
    </table>
    {% endif %}
  </div>

  {# 6. PLATFORM RECOMMENDATION #}
  {% if platform_recs %}
  <div class="section">
    <h2>{{ labels.platform_rec }}</h2>
    {% for p in platform_recs[:5] %}
    <div class="platform-row">
      <div class="rank">{{ loop.index }}</div>
      <div style="flex:1">
        <div class="name">{{ (p.platform or '—')|e }}</div>
        <div class="muted">{{ (p.reason or '')|e }}</div>
        {% if p.budget_share_pct is not none %}
          <div><span class="chip">{{ labels.budget_share }}: {{ p.budget_share_pct }}%</span></div>
        {% endif %}
      </div>
      <div class="score">{{ p.score or '—' }}/100</div>
    </div>
    {% endfor %}
  </div>
  {% endif %}

  {# 7. AD BUDGET STRATEGY #}
  {% if ad_strategy %}
  <div class="section">
    <h2>{{ labels.ad_budget }}</h2>
    {% if ad_strategy.recommended_monthly_budget_usd %}
      <p><b>{{ labels.recommended_budget }}:</b>
         <span class="chip orange">${{ ad_strategy.recommended_monthly_budget_usd }} / mo</span></p>
    {% endif %}
    {% for tier in (ad_strategy.alternative_budgets or []) %}
      <div class="budget-tier">
        <h3>{{ tier.label|e }}</h3>
        <div class="usd">${{ tier.usd }}<span style="font-size:10pt;color:#594139"> / {{ labels.per_month }}</span></div>
        <div class="stats">
          {% if tier.expected_reach %}<div>{{ labels.expected_reach }}: <b>{{ '{:,}'.format(tier.expected_reach) }}</b></div>{% endif %}
          {% if tier.expected_leads %}<div>{{ labels.expected_leads }}: <b>{{ '{:,}'.format(tier.expected_leads) }}</b></div>{% endif %}
        </div>
      </div>
    {% endfor %}
    {% if roas_donut_svg %}<div class="chart-wrap">{{ roas_donut_svg|safe }}</div>{% endif %}
    {% if ad_strategy.reasoning_ar and lang == 'ar' %}
      <p style="margin-top:8pt">{{ ad_strategy.reasoning_ar|e }}</p>
    {% elif ad_strategy.reasoning_en %}
      <p style="margin-top:8pt">{{ ad_strategy.reasoning_en|e }}</p>
    {% endif %}
  </div>

  {# 8. FUNNEL #}
  {% if funnel_svg %}
  <div class="section">
    <h2>{{ labels.funnel }}</h2>
    <div class="chart-wrap">{{ funnel_svg|safe }}</div>
  </div>
  {% endif %}

  {# 9. GROWTH PROJECTION #}
  {% if growth_svg %}
  <div class="section">
    <h2>{{ labels.growth }}</h2>
    <div class="chart-wrap">{{ growth_svg|safe }}</div>
    {% if ad_strategy.monthly_projections %}
    <table>
      <thead><tr>
        <th>{{ labels.month }}</th><th>{{ labels.leads }}</th>
        <th>{{ labels.customers }}</th><th>{{ labels.revenue }}</th>
      </tr></thead>
      <tbody>
      {% for m in ad_strategy.monthly_projections %}
      <tr>
        <td>{{ m.month|e }}</td>
        <td>{{ m.leads }}</td>
        <td>{{ m.customers }}</td>
        <td>${{ m.revenue_usd }}</td>
      </tr>
      {% endfor %}
      </tbody>
    </table>
    {% endif %}
  </div>
  {% endif %}
  {% endif %}

  {# 10. CONTENT CALENDAR #}
  <div class="section">
    <h2>{{ labels.calendar }}</h2>
    {% if calendar %}
    <table>
      <thead><tr>
        <th>{{ labels.cal_day }}</th><th>{{ labels.ch_name }}</th>
        <th>{{ labels.cal_format }}</th><th>{{ labels.cal_topic }}</th>
        <th>{{ labels.hook }}</th><th>{{ labels.cta }}</th>
      </tr></thead>
      <tbody>
      {% for e in calendar[:30] %}
      <tr>
        <td>{{ (e.day or e.date or '—')|e }}</td>
        <td>{{ (e.channel or '—')|e }}</td>
        <td>{{ (e.format or '—')|e }}</td>
        <td>{{ (e.topic or e.title or '—')|e }}</td>
        <td>{{ (e.hook or '—')|e }}</td>
        <td>{{ (e.cta or '—')|e }}</td>
      </tr>
      {% endfor %}
      </tbody>
    </table>
    {% else %}<p class="muted">—</p>{% endif %}
  </div>

  {# 11. KPIS #}
  <div class="section">
    <h2>{{ labels.kpis }}</h2>
    {% if kpis %}
    <table>
      <thead><tr>
        <th>{{ labels.kpi_name }}</th><th>{{ labels.kpi_target }}</th>
        <th>{{ labels.kpi_unit }}</th><th>{{ labels.kpi_channel }}</th>
      </tr></thead>
      <tbody>
      {% for k in kpis %}
      <tr>
        <td>{{ (k.metric or k.name or '—')|e }}</td>
        <td>{{ (k.target or k.value or '—')|e }}</td>
        <td>{{ (k.unit or '—')|e }}</td>
        <td>{{ (k.channel or '—')|e }}</td>
      </tr>
      {% endfor %}
      </tbody>
    </table>
    {% else %}<p class="muted">—</p>{% endif %}
  </div>

  {# 12. NEXT ACTIONS #}
  <div class="section">
    <h2>{{ labels.next_actions }}</h2>
    <ul>
      {% for item in next_actions %}<li>{{ item|e }}</li>{% endfor %}
    </ul>
  </div>

</body></html>
"""


def _default_next_actions(lang: str) -> list[str]:
    if lang == "ar":
        return [
            "مراجعة الخطة مع الفريق والموافقة على الأولويات.",
            "إعداد الحسابات الإعلانية وربطها بمنصة Ignify.",
            "إنتاج أول 7 منشورات من التقويم المقترح.",
            "إطلاق حملة اختبار بالميزانية الدنيا لمدة أسبوع.",
            "مراقبة مؤشرات الأداء أسبوعيًا وتعديل التوزيع.",
        ]
    return [
        "Review the plan with your team and approve priorities.",
        "Provision ad accounts and connect them to Ignify.",
        "Produce the first 7 posts from the content calendar.",
        "Launch a 1-week test campaign at the minimum viable budget.",
        "Review KPIs weekly and rebalance budget across channels.",
    ]


def _plan_labels(lang: str) -> dict[str, str]:
    T = lambda ar, en: _t(ar, en, lang)
    return {
        "cover_sub": T("خطة تسويقية شاملة مولدة بالذكاء الاصطناعي", "Comprehensive AI-generated marketing plan"),
        "tenant": T("المنشأة", "Tenant"),
        "date": T("التاريخ", "Date"),
        "period": T("الفترة", "Period"),
        "days": T("يومًا", "days"),
        "generated_by": T("تم التوليد بواسطة Ignify AI", "Generated by Ignify AI"),
        "exec_summary": T("الملخص التنفيذي", "Executive Summary"),
        "goals": T("الأهداف", "Goals"),
        "market": T("تحليل السوق", "Market Analysis"),
        "competitors": T("المنافسون", "Competitors"),
        "swot": T("تحليل SWOT", "SWOT Analysis"),
        "strengths": T("نقاط القوة", "Strengths"),
        "weaknesses": T("نقاط الضعف", "Weaknesses"),
        "opportunities": T("الفرص", "Opportunities"),
        "threats": T("التهديدات", "Threats"),
        "trends": T("الاتجاهات", "Trends"),
        "personas": T("الجمهور المستهدف", "Target Audience"),
        "persona": T("شخصية", "Persona"),
        "age": T("الفئة العمرية", "Age"),
        "role": T("الدور", "Role"),
        "goals_p": T("الأهداف", "Goals"),
        "pains": T("التحديات", "Pains"),
        "channels": T("القنوات", "Channels"),
        "channels_section": T("استراتيجية القنوات", "Channel Strategy"),
        "ch_name": T("القناة", "Channel"),
        "ch_priority": T("الأولوية", "Priority"),
        "ch_cadence": T("التكرار", "Cadence"),
        "ch_notes": T("ملاحظات", "Notes"),
        "platform_rec": T("توصيات المنصات الإعلانية", "Platform Recommendation"),
        "budget_share": T("حصة الميزانية", "Budget share"),
        "ad_budget": T("استراتيجية ميزانية الإعلانات", "Ad Budget Strategy"),
        "recommended_budget": T("الميزانية الموصى بها", "Recommended monthly budget"),
        "per_month": T("شهريًا", "month"),
        "expected_reach": T("الوصول المتوقع", "Expected reach"),
        "expected_leads": T("العملاء المحتملون المتوقعون", "Expected leads"),
        "funnel": T("قمع التحويل المتوقع", "Funnel Projection"),
        "growth": T("توقعات النمو (3 أشهر)", "Growth Projection (3 months)"),
        "month": T("الشهر", "Month"),
        "leads": T("العملاء المحتملون", "Leads"),
        "customers": T("العملاء", "Customers"),
        "revenue": T("الإيرادات", "Revenue"),
        "calendar": T("تقويم المحتوى", "Content Calendar"),
        "cal_day": T("اليوم", "Day"),
        "cal_format": T("الصيغة", "Format"),
        "cal_topic": T("الموضوع", "Topic"),
        "hook": T("الخطاف", "Hook"),
        "cta": T("الدعوة للإجراء", "CTA"),
        "kpis": T("مؤشرات الأداء", "KPIs"),
        "kpi_name": T("المؤشر", "Metric"),
        "kpi_target": T("الهدف", "Target"),
        "kpi_unit": T("الوحدة", "Unit"),
        "kpi_channel": T("القناة", "Channel"),
        "next_actions": T("الخطوات التالية", "Next Actions"),
    }


def _render_plan_html(ctx: dict, lang: str) -> str:
    plan = ctx.get("plan", {}) or {}
    tenant_name = ctx.get("tenant_name") or ""

    # Normalize period_days
    ps = plan.get("period_start")
    pe = plan.get("period_end")
    period_days = plan.get("period_days")
    if not period_days and ps and pe:
        try:
            period_days = (pe - ps).days  # type: ignore[operator]
        except Exception:
            period_days = None
    plan["period_days"] = period_days

    created = plan.get("created_at")
    if isinstance(created, datetime):
        created_s = created.strftime("%Y-%m-%d")
    elif created:
        created_s = str(created)[:10]
    else:
        created_s = datetime.utcnow().strftime("%Y-%m-%d")

    market = plan.get("market_analysis") or {}
    personas = plan.get("personas") or []
    channels = plan.get("channels") or []
    calendar = plan.get("calendar") or []
    kpis = plan.get("kpis") or []
    ad_strategy = plan.get("ad_strategy") or {}

    # Charts
    channel_bar_svg = ""
    if channels:
        bar_data = []
        for c in channels:
            if isinstance(c, dict):
                lbl = str(c.get("channel") or c.get("name") or "—")
                val = c.get("budget_share_pct") or c.get("weight") or 0
                try:
                    val = float(val)
                except Exception:
                    val = 0
                bar_data.append((lbl, val))
        if bar_data:
            channel_bar_svg = bar_chart(
                bar_data,
                title=_t("حصة الميزانية لكل قناة (%)", "Budget Share per Channel (%)", lang),
                lang=lang,
            )

    platform_recs = ad_strategy.get("platform_recommendations") or []

    funnel_svg = ""
    fp = ad_strategy.get("funnel_projection") or {}
    if fp:
        stages = []
        for key, label_ar, label_en in (
            ("impressions", "المشاهدات", "Impressions"),
            ("clicks", "النقرات", "Clicks"),
            ("leads", "العملاء المحتملون", "Leads"),
            ("customers", "العملاء", "Customers"),
        ):
            if fp.get(key) is not None:
                try:
                    stages.append((_t(label_ar, label_en, lang), int(fp[key])))
                except Exception:
                    pass
        if stages:
            funnel_svg = funnel_chart(stages, lang=lang)

    growth_svg = ""
    mp = ad_strategy.get("monthly_projections") or []
    if mp:
        pts = []
        for m in mp:
            if isinstance(m, dict):
                try:
                    pts.append((str(m.get("month") or ""), float(m.get("leads") or 0)))
                except Exception:
                    pass
        if pts:
            growth_svg = line_chart_growth(
                pts, _t("نمو العملاء المحتملين", "Leads Growth", lang), lang=lang
            )

    roas_donut_svg = ""
    # Simple ROAS proxy: customers*revenue / budget — but we just show lead-conversion rate
    if fp.get("leads") and fp.get("clicks"):
        try:
            roas_donut_svg = donut_chart(
                float(fp["leads"]),
                float(fp["clicks"]),
                _t("نسبة تحويل النقرات إلى عملاء", "Click → Lead rate", lang),
                lang=lang,
            )
        except Exception:
            pass

    # Executive summary
    exec_summary = market.get("summary") or ""
    if not exec_summary and plan.get("goals"):
        goals_list = plan["goals"]
        if isinstance(goals_list, list):
            exec_summary = _t(
                "هذه الخطة تركز على تحقيق الأهداف التالية خلال الفترة المحددة: ",
                "This plan focuses on achieving the following goals during the selected period: ",
                lang,
            ) + ", ".join(str(g) for g in goals_list[:5])

    labels = _plan_labels(lang)

    env = Environment(loader=BaseLoader(), autoescape=select_autoescape(["html"]))
    tmpl = env.from_string(_PLAN_TEMPLATE)
    return tmpl.render(
        lang=lang,
        css=_PLAN_CSS,
        plan=plan,
        tenant_name=tenant_name,
        created_s=created_s,
        market=market,
        personas=personas,
        channels=channels,
        calendar=calendar,
        kpis=kpis,
        ad_strategy=ad_strategy,
        platform_recs=platform_recs,
        channel_bar_svg=channel_bar_svg,
        funnel_svg=funnel_svg,
        growth_svg=growth_svg,
        roas_donut_svg=roas_donut_svg,
        exec_summary=exec_summary,
        next_actions=_default_next_actions(lang),
        labels=labels,
    )


def build_plan_pdf(plan_row: Any, lang: str = "en", tenant_name: str | None = None) -> bytes:
    """Produce a full marketing plan PDF from a MarketingPlan ORM row or dict."""
    if hasattr(plan_row, "__table__"):  # ORM row
        plan = {
            "title": plan_row.title,
            "status": getattr(plan_row, "status", None),
            "period_start": getattr(plan_row, "period_start", None),
            "period_end": getattr(plan_row, "period_end", None),
            "period_days": getattr(plan_row, "period_days", None),
            "created_at": getattr(plan_row, "created_at", None),
            "goals": getattr(plan_row, "goals", None),
            "personas": getattr(plan_row, "personas", None),
            "channels": getattr(plan_row, "channels", None),
            "calendar": getattr(plan_row, "calendar", None),
            "kpis": getattr(plan_row, "kpis", None),
            "market_analysis": getattr(plan_row, "market_analysis", None),
            "ad_strategy": getattr(plan_row, "ad_strategy", None),
        }
    else:
        plan = dict(plan_row)
    html = generate_html("plan", {"plan": plan, "tenant_name": tenant_name or ""}, lang)
    return html_to_pdf(html)


# ── Weekly Report PDF (unchanged behavior) ───────────────────────────────────

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
        kpi_boxes = '<p class="muted">—</p>'

    reach = metrics.get("reach_trend") or []
    eng = metrics.get("engagement_trend") or []

    def _trend_rows(points: list) -> str:
        rows = ""
        if isinstance(points, list):
            for p in points[:14]:
                if isinstance(p, dict):
                    rows += f"<tr><td>{_esc(p.get('date'))}</td><td>{_esc(p.get('value'))}</td></tr>"
        return rows or "<tr><td colspan='2' class='muted'>—</td></tr>"

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
        tp_rows = "<tr><td colspan='4' class='muted'>—</td></tr>"

    insights_html = (
        "<ul>" + "".join(f"<li>{_esc(i)}</li>" for i in insights) + "</ul>"
        if insights else '<p class="muted">—</p>'
    )
    recs_html = (
        "<ul>" + "".join(f"<li>{_esc(r)}</li>" for r in recommendations) + "</ul>"
        if recommendations else '<p class="muted">—</p>'
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
<style>{_WEEKLY_CSS}</style></head>
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
