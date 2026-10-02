const CACHE = "splitsheet-v8";
// The page imports its modules as "./name.js?v=N", where N is the number in CACHE (npm test
// checks this). So a new page never runs with an old cached copy of a module, and an old page
// never gets a new one: bump both together.
const SHELL = [
  "./index.html",
  "./money.js?v=8",
  "./group-code.js?v=8",
  "./sync-status.js?v=8",
  "./ledger-rules.js?v=8",
  "./ledger-client.js?v=8",
  "./outbox.js?v=8",
  "./recent-groups.js?v=8",
  "./privacy.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];
// Every open of the app is the same index.html, whatever its ?g=. It is cached once, under this
// URL, so the cache doesn't grow with each invite link and holds no group codes. It is also
// fetched under this URL, so an invite link's code doesn't reach the server's request log each
// time the worker checks for a newer page.
const PAGE = new URL("./index.html", self.location).href;
const PAGE_PATHS = [new URL("./", self.location).pathname, new URL(PAGE).pathname];
// The ledger API: never cached, and never answered by the worker (SF-035). The page's own copy of
// its group lives in IndexedDB (outbox.js), and the live stream must go straight to the server.
const API_PREFIX = new URL("./api/", self.location).pathname;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // "reload" skips the browser's HTTP cache, so the new cache never starts with old copies.
      .then((cache) => cache.addAll(SHELL.map((path) => new Request(path, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function keep(key, res) {
  caches.open(CACHE).then((cache) => cache.put(key, res));
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Other sites (Google Fonts) and the API go straight to the network.
  if (url.origin !== self.location.origin) return;
  if (url.pathname === API_PREFIX.slice(0, -1) || url.pathname.startsWith(API_PREFIX)) return;

  const isPage = PAGE_PATHS.includes(url.pathname);
  const key = isPage ? PAGE : e.request;
  e.respondWith(
    caches.match(key).then((cached) => {
      // A versioned module ("?v=N") never changes, so a cached copy is final.
      if (cached && url.searchParams.has("v")) return cached;
      const network = fetch(isPage ? PAGE : e.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic" && !res.redirected) keep(key, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
