/* POR POR TOPUP — service worker (makes the site installable + offline fallback).
 * Safety rules: NEVER touches /api, admin pages, uploads or non-GET requests,
 * so payments, orders and admin data are always live from the network. */
const VERSION = "pp-2026-11-21-icon-fix";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/favicon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // cache: "reload" forces a real network fetch for the precache list so a
      // changed favicon/icon is picked up even if an intermediate HTTP cache
      // would otherwise have served the old bytes.
      .then((c) => Promise.all(PRECACHE.map((url) => fetch(url, { cache: "reload" }).then((res) => res.ok && c.put(url, res)))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/uploads")) return;

  // Pages: always network first; only show the offline page if the network is down.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Hashed build assets (filenames change on every build): cache first is safe.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Icons / favicon / other static svgs keep the SAME filename across deploys,
  // so cache-first would serve a stale icon forever once it's cached once.
  // Stale-while-revalidate: show the cached one instantly, but always refetch
  // in the background and update the cache, so the NEXT load gets the new icon.
  if (url.pathname.startsWith("/icons/") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".png")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        return hit || (await network) || fetch(req);
      }),
    );
  }
});
