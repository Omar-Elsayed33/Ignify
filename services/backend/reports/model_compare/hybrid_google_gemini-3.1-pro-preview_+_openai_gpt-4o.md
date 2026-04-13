# Hybrid Plan — google/gemini-3.1-pro-preview + openai/gpt-4o

- **Plan ID:** `68d9e198-b57f-4a47-b0fb-b68c4dabddaf`
- **Source plan:** `4f205bb9-aa3b-4697-8a45-5140f03af5c4`
- **Analysis model (thinking):** `google/gemini-3.1-pro-preview`
- **Execution model (output):** `openai/gpt-4o`
- **Duration:** 79.0s
- **Generated at:** 2026-04-13T08:27:18.970566Z

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
- ✅ **calendar** — 9 items
- ✅ **kpis** — 13 items
- ✅ **ad strategy** — 15 items
- ✅ **execution roadmap** — 30 items

## Full Plan Data

### offer
```json
{
  "core_offer": {
    "name": "عرض استقدام العمالة",
    "includes": [
      "استقدام العمالة بشكل سريع",
      "استشارات مجانية",
      "دعم عبر الهاتف"
    ],
    "price_usd": "300",
    "anchor_price_usd": "500"
  },
  "urgency_mechanism": "limited stock",
  "risk_reversal": "guarantee",
  "bonuses": [
    {
      "bonus": "جلسة استشارية مجانية",
      "perceived_value_usd": "50",
      "real_cost_usd": "10"
    },
    {
      "bonus": "تخفيض إضافي للطلبات المستقبلية",
      "perceived_value_usd": "100",
      "real_cost_usd": "20"
    }
  ],
  "irresistible_reason": "احجز الآن لتحصل على استقدام العمالة بسرعة وبدون عناء بأسعار مخفضة!",
  "offer_deliverability": "نعم، يمكنهم تنفيذ هذا العرض على نطاق واسع.",
  "pricing_tiers": [
    {
      "name": "basic",
      "price_usd": "150",
      "includes": [
        "استقدام العمالة الأساسية"
      ],
      "target_segment": "محبي الأسعار الاقتصادية"
    },
    {
      "name": "pro",
      "price_usd": "300",
      "includes": [
        "استقدام العمالة بشكل سريع",
        "استشارات مجانية"
      ],
      "target_segment": "العملاء الرئيسيين",
      "marked_as_popular": true
    },
    {
      "name": "premium",
      "price_usd": "600",
      "includes": [
        "استقدام العمالة بشكل سريع",
        "استشارات مجانية",
        "دعم مخصص"
      ],
      "target_segment": "الشركات الكبرى"
    }
  ],
  "upsell_matrix": [
    {
      "from_tier": "basic",
      "to_tier": "pro",
      "trigger": "عند الحاجة لاستشارات إضافية",
      "expected_upsell_rate_pct": 25
    }
  ],
  "cross_sell_products": [
    {
      "product": "خدمات استشارية إضافية",
      "attach_rate_pct": 30,
      "avg_order_increase_usd": 50
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
      "score": "8.5",
      "budget_share_pct": 40,
      "rationale": "Instagram هو منصة شائعة في المملكة العربية السعودية، مما يجعله مناسبًا لاكتشاف غير مباشر للخدمات."
    },
    {
      "platform": "TikTok",
      "score": "7.5",
      "budget_share_pct": 30,
      "rationale": "TikTok يتمتع بانتشار واسع بين الجمهور السعودي الشبابي، مما يجعله فعالاً في جذب الانتباه بشكل غير مباشر."
    },
    {
      "platform": "Referral",
      "score": "6.5",
      "budget_share_pct": 30,
      "rationale": "الإحالات تعتبر وسيلة قوية لجذب عملاء جدد لأن التوصيات تأتي من أشخاص موثوق بهم."
    }
  ],
  "recommended_monthly_budget_usd": 500,
  "alternative_budgets": {
    "Go organic": "التركيز على الاستراتيجيات العضوية مثل تحسين المحتوى وزيادة التفاعل على Instagram وTikTok.",
    "Lean": "250 دولار أمريكي مع التركيز على Instagram كقناة أساسية لتحقيق أفضل عائد على الاستثمار.",
    "User budget": "500 دولار أمريكي موزعة بين Instagram وTikTok وReferral لتحقيق أهداف المبيعات."
  },
  "budget_breakdown": {
    "facebook_ads": "200 دولار أمريكي",
    "google_ads": "0 دولار أمريكي",
    "content_production": "150 دولار أمريكي",
    "tools": "150 دولار أمريكي"
  },
  "expected_roi": {
    "cost_per_lead_usd": 7,
    "cost_per_customer_usd": 100,
    "break_even_customers": 5
  },
  "what_to_skip_for_this_budget": [
    "إعلانات Google",
    "إعلانات YouTube"
  ],
  "funnel_projection": {
    "impressions": 15000,
    "clicks": 1500,
    "leads": 76,
    "customers": 8
  },
  "monthly_projections": {
    "M1": {
      "leads": 76,
      "customers": 8,
      "revenue_usd": 1600
    },
    "M2": {
      "leads": 90,
      "customers": 10,
      "revenue_usd": 2000
    },
    "M3": {
      "leads": 100,
      "customers": 12,
      "revenue_usd": 2400
    }
  },
  "reasoning_ar": "مع ميزانية 500 دولار أمريكي شهريًا، نركز على القنوات التي تحقق أكبر تأثير في السوق السعودي. Instagram هو الأفضل لزيادة الوعي بالخدمة وجذب العملاء بشكل غير مباشر. TikTok يساعد في الوصول إلى الجمهور الشبابي بفعالية. برامج الإحالة تعزز الثقة وتجذب عملاء جدد. نتجنب إعلانات Google ويوتيوب لتوفير التكاليف والتركيز على القنوات ذات العائد الأعلى.",
  "reasoning_en": "With a $500 monthly budget, we focus on channels that have the greatest impact in the Saudi market. Instagram is the best for raising service awareness and attracting customers indirectly. TikTok helps reach the younger audience effectively. Referral programs build trust and attract new customers. We avoid Google and YouTube ads to save costs and focus on higher ROI channels.",
  "scenarios": {
    "conservative": {
      "budget_usd": 400,
      "impressions": 12000,
      "clicks": 1200,
      "leads": 60,
      "customers": 6,
      "revenue_usd": 1200,
      "roas": 3
    },
    "expected": {
      "budget_usd": 500,
      "impressions": 15000,
      "clicks": 1500,
      "leads": 76,
      "customers": 8,
      "revenue_usd": 1600,
      "roas": 3.2
    },
    "ag
```

