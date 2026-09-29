// Guards the wiring: the page uses the modules instead of its own copies, phones cache every
// file the page imports under the same version number as the service worker's cache, the
// Docker image ships those files, and the Firestore rules keep the app's own limits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_AMOUNT_PAISE } from "../money.js";
import { MAX_GROUP_ID_LENGTH, isValidGroupId } from "../group-code.js";

const read = function(name){ return readFileSync(new URL("../" + name, import.meta.url), "utf8"); };

// Local imports in index.html, e.g. ["./group-code.js?v=5", "./money.js?v=5", …].
function localImports(html){
  return [...html.matchAll(/from "(\.\/[^"]+)";/g)].map(function(m){ return m[1]; }).sort();
}
// The service worker's SHELL entries ("./…") and SDK entries ("https://…").
function swList(sw, name){
  const body = new RegExp("const " + name + " = \\[([^\\]]*)\\];").exec(sw)[1];
  return [...body.matchAll(/"([^"]+)"/g)].map(function(m){ return m[1]; });
}
// The files the Dockerfile copies into the image, by their path on the site.
function dockerFiles(dockerfile){
  const files = [];
  dockerfile.split(/\r?\n/).forEach(function(line){
    const m = /^COPY\s+(.+)$/.exec(line.trim());
    if(!m) return;
    const parts = m[1].trim().split(/\s+/);
    const dest = parts.pop();
    if(!dest.startsWith("/srv/")) return;
    if(dest.endsWith("/")) parts.forEach(function(p){ files.push(dest.slice("/srv/".length) + p); });
    else files.push(dest.slice("/srv/".length));
  });
  return files;
}

test("index.html imports the balance maths from money.js instead of defining it", function(){
  const html = read("index.html");
  assert.match(html, /import \{[^}]*\bcomputeBalances\b[^}]*\bsimplifyDebts\b[^}]*\} from "\.\/money\.js\?v=\d+";/);
  assert.doesNotMatch(html, /function computeBalances\(/);
  assert.doesNotMatch(html, /function simplifyDebts\(/);
  assert.doesNotMatch(html, /parseFloat\(/);
});

test("index.html takes group codes from group-code.js instead of defining them", function(){
  const html = read("index.html");
  assert.match(html, /import \{[^}]*\bisValidGroupId\b[^}]*\} from "\.\/group-code\.js\?v=\d+";/);
  assert.doesNotMatch(html, /function slugify\(/);
  assert.doesNotMatch(html, /Math\.random/);
});

test("index.html shows errors through sync-status.js, never Firestore's own message", function(){
  const html = read("index.html");
  assert.match(html, /import \{[^}]*\bfriendlyError\b[^}]*\} from "\.\/sync-status\.js\?v=\d+";/);
  assert.doesNotMatch(html, /\.message\b/);
});

test("module imports carry the cache version, and the service worker caches exactly those URLs", function(){
  // If index.html got a new module but a phone's old service worker served an old cached copy,
  // the page would break or show wrong numbers. So each release imports "?v=N" with N from the
  // cache name, and the service worker caches those exact URLs.
  const html = read("index.html");
  const sw = read("service-worker.js");
  const version = /const CACHE = "splitsheet-v(\d+)";/.exec(sw)[1];
  const imports = localImports(html);
  assert.deepEqual(imports, ["./group-code.js", "./money.js", "./sync-status.js"].map(function(p){ return p + "?v=" + version; }));
  const shell = swList(sw, "SHELL");
  imports.forEach(function(path){ assert.ok(shell.includes(path), path + " is not in SHELL"); });
  assert.ok(shell.includes("./index.html"));
});

test("the service worker keeps exactly the Firebase SDK files the page imports (SF-008)", function(){
  const html = read("index.html");
  const sw = read("service-worker.js");
  const pageSdk = [...html.matchAll(/from "(https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+)";/g)].map(function(m){ return m[1]; }).sort();
  assert.equal(pageSdk.length, 2);
  assert.deepEqual(swList(sw, "SDK").slice().sort(), pageSdk);
});

