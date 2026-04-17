"use client";

import { AlertOctagon } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-surface text-on-surface">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
            <AlertOctagon className="mx-auto h-10 w-10 text-red-600" />
            <h1 className="mt-4 text-xl font-bold">حدث خطأ غير متوقع</h1>
            <p className="mt-2 text-sm text-gray-600">
              Something went wrong. Please refresh the page.
            </p>
            {error?.digest && (
              <p className="mt-2 font-mono text-[10px] text-gray-400">ref: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="mt-5 inline-flex items-center justify-center rounded-2xl bg-black px-5 py-2.5 text-sm font-semibold text-white"
            >
              إعادة المحاولة / Retry
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
