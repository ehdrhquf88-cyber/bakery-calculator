const CACHE_PREFIXES = ["bread-people-", "bakery-app-"];
const CACHE_NAME = "bread-people-v7";
const APP_SHELL = [
  "/manifest.webmanifest",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "SW_ACTIVATED" }));
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationFirst(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/apple-touch-icon.png"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname === "/manifest.webmanifest") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) return caches.match(fallbackUrl);
    throw new Error("No cached response available.");
  }
}

async function navigationFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    if (new URL(request.url).pathname !== "/") {
      cache.put("/", response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    const cachedHome = await caches.match("/");
    if (cachedHome) return cachedHome;

    return new Response(
      `<!doctype html>
      <html lang="ko">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>빵쟁이들</title>
          <style>
            body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f6f3; color: #111; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
            main { width: min(360px, calc(100vw - 32px)); text-align: center; }
            h1 { font-size: 24px; margin: 0 0 12px; }
            p { color: #666; font-weight: 700; line-height: 1.6; }
            button { margin-top: 20px; width: 100%; border: 0; border-radius: 12px; background: #111; color: white; padding: 14px 16px; font-weight: 900; font-size: 14px; }
          </style>
        </head>
        <body>
          <main>
            <h1>앱을 다시 불러와 주세요</h1>
            <p>네트워크 또는 업데이트 캐시 때문에 잠시 페이지를 열지 못했습니다.</p>
            <button onclick="window.location.reload()">다시 불러오기</button>
          </main>
        </body>
      </html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}