test("the Docker image ships every file the service worker caches, and .dockerignore lets them in (SF-011)", function(){
  const shipped = dockerFiles(read("Dockerfile"));
  const allowed = read(".dockerignore").split(/\r?\n/).filter(function(l){ return l.startsWith("!"); }).map(function(l){ return l.slice(1); });
  const needed = swList(read("service-worker.js"), "SHELL").map(function(p){ return p.replace(/^\.\//, "").replace(/\?.*$/, ""); })
    .concat(["apple-touch-icon.png", ".well-known/assetlinks.json"]);
  needed.forEach(function(f){
    assert.ok(shipped.includes(f), f + " is not copied by the Dockerfile");
    assert.ok(allowed.includes(f), f + " is not let in by .dockerignore");
  });
  shipped.forEach(function(f){ assert.ok(allowed.includes(f), f + " is copied but .dockerignore keeps it out"); });
  assert.ok(allowed.includes("Caddyfile"));
  // Nothing but the app: no docs, tests, tooling, rules or secrets.
  shipped.forEach(function(f){ assert.doesNotMatch(f, /^(docs|tests|node_modules|android)\/|\.md$|^package|^firebase|^firestore|\.env/); });
});

test("shipped files use HTTPS only: no localhost and no plain http:// URLs (SF-011)", function(){
  dockerFiles(read("Dockerfile")).filter(function(f){ return !f.endsWith(".png"); }).forEach(function(f){
    const text = read(f);
    assert.doesNotMatch(text, /http:\/\//, f);
    assert.doesNotMatch(text, /localhost|127\.0\.0\.1/, f);
  });
});

test("the Firestore rules keep the app's limits (SF-007)", function(){
  const rules = read("firestore.rules");
  // Amount: MAX_AMOUNT_PAISE in rupees.
  assert.match(rules, new RegExp("data\\.amount <= " + (MAX_AMOUNT_PAISE / 100) + "\\b"));
  // Group codes: the same length and pattern as group-code.js.
  assert.match(rules, new RegExp("gid\\.size\\(\\) <= " + MAX_GROUP_ID_LENGTH + " "));
  const pattern = /gid\.matches\('([^']+)'\)/.exec(rules)[1];
  const re = new RegExp(pattern);
  for(const code of ["goa-trip-2026", "goa-trip-7k2m9xqpwd", "a", "a1-b2-c3", "Goa", "goa--trip", "-goa", "goa-", "goa_trip", "goa trip", ""]){
    const byRules = re.test(code) && code.length <= MAX_GROUP_ID_LENGTH;
    assert.equal(byRules, isValidGroupId(code), JSON.stringify(code));
  }
  // The page's inputs never let through more than the rules accept.
  const html = read("index.html");
  const maxlength = function(id){ return Number(new RegExp('id="' + id + '"[^>]*maxlength="(\\d+)"').exec(html)[1]); };
  assert.match(rules, new RegExp("stringOfLength\\(data\\.name, 1, " + maxlength("person-name") + "\\)"));
  assert.match(rules, new RegExp("stringOfLength\\(data\\.desc, 1, " + maxlength("exp-desc") + "\\)"));
  assert.match(rules, new RegExp("stringOfLength\\(data\\.currency, 1, " + maxlength("currency-input") + "\\)"));
});

test("the app is called SplitFamilia, and installed copies keep their identity (SF-010, SF-011)", function(){
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.name, "SplitFamilia");
  assert.equal(manifest.short_name, "SplitFamilia");
  // Changing these would make phones treat the app as a new one, or break invite links.
  assert.equal(manifest.id, "/splitsheet/");
  assert.equal(manifest.start_url, "./index.html");
  assert.equal(manifest.scope, "./");
  const html = read("index.html");
  assert.match(html, /<title>SplitFamilia<\/title>/);
  assert.match(html, /name="apple-mobile-web-app-title" content="SplitFamilia"/);
  assert.doesNotMatch(html, /Splitsheet/);
  // Renaming these would log every phone out of its group or orphan its cache.
  assert.match(html, /const GROUP_KEY = "splitsheet-group";/);
  assert.match(read("service-worker.js"), /const CACHE = "splitsheet-v\d+";/);
});

test("assetlinks.json names the Android app, with real or clearly marked fingerprints (SF-011)", function(){
  const links = JSON.parse(read(".well-known/assetlinks.json"));
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(links[0].target.namespace, "android_app");
  assert.equal(links[0].target.package_name, "com.splitfamilia.app");
  // Each is a placeholder such as <UPLOAD_KEY_SHA256> or a real SHA-256 fingerprint (AB:CD:…).
  // SF-021 fails the release while a placeholder remains.
  const prints = links[0].target.sha256_cert_fingerprints;
  assert.equal(prints.length, 2);
  prints.forEach(function(p){ assert.match(p, /^(<[A-Z0-9_]+>|([0-9A-F]{2}:){31}[0-9A-F]{2})$/, p); });
});
