// Runs the real service-worker.js in a sandbox with a fake cache and a fake network, and checks
// what it does (SF-008, the T-02 review's F-4, and SF-035). No browser and no real network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const ORIGIN = "https://splitfamilia.up.railway.app";
const VERSION = /const CACHE = "splitsheet-v(\d+)";/.exec(SOURCE)[1];
const CACHE = "splitsheet-v" + VERSION;

function response(body, extra){
  return Object.assign({
    body: body, status: 200, ok: true, type: "basic", redirected: false,
    clone: function(){ return Object.assign({}, this); }
  }, extra);
}

// A fresh worker. `files` maps a file's URL (no query) to the body the network serves; `online` switches the
// whole network on or off. Returns the worker's handlers and the fakes to inspect.
function loadWorker(files){
  const net = { online: true, files: Object.assign({}, files), redirects: new Set(), log: [] };
  const handlers = {};
  const stores = new Map();

  class Request {
    constructor(input, init){
      const from = typeof input === "string" ? null : input;
      this.url = new URL(from ? from.url : input, ORIGIN + "/service-worker.js").href;
      this.method = (init && init.method) || (from && from.method) || "GET";
      this.mode = (init && init.mode) || (from && from.mode) || "cors";
      this.cache = (init && init.cache) || (from && from.cache) || "default";
    }
  }
  const keyOf = function(req){ return typeof req === "string" ? new URL(req, ORIGIN + "/").href : req.url; };

  function fetch(req){
    const r = typeof req === "string" ? new Request(req) : req;
    net.log.push({ url: r.url, cache: r.cache });
    if(!net.online) return Promise.reject(new TypeError("Failed to fetch"));
    // Like a static file server: the query is ignored, and "/" is index.html.
    const url = new URL(r.url);
    const path = url.origin + (url.pathname === "/" ? "/index.html" : url.pathname);
    const body = net.files[path];
    if(body === undefined) return Promise.resolve(response("", { status: 404, ok: false }));
    return Promise.resolve(response(body, { type: url.origin === ORIGIN ? "basic" : "cors", redirected: net.redirects.has(path) }));
  }

  function open(name){
    if(!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      put: function(req, res){ store.set(keyOf(req), res); return Promise.resolve(); },
      match: function(req){ return Promise.resolve(store.get(keyOf(req))); },
      addAll: function(reqs){
        return Promise.all(reqs.map(function(req){
          return fetch(typeof req === "string" ? new Request(req) : req).then(function(res){
            if(!res.ok) throw new TypeError("addAll: " + res.status);
            return [keyOf(req), res];
          });
        })).then(function(pairs){ pairs.forEach(function(p){ store.set(p[0], p[1]); }); });
      }
    };
  }
  const caches = {
    open: function(name){ return Promise.resolve(open(name)); },
    match: function(req){
      for(const store of stores.values()){ if(store.has(keyOf(req))) return Promise.resolve(store.get(keyOf(req))); }
      return Promise.resolve(undefined);
    },
    keys: function(){ return Promise.resolve([...stores.keys()]); },
    delete: function(name){ return Promise.resolve(stores.delete(name)); }
  };
  const self = {
    location: new URL(ORIGIN + "/service-worker.js"),
    addEventListener: function(type, fn){ handlers[type] = fn; },
    skipWaiting: function(){ return Promise.resolve(); },
    clients: { claim: function(){ return Promise.resolve(); } }
  };
  vm.runInNewContext(SOURCE, { self, caches, fetch, Request, URL, Promise, TypeError });

  const settle = async function(){ for(let i = 0; i < 5; i++) await new Promise(function(r){ setImmediate(r); }); };
  return {
    net, stores, Request, settle,
    cached: function(url){ const s = stores.get(CACHE); return s && s.get(new URL(url, ORIGIN + "/").href); },
    cacheKeys: function(){ return [...(stores.get(CACHE) || new Map()).keys()]; },
    install: async function(){ const ev = { waitUntil: function(p){ this.p = p; } }; handlers.install(ev); await ev.p; },
    activate: async function(){ const ev = { waitUntil: function(p){ this.p = p; } }; handlers.activate(ev); await ev.p; },
    // Dispatches a fetch; returns { handled, res } once the background work has settled.
    request: async function(url, init){
      const ev = { request: new Request(new URL(url, ORIGIN + "/").href, init), respondWith: function(p){ this.p = p; } };
      handlers.fetch(ev);
      const res = ev.p ? await ev.p : undefined;
      await settle();
      return { handled: !!ev.p, res: res };
    }
  };
}

