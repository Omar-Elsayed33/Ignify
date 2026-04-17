"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import InsightChip from "@/components/InsightChip";
import { api, BASE_URL, getAccessToken } from "@/lib/api";
import {
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  Check,
  X,
  Sparkles,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  FileUp,
} from "lucide-react";
import { clsx } from "clsx";

interface Improvement {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
}

interface AnalyzeResponse {
  extracted_text: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvements: Improvement[];
  detected_sections: string[];
  raw_text_length: number;
}

interface PlanResponse {
  id: string;
  title: string;
}

const SEVERITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-rose-100", text: "text-rose-700", label: "مهم جداً" },
  medium: { bg: "bg-amber-100", text: "text-amber-700", label: "متوسط" },
  low: { bg: "bg-slate-100", text: "text-slate-700", label: "اختياري" },
};

export default function PdfImportPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [title, setTitle] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleFile = (f: File | null) => {
    setError(null);
    setAnalysis(null);
    setFile(f);
    if (f) setTitle(f.name.replace(/\.pdf$/i, ""));
  };

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const token = getAccessToken();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("language", language);
      const res = await fetch(`${BASE_URL}/api/v1/plans/pdf/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "فشل تحليل الملف");
      }
      const data: AnalyzeResponse = await res.json();
      setAnalysis(data);
      // Auto-select high-severity improvements
      setSelectedIds(
        new Set(data.improvements.filter((i) => i.severity === "high").map((i) => i.id))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تحليل الملف");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleImprovement = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importPlan = async (applyImprovements: boolean) => {
    if (!analysis) return;
    setImporting(true);
    setError(null);
    try {
      const ids = applyImprovements ? Array.from(selectedIds) : [];
      const plan = await api.post<PlanResponse>("/api/v1/plans/pdf/import", {
        text: analysis.extracted_text,
        title: title || "خطة مستوردة",
        language,
        apply_improvement_ids: ids,
        improvements: analysis.improvements,
      });
      router.push(`/plans/${plan.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الاستيراد");
      setImporting(false);
    }
  };

  return (
    <div>
      <DashboardHeader title="استيراد خطة من PDF" />

      <div className="p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <PageHeader
            eyebrow="AI · PLAN IMPORT"
            title="استيراد خطة من PDF"
            description="ارفع ملف الخطة التسويقية بصيغة PDF. سيقوم الذكاء الاصطناعي بتحليله واقتراح تحسينات يمكنك اعتمادها قبل الاستيراد."
          />

          {error && (
            <Card padding="sm" className="flex items-center gap-3 !bg-error-container">
              <AlertCircle className="h-4 w-4 shrink-0 text-on-error-container" />
              <span className="text-sm font-medium text-on-error-container">{error}</span>
            </Card>
          )}

          {/* Step 1: Upload */}
          {!analysis && (
            <Card padding="lg" className="space-y-5">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                <h3 className="font-headline text-lg font-bold text-on-surface">
                  الخطوة الأولى: رفع الملف
                </h3>
              </div>

              <label
                className={clsx(
                  "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
                  file
                    ? "border-primary bg-primary/5"
                    : "border-outline/30 bg-surface-container-low hover:bg-surface-container"
                )}
              >
                <FileUp className="h-10 w-10 text-primary" />
                {file ? (
                  <>
                    <p className="font-headline text-sm font-bold text-on-surface">{file.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-headline text-sm font-bold text-on-surface">
                      اختر ملف PDF أو اسحبه هنا
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      الحد الأقصى 10 ميجابايت · نصوص فقط (لا تدعم الصور الممسوحة ضوئياً)
                    </p>
                  </>
                )}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block font-headline text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    لغة الخطة
                  </span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as "ar" | "en")}
                    className="w-full rounded-xl bg-surface-container-low px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-headline text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    عنوان الخطة
                  </span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="خطة تسويقية 2026"
                    className="w-full rounded-xl bg-surface-container-low px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onClick={analyze}
                  disabled={!file || analyzing}
                  leadingIcon={
                    analyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )
                  }
                >
                  {analyzing ? "جارٍ التحليل..." : "تحليل الملف"}
                </Button>
              </div>
            </Card>
          )}

          {/* Step 2: Review analysis */}
          {analysis && (
            <>
              {/* Summary */}
              <Card padding="lg" className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-headline text-lg font-bold text-on-surface">ملخص الخطة</h3>
                </div>
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  {analysis.summary || "—"}
                </p>
                {analysis.detected_sections.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {analysis.detected_sections.map((s) => (
                      <InsightChip key={s}>{s}</InsightChip>
                    ))}
                  </div>
                )}
              </Card>

              {/* Strengths + Weaknesses */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card padding="lg" className="!bg-emerald-50">
                  <div className="mb-3 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-headline text-sm font-bold text-emerald-800">نقاط القوة</h3>
                  </div>
                  <ul className="space-y-2">
                    {analysis.strengths.length === 0 ? (
                      <li className="text-sm text-on-surface-variant">—</li>
                    ) : (
                      analysis.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          {s}
                        </li>
                      ))
                    )}
                  </ul>
                </Card>
                <Card padding="lg" className="!bg-rose-50">
                  <div className="mb-3 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-rose-600" />
                    <h3 className="font-headline text-sm font-bold text-rose-800">نقاط الضعف</h3>
                  </div>
                  <ul className="space-y-2">
                    {analysis.weaknesses.length === 0 ? (
                      <li className="text-sm text-on-surface-variant">—</li>
                    ) : (
                      analysis.weaknesses.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
                          {s}
                        </li>
                      ))
                    )}
                  </ul>
                </Card>
              </div>

              {/* Improvements checklist */}
              <Card padding="lg" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="font-headline text-lg font-bold text-on-surface">
                      تحسينات مقترحة
                    </h3>
                  </div>
                  <span className="text-xs font-medium text-on-surface-variant">
                    {selectedIds.size} من {analysis.improvements.length} محدد
                  </span>
                </div>

                <div className="space-y-2">
                  {analysis.improvements.map((imp) => {
                    const selected = selectedIds.has(imp.id);
                    const sev = SEVERITY_STYLE[imp.severity] || SEVERITY_STYLE.medium;
                    return (
                      <button
                        key={imp.id}
                        type="button"
                        onClick={() => toggleImprovement(imp.id)}
                        className={clsx(
                          "flex w-full items-start gap-3 rounded-xl p-4 text-start transition-all",
                          selected
                            ? "bg-primary/5 ring-2 ring-primary"
                            : "bg-surface-container-low hover:bg-surface-container"
                        )}
                      >
                        <div
                          className={clsx(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
                            selected ? "bg-primary text-white" : "bg-surface-container-high"
                          )}
                        >
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-headline text-sm font-bold text-on-surface">
                              {imp.title}
                            </p>
                            <span
                              className={clsx(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                sev.bg,
                                sev.text
                              )}
                            >
                              {sev.label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                            {imp.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAnalysis(null);
                    setSelectedIds(new Set());
                  }}
                  disabled={importing}
                >
                  البدء من جديد
                </Button>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => importPlan(false)}
                    disabled={importing}
                    leadingIcon={
                      importing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                      )
                    }
                  >
                    استيراد كما هي
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => importPlan(true)}
                    disabled={importing || selectedIds.size === 0}
                    leadingIcon={
                      importing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )
                    }
                  >
                    استيراد مع تطبيق التحسينات ({selectedIds.size})
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
