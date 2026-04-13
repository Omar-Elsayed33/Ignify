# Hybrid Plan — anthropic/claude-opus-4.6 + openai/gpt-4o

- **Plan ID:** `e00c46f8-3383-4dc9-b689-47a74194ef8d`
- **Source plan:** `4f205bb9-aa3b-4697-8a45-5140f03af5c4`
- **Analysis model (thinking):** `anthropic/claude-opus-4.6`
- **Execution model (output):** `openai/gpt-4o`
- **Duration:** 84.7s
- **Generated at:** 2026-04-13T08:21:10.314794Z

## Sections

- ❌ **market analysis** — 0 items
- ❌ **personas** — 0 items
- ❌ **positioning** — 0 items
- ❌ **customer journey** — 0 items
- ✅ **offer** — 9 items
- ❌ **funnel** — 0 items
- ✅ **channels** — 3 items
- ✅ **conversion** — 5 items
- ✅ **retention** — 8 items
- ✅ **growth loops** — 8 items
- ✅ **calendar** — 11 items
- ✅ **kpis** — 13 items
- ✅ **ad strategy** — 15 items
- ✅ **execution roadmap** — 30 items

## Full Plan Data

### offer
```json
{
  "core_offer": {
    "name": "عرض استقدام العمالة الآن",
    "includes": [
      "استشارة مجانية",
      "تخفيض 20% على أول طلب",
      "تقرير مخصص للاحتياجات"
    ],
    "price_usd": 400,
    "anchor_price_usd": 500
  },
  "urgency_mechanism": "time-limited",
  "risk_reversal": "refund policy",
  "bonuses": [
    {
      "bonus": "دعم مجاني لمدة شهر",
      "perceived_value_usd": 100,
      "real_cost_usd": 20
    }
  ],
  "irresistible_reason": "وفر 20% على خدمات الاستقدام لأول مرة هذا الشهر فقط!",
  "offer_deliverability": "نعم، يمكنهم الوفاء بهذا العرض على نطاق واسع",
  "pricing_tiers": [
    {
      "name": "basic",
      "price_usd": 300,
      "includes": [
        "استشارة مجانية",
        "تقرير مخصص للاحتياجات"
      ],
      "target_segment": "السعر الحساس"
    },
    {
      "name": "pro",
      "price_usd": 600,
      "includes": [
        "استشارة مجانية",
        "تخفيض 20% على أول طلب",
        "تقرير مخصص للاحتياجات",
        "دعم مجاني لمدة شهر"
      ],
      "target_segment": "الرئيسي",
      "marked_as_popular": true
    },
    {
      "name": "premium",
      "price_usd": 1200,
      "includes": [
        "استشارة مجانية",
        "تخفيض 20% على أول طلب",
        "تقرير مخصص للاحتياجات",
        "دعم مجاني لمدة ثلاثة أشهر",
        "أولوية في الخدمة"
      ],
      "target_segment": "المؤسسات الكبرى"
    }
  ],
  "upsell_matrix": [
    {
      "from_tier": "basic",
      "to_tier": "pro",
      "trigger": "عند الحاجة إلى دعم إضافي",
      "expected_upsell_rate_pct": 20
    },
    {
      "from_tier": "pro",
      "to_tier": "premium",
      "trigger": "عند الطلب المتكرر",
      "expected_upsell_rate_pct": 15
    }
  ],
  "cross_sell_products": [
    {
      "product": "خدمات تدريب العمالة",
      "attach_rate_pct": 25,
      "avg_order_increase_usd": 150
    }
  ]
}
```

### ad_strategy
```json
{
  "platform_recommendations": [
    {
      "platform": "Instagram",
      "score": "9",
      "budget_share_pct": 40,
      "rationale": "إنستغرام يعد منصة مثالية للوصول إلى الجمهور السعودي من خلال المحتوى البصري الجذاب والقصص اليومية التي تزيد من التفاعل."
    },
    {
      "platform": "TikTok",
      "score": "8",
      "budget_share_pct": 40,
      "rationale": "تيك توك يوفر فرصة للوصول إلى جمهور واسع ودفعهم للتفاعل بسرعة من خلال محتوى القصير والجذاب."
    },
    {
      "platform": "WhatsApp",
      "score": "7",
      "budget_share_pct": 20,
      "rationale": "الواتساب يعد قناة قوية للإحالات الدافئة، حيث يمكن للعملاء الحاليين التوصية بالخدمات لأصدقائهم بثقة."
    }
  ],
  "recommended_monthly_budget_usd": 500,
  "alternative_budgets": {
    "Go organic": "0",
    "Lean": "250",
    "User budget": "500"
  },
  "budget_breakdown": {
    "facebook_ads": "200",
    "google_ads": "0",
    "content_production": "150",
    "tools": "150"
  },
  "expected_roi": {
    "cost_per_lead_usd": 5,
    "cost_per_customer_usd": 50,
    "break_even_customers": 10
  },
  "what_to_skip_for_this_budget": [
    "Google Ads",
    "LinkedIn",
    "Influencer Marketing"
  ],
  "funnel_projection": {
    "impressions": 10000,
    "clicks": 500,
    "leads": 100,
    "customers": 10
  },
  "monthly_projections": {
    "M1": {
      "leads": 100,
      "customers": 10,
      "revenue_usd": 1500
    },
    "M2": {
      "leads": 110,
      "customers": 11,
      "revenue_usd": 1650
    },
    "M3": {
      "leads": 120,
      "customers": 12,
      "revenue_usd": 1800
    }
  },
  "reasoning_ar": "بناءً على الميزانية المتاحة وقدرة الفريق، نركز على إنستغرام وتيك توك للوصول إلى الجمهور السعودي بشكل فعّال من خلال المحتوى البصري الجذاب. سنركز أيضًا على الإحالات عبر الواتساب لتعزيز التحويلات الدافئة. هذا يضمن تحقيق الأهداف المطلوبة بفعالية من حيث التكلفة.",
  "reasoning_en": "Based on the available budget and team capacity, we focus on Instagram and TikTok to effectively reach the Saudi audience through engaging visual content. We will also focus on referrals via WhatsApp to enhance warm conversions. This ensures achieving the desired goals cost-effectively.",
  "scenarios": {
    "conservative": {
      "budget_usd": 500,
      "impressions": 8000,
      "clicks": 400,
      "leads": 80,
      "customers": 8,
      "revenue_usd": 1200,
      "roas": 2.4
    },
    "expected": {
      "budget_usd": 500,
      "impressions": 10000,
      "clicks": 500,
      "leads": 100,
      "customers": 10,
      "revenue_usd": 1500,
      "roas": 3
    },
    "aggressive": {
      "budget_usd": 1000,
      "impressions": 20000,
      "clicks": 1000,
      "leads": 200,
      "customers": 20,
      "revenue_usd": 3000,
      "roas": 3
    }
  },
  "cac_usd": 50,
  "ltv_usd": 150,
  "payback_months": 2,
  "channel_intent_mix": {
    "high_intent": [
      "google_search",
      "sem"
    ],
    "passive": [
      "instagram_reels",
      "tiktok"
    ],
    "warm": [
      "whatsapp_b
```