### execution_roadmap
```json
[
  {
    "day": 1,
    "priority_action": "إنشاء حساب جوجل لتحليل البيانات وربط الموقع الإلكتروني",
    "owner_role": "مدير التسويق الرقمي",
    "expected_outcome": "تتبع فعال لحركة المرور على الموقع",
    "blocker_to_watch": "تكوين غير صحيح لأكواد التتبع"
  },
  {
    "day": 2,
    "priority_action": "بناء صفحة هبوط جذابة تتضمن تفاصيل العرض",
    "owner_role": "مصمم الويب",
    "expected_outcome": "زيادة معدل التحويل للزوار إلى عملاء محتملين",
    "blocker_to_watch": "مشاكل في تجربة المستخدم"
  },
  {
    "day": 3,
    "priority_action": "إعداد حساب إعلانات فيسبوك وإنستغرام",
    "owner_role": "مدير التسويق الرقمي",
    "expected_outcome": "القدرة على إطلاق حملات إعلانية مدفوعة",
    "blocker_to_watch": "رفض الحساب بسبب عدم الامتثال للسياسات"
  },
  {
    "day": 4,
    "priority_action": "إنشاء كتالوج المنتجات على واتساب",
    "owner_role": "مدير المنتج",
    "expected_outcome": "سهولة مشاركة العروض مع العملاء عبر واتساب",
    "blocker_to_watch": "قيود واتساب على الكتالوجات"
  },
  {
    "day": 5,
    "priority_action": "اختبار صفحة الهبوط والتأكد من عمل جميع الروابط",
    "owner_role": "مهندس جودة",
    "expected_outcome": "تجربة مستخدم سلسة وخالية من الأخطاء",
    "blocker_to_watch": "أخطاء في الروابط أو عدم تحميل الصفحة"
  },
  {
    "day": 6,
    "priority_action": "إعداد نظام تتبع المكالمات لمراقبة الحملات الإعلانية",
    "owner_role": "مدير العمليات",
    "expected_outcome": "تتبع دقيق للمكالمات الناتجة عن الإعلانات",
    "blocker_to_watch": "مشكلة في تكامل النظام"
  },
  {
    "day": 7,
    "priority_action": "إعداد قائمة بريدية للأشخاص المهتمين بالعروض",
    "owner_role": "مدير التسويق الرقمي",
    "expected_outcome": "قائمة مستهدفة للتواصل الفعال مع العملاء المحتملين",
    "blocker_to_watch": "معدلات انخفاض في التسجيل"
  },
  {
    "day": 8,
    "priority_action": "إطلاق أول حملة إعلانية على إنستغرام",
    "owner_role": "مدير التسويق الرقمي",
    "expected_outcome": "زيادة في عدد الزيارات للموقع وصفحة الهبوط",
    "blocker_to_watch": "تكاليف مرتفعة للنقرة"
  },
  {
    "day": 9,
    "priority_action": "إطلاق أول حملة إعلانية على تيك توك",
    "owner_role": "مدير التسويق الرقمي",
    "expected_outcome": "زيادة في الوعي بالعلامة التجارية بين الجمهور الشبابي",
    "blocker_to_watch": "عدم الوصول إلى الجمهور المستهدف"
  },
  {
    "day": 10,
    "priority_action": "إنشاء أول مجموعة محتوى للنشر على وسائل التواصل الاجتماعي",
    "owner_role": "كاتب المحتوى",
    "expected_outcome": "تحسين التفاعل مع العلامة التجارية عبر القنوات الاجتماعية",
    "blocker_to_watch": "نقص في الأفكار الإبداعية"
  },
  {
    "day": 11,
    "priority_action": "تحليل أداء الحملات الإعلانية وتحديد النقاط القوية والضعيفة",
    "owner_role": "محلل البيانات",
    "expected_outcome": "فهم أفضل لأداء الإعلانات وتحديد التحسينات المطلوبة",
    "blocker_to_watch": "معلومات غير كاملة أو غير دقيقة"
  },
  {
    "day": 12,
    "priority_action": "إجراء تحسينات على صفحة الهبوط بناءً على التغذية الراجعة",
    "owner_role": "مصمم الويب",
    "expected_outcome": "زيادة معدل التحوي
```
