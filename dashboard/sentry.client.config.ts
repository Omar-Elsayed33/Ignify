// Sentry client-side init — loads on every page in the browser.
// Configure via env:
//   NEXT_PUBLIC_SENTRY_DSN=<dsn>
//   NEXT_PUBLIC_SENTRY_ENV=production|staging|development
//   NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV || "development",
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
