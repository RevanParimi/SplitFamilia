// SF-031: the Node server serves exactly the app's files, with the headers the Caddyfile set, and
// nothing else. Runs the real server in-process on 127.0.0.1.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, cpSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTestServer, raw, REPO_ROOT } from "./helpers/test-server.js";
import { createApp } from "../server/server.js";

let t;
before(async function(){ t = await startTestServer(); });
after(async function(){ await t.close(); });

// Worked out from the Caddy run in docs/planning/evidence/T-03-caddy-headers.txt.
const EXPECTED_TYPES = {
  "/index.html": "text/html; charset=utf-8",
  "/privacy.html": "text/html; charset=utf-8",
  "/service-worker.js": "text/javascript; charset=utf-8",
  "/money.js": "text/javascript; charset=utf-8",
  "/group-code.js": "text/javascript; charset=utf-8",
  "/sync-status.js": "text/javascript; charset=utf-8",
  "/ledger-rules.js": "text/javascript; charset=utf-8",
  "/ledger-client.js": "text/javascript; charset=utf-8",
  "/outbox.js": "text/javascript; charset=utf-8",
  "/manifest.json": "application/json",
  "/icon-192.png": "image/png",
  "/icon-512.png": "image/png",
  "/apple-touch-icon.png": "image/png",
  "/.well-known/assetlinks.json": "application/json"
};

function assertSecurityHeaders(res, label){
  assert.equal(res.headers["x-content-type-options"], "nosniff", label);
  assert.equal(res.headers["referrer-policy"], "strict-origin-when-cross-origin", label);
  assert.equal(res.headers["server"], undefined, label);
}

test("every app file is served as it is on disk, with the Caddyfile's headers", async function(){
  for(const [path, type] of Object.entries(EXPECTED_TYPES)){
    const res = await raw(t.base, path);
    assert.equal(res.status, 200, path);
    assert.equal(res.headers["content-type"], type, path);
    assert.equal(res.headers["cache-control"], "no-cache", path);
    assertSecurityHeaders(res, path);
    assert.match(res.headers["etag"], /^"[A-Za-z0-9_-]+"$/, path);
    assert.deepEqual(res.body, readFileSync(join(REPO_ROOT, path.slice(1))), path);
  }
});

test("/ and any ?g= invite link get index.html itself, not a redirect", async function(){
  const page = readFileSync(join(REPO_ROOT, "index.html"));
  for(const path of ["/", "/?g=goa-trip-2026", "/index.html?g=goa-trip-7k2m9xqpwd", "/money.js?v=5"]){
    const res = await raw(t.base, path);
    assert.equal(res.status, 200, path);
    if(path !== "/money.js?v=5") assert.deepEqual(res.body, page, path);
  }
});

test("an unchanged file costs a quick 304 on revalidation", async function(){
  const first = await raw(t.base, "/index.html");
  const again = await raw(t.base, "/index.html", { headers: { "If-None-Match": first.headers.etag } });
  assert.equal(again.status, 304);
  assert.equal(again.body.length, 0);
  assert.equal(again.headers.etag, first.headers.etag);
  assert.equal(again.headers["cache-control"], "no-cache");
  assertSecurityHeaders(again, "304");
  const weak = await raw(t.base, "/index.html", { headers: { "If-None-Match": "W/" + first.headers.etag } });
  assert.equal(weak.status, 304);
  const other = await raw(t.base, "/index.html", { headers: { "If-None-Match": "\"something-else\"" } });
  assert.equal(other.status, 200);
});

