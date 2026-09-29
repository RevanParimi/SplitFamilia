const CACHE = "splitsheet-v5";
// The page imports its modules as "./name.js?v=N", where N is the number in CACHE (npm test
// checks this). So a new page never runs with an old cached copy of a module, and an old page
// never gets a new one: bump both together.
const SHELL = [
  "./index.html",
  "./money.js?v=5",
  "./group-code.js?v=5",
  "./sync-status.js?v=5",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];
// The Firebase SDK files the page imports (firebase-firestore.js imports firebase-app.js). Their
// URLs name the version, so they never change: once cached they are used for good, and the app
// can start with no connection (SF-008). npm test checks this list against the page's imports.
const SDK = [
  "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js",
  "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js"
];
// Every open of the app is the same index.html, whatever its ?g=. It is cached once, under this
// URL, so the cache doesn't grow with each invite link and holds no group codes.
const PAGE = new URL("./index.html", self.location).href;
const PAGE_PATHS = [new URL("./", self.location).pathname, new URL(PAGE).pathname];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(
        // "reload" skips the browser's HTTP cache, so the new cache never starts with old copies.
        // The SDK files may come from it: the page has just loaded them, and they never change.
        SHELL.map((path) => new Request(path, { cache: "reload" })).concat(SDK)
      ))
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

  // The Firebase SDK: from the cache when it's there, otherwise fetched once and kept.
  if (SDK.includes(url.href)) {
    e.respondWith(
      caches.match(url.href, { ignoreVary: true }).then((cached) => cached || fetch(e.request).then((res) => {
        if (res && res.ok) keep(url.href, res.clone());
        return res;
      }))
    );
    return;
  }

  // Every other cross-origin request (Firestore's connections, Google Fonts) goes straight to the
  // network.
  if (url.origin !== self.location.origin) return;

  const key = PAGE_PATHS.includes(url.pathname) ? PAGE : e.request;
  e.respondWith(
    caches.match(key).then((cached) => {
      // A versioned module ("?v=N") never changes, so a cached copy is final.
      if (cached && url.searchParams.has("v")) return cached;
      const network = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic" && !res.redirected) keep(key, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