const SHELL_FILES = ["index.html", "money.js?v=" + VERSION, "group-code.js?v=" + VERSION, "sync-status.js?v=" + VERSION,
  "ledger-rules.js?v=" + VERSION, "ledger-client.js?v=" + VERSION, "outbox.js?v=" + VERSION,
  "manifest.json", "icon-192.png", "icon-512.png"];
function site(pageBody){
  const files = {};
  SHELL_FILES.forEach(function(f){ files[ORIGIN + "/" + f.replace(/\?.*$/, "")] = f === "index.html" ? pageBody : "file " + f; });
  files[ORIGIN + "/privacy.html"] = "privacy";
  files[ORIGIN + "/api/group"] = "a group";
  return files;
}

async function installed(pageBody){
  const w = loadWorker(site(pageBody || "page v" + VERSION));
  await w.install();
  await w.activate();
  w.net.log.length = 0;
  return w;
}

// ---------- install ----------

test("install fetches the app's own files past the browser's HTTP cache (cache: 'reload')", async function(){
  const w = loadWorker(site("page"));
  await w.install();
  const own = w.net.log.filter(function(e){ return e.url.startsWith(ORIGIN); });
  assert.equal(own.length, SHELL_FILES.length);
  own.forEach(function(e){ assert.equal(e.cache, "reload", e.url + " was fetched with cache: " + e.cache); });
});

test("install caches the shell and nothing from another site, so the app can start offline", async function(){
  const w = loadWorker(site("page"));
  await w.install();
  SHELL_FILES.forEach(function(f){ assert.ok(w.cached(f), f + " is not cached"); });
  w.cacheKeys().forEach(function(k){ assert.ok(k.startsWith(ORIGIN + "/"), k); });
  assert.equal(w.cacheKeys().length, SHELL_FILES.length);
});

test("activate removes every older cache", async function(){
  const w = loadWorker(site("page"));
  w.stores.set("splitsheet-v4", new Map([[ORIGIN + "/index.html", response("old")]]));
  await w.install();
  await w.activate();
  assert.deepEqual([...w.stores.keys()], [CACHE]);
});

// ---------- versioned modules (F-4) ----------

test("a cached ?v= module is final: served from the cache and never refetched or replaced", async function(){
  const w = await installed();
  const url = ORIGIN + "/money.js?v=" + VERSION;
  w.stores.get(CACHE).set(url, response("money as first cached"));
  w.net.files[ORIGIN + "/money.js"] = "money changed on the server";
  const r = await w.request(url);
  assert.equal(r.res.body, "money as first cached");
  assert.equal(w.cached(url).body, "money as first cached");
  assert.deepEqual(w.net.log.map(function(e){ return e.url; }), []);
});

test("an unversioned file is served from the cache and refreshed in the background", async function(){
  const w = await installed();
  w.net.files[ORIGIN + "/manifest.json"] = "manifest v2";
  const r = await w.request(ORIGIN + "/manifest.json");
  assert.equal(r.res.body, "file manifest.json");
  assert.equal(w.cached("manifest.json").body, "manifest v2");
});

// ---------- the page: one cached copy, whatever the invite link ----------

