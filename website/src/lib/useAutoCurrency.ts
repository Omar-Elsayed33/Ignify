"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ignify_currency";

export function useAutoCurrency(defaultCurrency = "USD") {
  const [currency, setCurrencyState] = useState<string>(defaultCurrency);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCurrencyState(stored);
        return;
      }
    } catch {}

    const base =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${base}/api/v1/geo/detect`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.currency) {
          setCurrencyState(d.currency);
          try {
            localStorage.setItem(STORAGE_KEY, d.currency);
          } catch {}
        }
      })
      .catch(() => {
        // fallback: browser locale hint
        try {
          const loc = navigator.language || "";
          if (loc.includes("-EG")) setCurrencyState("EGP");
          else if (loc.includes("-SA")) setCurrencyState("SAR");
          else if (/-AE|-KW|-QA|-BH|-OM/.test(loc)) setCurrencyState("AED");
        } catch {}
      });
  }, []);

  const setCurrency = (c: string) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {}
  };

  return { currency, setCurrency };
}