test("text files are gzipped for browsers that ask, with their own ETag", async function(){
  const plain = await raw(t.base, "/index.html");
  const gz = await raw(t.base, "/index.html", { headers: { "Accept-Encoding": "gzip, deflate, br" } });
  assert.equal(gz.status, 200);
  assert.equal(gz.headers["content-encoding"], "gzip");
  assert.equal(gz.headers["vary"], "Accept-Encoding");
  assert.ok(gz.body.length < plain.body.length / 2);
  assert.deepEqual(gunzipSync(gz.body), plain.body);
  assert.notEqual(gz.headers.etag, plain.headers.etag);
  const revalidated = await raw(t.base, "/index.html", { headers: { "Accept-Encoding": "gzip", "If-None-Match": gz.headers.etag } });
  assert.equal(revalidated.status, 304);
  // gzip;q=0 means "not gzip"; images are never gzipped.
  const refused = await raw(t.base, "/index.html", { headers: { "Accept-Encoding": "gzip;q=0, br" } });
  assert.equal(refused.headers["content-encoding"], undefined);
  const half = await raw(t.base, "/index.html", { headers: { "Accept-Encoding": "gzip;q=0.5" } });
  assert.equal(half.headers["content-encoding"], "gzip");
  const png = await raw(t.base, "/icon-192.png", { headers: { "Accept-Encoding": "gzip" } });
  assert.equal(png.headers["content-encoding"], undefined);
});

test("HEAD gives the headers without the body; other methods are refused", async function(){
  const head = await raw(t.base, "/index.html", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(head.headers["content-type"], "text/html; charset=utf-8");
  const post = await raw(t.base, "/index.html", { method: "POST", body: "x" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, "GET, HEAD");
  assertSecurityHeaders(post, "405");
});

test("nothing but the app's files is served: 404 with the same headers", async function(){
  const notServed = [
    "/docs/planning/STATE.json", "/docs/", "/tests/wiring.test.js", "/package.json", "/package-lock.json",
    "/firestore.rules", "/firebase.json", "/Dockerfile", "/.dockerignore", "/.gitignore", "/.git/config",
    "/README.md", "/CLAUDE.md", "/railway.json", "/server/main.js", "/server/server.js", "/server/db.js",
    "/server/", "/data/splitfamilia.db", "/data/", "/node_modules/firebase/package.json",
    "/.well-known/", "/.well-known/other.json", "/.env",
    "/../package.json", "/%2e%2e/package.json", "/%2e%2e/", "/..%2fpackage.json", "/%2E%2E/%2E%2E/package.json",
    "/./package.json", "/%2e/index.html", "/.%2E/", "/x/../index.html", "/..", "/index.html/", "/INDEX.HTML", "/index.html%00", "/icon-192.png.bak", "//package.json",
    "/api", "/api/", "/api/groups", "/api/group/list"
  ];
  for(const path of notServed){
    const res = await raw(t.base, path);
    assert.equal(res.status, 404, path);
    assert.equal(res.headers["x-content-type-options"], "nosniff", path);
    assert.equal(res.headers["referrer-policy"], "strict-origin-when-cross-origin", path);
    assert.ok(res.headers["cache-control"], path);
    const text = res.body.toString("utf8");
    assert.doesNotMatch(text, /"name": "splitfamilia"|rules_version|SQLite format/, path);
  }
});

test("a request whose target isn't a path gets 400", async function(){
  for(const target of ["*", "http://example.invalid/index.html"]){
    const res = await raw(t.base, target);
    assert.equal(res.status, 400, target);
    assertSecurityHeaders(res, target);
  }
});

test("/healthz answers 200 and says whether the database is open", async function(){
  const res = await raw(t.base, "/healthz");
  assert.equal(res.status, 200);
  assert.equal(res.headers["cache-control"], "no-store");
  assertSecurityHeaders(res, "/healthz");
  assert.deepEqual(JSON.parse(res.body.toString("utf8")), { status: "ok", database: "ok", storage: "local" });
});

test("a missing app file stops the server from starting (so Railway keeps the last good deploy)", function(){
  const dir = mkdtempSync(join(tmpdir(), "splitfamilia-missing-"));
  try{
    for(const path of Object.keys(EXPECTED_TYPES)){
      cpSync(join(REPO_ROOT, path.slice(1)), join(dir, path.slice(1)));
    }
    rmSync(join(dir, "sync-status.js"));
    assert.throws(function(){ createApp({ root: dir, dbFile: join(dir, "x.db"), log: function(){} }); }, /ENOENT/);
  }finally{
    rmSync(dir, { recursive: true, force: true });
  }
});