test("every open of the app is answered from one cached index.html, and no group code lands in the cache", async function(){
  const w = await installed("page A");
  for(const path of ["/index.html?g=goa-trip-2026", "/?g=goa-trip-7k2m9xqpwd", "/", "/index.html"]){
    const r = await w.request(ORIGIN + path, { mode: "navigate" });
    assert.equal(r.res.body, "page A", path);
  }
  const keys = w.cacheKeys();
  assert.equal(keys.filter(function(k){ return k.includes("?g="); }).length, 0, keys.join(", "));
  assert.equal(keys.filter(function(k){ return new URL(k).pathname === "/"; }).length, 0);
});

test("the page's background refresh updates the one cached copy for the next open", async function(){
  const w = await installed("page A");
  w.net.files[ORIGIN + "/index.html"] = "page B";
  const first = await w.request(ORIGIN + "/index.html?g=goa-trip-2026", { mode: "navigate" });
  assert.equal(first.res.body, "page A");
  assert.equal(w.cached("index.html").body, "page B");
  const second = await w.request(ORIGIN + "/index.html?g=goa-trip-2026", { mode: "navigate" });
  assert.equal(second.res.body, "page B");
});

test("offline, the page and every module come from the cache", async function(){
  const w = await installed("page A");
  w.net.online = false;
  assert.equal((await w.request(ORIGIN + "/index.html?g=new-group-2222222222", { mode: "navigate" })).res.body, "page A");
  for(const f of SHELL_FILES.filter(function(x){ return x.includes("?v="); })){
    assert.equal((await w.request(ORIGIN + "/" + f)).res.body, "file " + f);
  }
});

test("the page is fetched from the network without its ?g=, so an invite code doesn't reach the server's log", async function(){
  const w = await installed("page A");
  for(const path of ["/index.html?g=goa-trip-2026", "/?g=goa-trip-7k2m9xqpwd"]){
    await w.request(ORIGIN + path, { mode: "navigate" });
  }
  assert.ok(w.net.log.length >= 2);
  w.net.log.forEach(function(e){
    assert.doesNotMatch(e.url, /goa-trip/, e.url);
    assert.equal(e.url, ORIGIN + "/index.html");
  });
});

test("a redirected response is never kept as the page (a browser refuses it for a navigation)", async function(){
  const w = await installed("page A");
  w.net.files[ORIGIN + "/index.html"] = "a page reached through a redirect";
  w.net.redirects.add(ORIGIN + "/index.html");
  await w.request(ORIGIN + "/index.html?g=goa-trip-2026", { mode: "navigate" });
  assert.equal(w.cached("index.html").body, "page A");
});

test("other pages on the site are cached as themselves, not as the app page", async function(){
  const w = await installed("page A");
  const r = await w.request(ORIGIN + "/privacy.html", { mode: "navigate" });
  assert.equal(r.res.body, "privacy");
  assert.equal(w.cached("privacy.html").body, "privacy");
});

// ---------- left alone ----------

test("the API is never answered by the worker, and never cached, online or offline (SF-035)", async function(){
  const w = await installed();
  for(const path of ["/api/group", "/api/group/events", "/api", "/api/expenses/e1"]){
    assert.equal((await w.request(ORIGIN + path)).handled, false, path);
  }
  w.net.online = false;
  assert.equal((await w.request(ORIGIN + "/api/group")).handled, false);
  assert.equal(w.cacheKeys().filter(function(k){ return k.includes("/api"); }).length, 0);
  // A file that only starts like the API is still the app's.
  assert.equal((await w.request(ORIGIN + "/apiary.html")).handled, true);
});

test("other sites (the fonts) and non-GET requests go straight to the network", async function(){
  const w = await installed();
  for(const url of [
    "https://fonts.googleapis.com/css2?family=Inter",
    "https://example.com/x.js"
  ]){
    assert.equal((await w.request(url)).handled, false, url);
  }
  assert.equal((await w.request(ORIGIN + "/index.html", { method: "POST" })).handled, false);
  assert.equal((await w.request(ORIGIN + "/api/expenses", { method: "POST" })).handled, false);
});
