/* Ignify — minimal offline service worker.
   Strategy:
   - Static Next.js assets (/_next/static/*): cache-first with network fallback.
   - Navigations (HTML): network-first with 5s timeout; fall back to cached locale shell.
   - Manifest + root shells: cached on install.
*/

const CACHE_VERSION = "ignify-v1";
const CORE_ASSETS = [
  "/",
  "/ar",
  "/en",
  "/manifest.webmanifest",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Best-effort: don't reject the install if one URL fails.
      Promise.all(
        CORE_ASSETS.map((url) =>
          cache
            .add(new Request(url, { cache: "reload" }))
            .catch(() => undefined)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function networkWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    fetch(request)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip cross-origin requests — let the browser handle them directly.
  if (url.origin !== self.location.origin) return;

  // Skip backend API calls — they should never be served from cache.
  if (url.pathname.startsWith("/api/")) return;

  // Static Next.js assets: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // HTML navigations: network-first with 5s timeout, fall back to cache.
  const isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(
      networkWithTimeout(req, 5000)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          // Fall back to locale shell, then root.
          const localeShell =
            (url.pathname.startsWith("/ar") && (await caches.match("/ar"))) ||
            (url.pathname.startsWith("/en") && (await caches.match("/en")));
          if (localeShell) return localeShell;
          const root = await caches.match("/");
          if (root) return root;
          return new Response(
            "<h1>Offline</h1><p>You appear to be offline.</p>",
            { status: 503, headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // Everything else (images, fonts, etc.): cache-first with background refresh.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
    )
  );
});