### execution_roadmap
```json
[
  {
    "day": 1,
    "priority_action": "إعداد أداة تتبع التحويلات",
    "owner_role": "مدير التسويق",
    "expected_outcome": "قياس دقيق لتحويلات الحملة",
    "blocker_to_watch": "مشاكل فنية في التتبع"
  },
  {
    "day": 2,
    "priority_action": "تصميم صفحة الهبوط",
    "owner_role": "مصمم الويب",
    "expected_outcome": "صفحة هبوط فعالة لجذب العملاء",
    "blocker_to_watch": "تأخير في التصميم"
  },
  {
    "day": 3,
    "priority_action": "إنشاء حساب إعلانات جديد",
    "owner_role": "مدير الإعلانات",
    "expected_outcome": "جاهزية لإطلاق الحملات الإعلانية",
    "blocker_to_watch": "مشاكل في الموافقة على الحساب"
  },
  {
    "day": 4,
    "priority_action": "إعداد كتالوج الواتساب",
    "owner_role": "مدير المنتج",
    "expected_outcome": "سهولة استعراض المنتجات للعملاء",
    "blocker_to_watch": "عدم توافق المعلومات"
  },
  {
    "day": 5,
    "priority_action": "تطوير استراتيجية المحتوى",
    "owner_role": "مدير المحتوى",
    "expected_outcome": "خطة واضحة للمحتوى التسويقي",
    "blocker_to_watch": "نقص في الأفكار الإبداعية"
  },
  {
    "day": 6,
    "priority_action": "ربط حسابات التواصل الاجتماعي",
    "owner_role": "مدير التسويق الرقمي",
    "expected_outcome": "تكامل سلس بين القنوات المختلفة",
    "blocker_to_watch": "مشاكل في الربط الفني"
  },
  {
    "day": 7,
    "priority_action": "اختبار الصفحة المقصودة والروابط",
    "owner_role": "مدير الجودة",
    "expected_outcome": "تأكد من عمل كل الروابط بشكل صحيح",
    "blocker_to_watch": "مشاكل في الروابط غير الفعالة"
  },
  {
    "day": 8,
    "priority_action": "إطلاق الحملات الإعلانية الأولى على إنستغرام",
    "owner_role": "مدير الإعلانات",
    "expected_outcome": "زيادة الوعي بالعلامة التجارية",
    "blocker_to_watch": "مشاكل في الموافقة على الإعلانات"
  },
  {
    "day": 9,
    "priority_action": "إطلاق المحتوى الأولي على تيك توك",
    "owner_role": "مدير المحتوى",
    "expected_outcome": "زيادة التفاعل مع الجمهور",
    "blocker_to_watch": "التفاعل الضعيف مع المحتوى"
  },
  {
    "day": 10,
    "priority_action": "تحليل أداء الحملات الأولية",
    "owner_role": "محلل البيانات",
    "expected_outcome": "فهم أولي لفعالية الاستراتيجيات",
    "blocker_to_watch": "عدم كفاية البيانات للتحليل"
  },
  {
    "day": 11,
    "priority_action": "تحسين الأداء بناءً على البيانات",
    "owner_role": "مدير الإعلانات",
    "expected_outcome": "تحسينات في التكلفة لكل تحويل",
    "blocker_to_watch": "عدم فعالية التغييرات"
  },
  {
    "day": 12,
    "priority_action": "توسيع المحتوى بناءً على ردود الفعل",
    "owner_role": "مدير المحتوى",
    "expected_outcome": "محتوى أكثر جاذبية للجمهور",
    "blocker_to_watch": "عدم وضوح ردود الفعل"
  },
  {
    "day": 13,
    "priority_action": "إجراء تعديلات على الصفحة المقصودة",
    "owner_role": "مصمم الويب",
    "expected_outcome": "زيادة معدل التحويل",
    "blocker_to_watch": "مشاكل التصميم"
  },
  {
    "day": 14,
    "priority_action": "زيادة الميزانية للحملات الناجحة",
    "owner_role": "مدير الإعلانات",
    "expected_outcome": "زيادة في المبيعات",
    "blo
```
