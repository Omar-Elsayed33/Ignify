"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  pageSize = 10,
  emptyTitle,
  emptyDescription,
}: DataTableProps<T>) {
  const t = useTranslations("common");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal == null || bVal == null) return 0;
    const cmp = String(aVal).localeCompare(String(bVal));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice(page * pageSize, (page + 1) * pageSize);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-16">
        <p className="text-lg font-semibold text-text-primary">
          {emptyTitle || t("noData")}
        </p>
        {emptyDescription && (
          <p className="mt-2 text-sm text-text-secondary">{emptyDescription}</p>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    "px-4 py-3 text-start font-semibold text-text-secondary",
                    col.sortable && "cursor-pointer select-none hover:text-text-primary"
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === "asc" ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item, idx) => (
              <tr
                key={idx}
                className="border-b border-border-light last:border-0 hover:bg-surface-hover"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-text-primary">
                    {col.render ? col.render(item) : String(item[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-sm text-text-secondary">
            {t("showing")} {page * pageSize + 1}-
            {Math.min((page + 1) * pageSize, data.length)} {t("of")}{" "}
            {data.length} {t("results")}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded-md p-1 text-text-secondary hover:bg-surface-hover disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-md p-1 text-text-secondary hover:bg-surface-hover disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
