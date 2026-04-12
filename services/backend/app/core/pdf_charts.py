"""SVG chart generators for PDF embedding (no external libs).

All charts accept a `lang` parameter ("ar" or "en"). For Arabic:
- Text uses `direction="rtl"` so right-to-left bidi order is preserved
- Font falls back to Tajawal/Reem Kufi (loaded via @font-face in the
  PDF template) — Arial/system fonts don't shape Arabic glyphs.
"""
from __future__ import annotations

from typing import List, Tuple

_EN_FONT = "Space Grotesk, Manrope, Arial, sans-serif"
_EN_BODY = "Manrope, Arial, sans-serif"
_AR_FONT = "'Reem Kufi', 'Tajawal', 'Noto Sans Arabic', sans-serif"
_AR_BODY = "'Tajawal', 'Noto Sans Arabic', sans-serif"


def _fonts(lang: str) -> tuple[str, str, str]:
    """Return (heading_font, body_font, direction_attr)."""
    if lang == "ar":
        return _AR_FONT, _AR_BODY, ' direction="rtl"'
    return _EN_FONT, _EN_BODY, ""


def donut_chart(value: float, total: float, label: str, color: str = "#ab3500", size: int = 180, lang: str = "en") -> str:
    pct = (value / total * 100) if total else 0
    circumference = 2 * 3.14159 * 70
    offset = circumference * (1 - pct / 100)
    hf, bf, d = _fonts(lang)
    return f"""
<svg viewBox="0 0 200 200" width="{size}" height="{size}">
  <circle cx="100" cy="100" r="70" fill="none" stroke="#f3f3f8" stroke-width="18"/>
  <circle cx="100" cy="100" r="70" fill="none" stroke="{color}" stroke-width="18"
          stroke-dasharray="{circumference}" stroke-dashoffset="{offset}"
          transform="rotate(-90 100 100)" stroke-linecap="round"/>
  <text x="100" y="100" text-anchor="middle" dominant-baseline="middle"
        font-size="32" font-weight="700" fill="#1b1b24" font-family="{hf}">{int(pct)}%</text>
  <text x="100" y="130" text-anchor="middle" font-size="11" fill="#594139" font-family="{bf}"{d}>{label}</text>
</svg>"""


def bar_chart(data: List[Tuple[str, float]], title: str, color: str = "#ab3500", max_val: float | None = None, lang: str = "en") -> str:
    if not data:
        return ""
    mx = max_val or max(v for _, v in data) or 1
    hf, bf, d = _fonts(lang)
    rows = []
    is_rtl = lang == "ar"
    # In RTL: labels on right, bars grow leftward. We flip x positions.
    label_x = 400 if is_rtl else 0
    label_anchor = "end" if is_rtl else "start"
    bar_start = 130  # fixed bar-area start for readability; same in both dirs
    for i, (lbl, v) in enumerate(data):
        w = int((v / mx) * 260)
        y = 30 + i * 38
        if is_rtl:
            # Labels right-aligned on the right side, bars grow from right to left.
            bar_x = 400 - 130 - w
            value_x = 400 - 130 - w - 5  # value to the left of bar
            value_anchor = "end"
        else:
            bar_x = bar_start
            value_x = bar_start + w + 5
            value_anchor = "start"
        rows.append(
            f'<text x="{label_x}" y="{y+14}" text-anchor="{label_anchor}" font-size="12" '
            f'fill="#1b1b24" font-family="{bf}"{d}>{lbl}</text>'
        )
        rows.append(f'<rect x="{bar_x}" y="{y}" width="{w}" height="22" rx="4" fill="{color}" opacity="0.85"/>')
        rows.append(
            f'<text x="{value_x}" y="{y+15}" text-anchor="{value_anchor}" font-size="11" '
            f'fill="#1b1b24" font-family="Arial">{v}</text>'
        )
    h = 40 + len(data) * 38
    title_x = 400 if is_rtl else 0
    title_anchor = "end" if is_rtl else "start"
    return (
        f'<svg viewBox="0 0 400 {h}" width="400" height="{h}">'
        f'<text x="{title_x}" y="18" text-anchor="{title_anchor}" font-size="13" font-weight="700" '
        f'fill="#1b1b24" font-family="{hf}"{d}>{title}</text>{"".join(rows)}</svg>'
    )


def funnel_chart(stages: List[Tuple[str, int]], lang: str = "en") -> str:
    if not stages:
        return ""
    mx = max(v for _, v in stages) or 1
    hf, _, d = _fonts(lang)
    levels = []
    for i, (lbl, v) in enumerate(stages):
        w = int((v / mx) * 360)
        x = (400 - w) // 2
        y = 10 + i * 52
        levels.append(f'<rect x="{x}" y="{y}" width="{w}" height="42" rx="6" fill="#ff6b35" opacity="{0.9 - i*0.15}"/>')
        levels.append(
            f'<text x="200" y="{y+26}" text-anchor="middle" font-size="14" font-weight="600" '
            f'fill="#ffffff" font-family="{hf}"{d}>{lbl}: {v:,}</text>'
        )
    h = 20 + len(stages) * 52
    return f'<svg viewBox="0 0 400 {h}" width="400" height="{h}">{"".join(levels)}</svg>'


def line_chart_growth(monthly_projections: List[Tuple[str, float]], title: str, lang: str = "en") -> str:
    if not monthly_projections:
        return ""
    mx = max(v for _, v in monthly_projections) or 1
    hf, bf, d = _fonts(lang)
    pts = []
    for i, (_, v) in enumerate(monthly_projections):
        x = 40 + i * (320 / max(1, len(monthly_projections) - 1))
        y = 180 - (v / mx) * 140
        pts.append(f"{x},{y}")
    labels = []
    for i, (lbl, v) in enumerate(monthly_projections):
        x = 40 + i * (320 / max(1, len(monthly_projections) - 1))
        labels.append(
            f'<text x="{x}" y="200" text-anchor="middle" font-size="10" fill="#594139" '
            f'font-family="{bf}">{lbl}</text>'
        )
    is_rtl = lang == "ar"
    title_x = 400 if is_rtl else 0
    title_anchor = "end" if is_rtl else "start"
    return f"""<svg viewBox="0 0 400 220" width="400" height="220">
  <text x="{title_x}" y="14" text-anchor="{title_anchor}" font-size="13" font-weight="700" fill="#1b1b24" font-family="{hf}"{d}>{title}</text>
  <polyline points="{' '.join(pts)}" fill="none" stroke="#ab3500" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  {''.join(labels)}
</svg>"""
