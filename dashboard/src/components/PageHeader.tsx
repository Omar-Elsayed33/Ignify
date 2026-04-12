"use client";

import InsightChip from "./InsightChip";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/**
 * Editorial asymmetric page header (eyebrow chip + display title + actions).
 */
export default function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <section className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
      <div className="space-y-3">
        {eyebrow && <InsightChip>{eyebrow}</InsightChip>}
        <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-xl text-sm font-medium leading-relaxed text-on-surface-variant">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </section>
  );
}
