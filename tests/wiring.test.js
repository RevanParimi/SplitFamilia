// Guards the wiring: the page uses the modules instead of its own copies, phones cache every
// file the page imports under the same version number as the service worker's cache, the server
// serves exactly those files, the Docker image ships them and the server's own code, nothing
// shipped depends on Firebase any more, and ledger-rules.js keeps the app's own limits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { MAX_AMOUNT_PAISE } from "../money.js";
import * as ledgerRules from "../ledger-rules.js";
import { STATIC_FILES } from "../server/static.js";

const read = function(name){ return readFileSync(new URL("../" + name, import.meta.url), "utf8"); };

// Local imports in index.html, e.g. ["./group-code.js?v=5", "./money.js?v=5", …].
function localImports(html){
  return [...html.matchAll(/from "(\.\/[^"]+)";/g)].map(function(m){ return m[1]; }).sort();
}
// The service worker's SHELL entries ("./…").
function swList(sw, name){
  const body = new RegExp("const " + name + " = \\[([^\\]]*)\\];").exec(sw)[1];
  return [...body.matchAll(/"([^"]+)"/g)].map(function(m){ return m[1]; });
}
// The files the Dockerfile copies into the image, by their path under /app. Each lands at the same
// path as in the repo, so the server's imports work the same in both.
function dockerFiles(dockerfile){
  const files = [];
  dockerfile.split(/\r?\n/).forEach(function(line){
    const m = /^COPY\s+(.+)$/.exec(line.trim());
    if(!m) return;
    const parts = m[1].trim().split(/\s+/);
    const dest = parts.pop();
    assert.ok(dest.startsWith("/app/"), line);
    const target = dest.slice("/app/".length);
    parts.forEach(function(p){
      const path = target.endsWith("/") || target === "" ? target + p.split("/").pop() : target;
      assert.equal(path, p, "the Dockerfile copies " + p + " to a different path");
      files.push(path);
    });
  });
  return files;
}
// The relative imports of a module, as repo paths: server/api.js's "../money.js" → "money.js".
function relativeImports(file){
  const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "";
  return [...read(file).matchAll(/from "(\.{1,2}\/[^"]+)";/g)].map(function(m){
    return new URL(m[1], "https://repo.invalid/" + dir).pathname.slice(1);
  });
}
const serverFiles = function(){
  return readdirSync(new URL("../server/", import.meta.url)).filter(function(f){ return f.endsWith(".js"); }).map(function(f){ return "server/" + f; });
};

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

test("index.html shows errors through sync-status.js, never the server's own message", function(){
  const html = read("index.html");
  assert.match(html, /import \{[^}]*\bfriendlyError\b[^}]*\} from "\.\/sync-status\.js\?v=\d+";/);
  assert.doesNotMatch(html, /\.message\b/);
});

test("index.html shows form checks under their fields: no alert() or confirm() pop-ups (SF-028)", function(){
  const html = read("index.html");
  assert.doesNotMatch(html, /\balert\(/);
  assert.doesNotMatch(html, /\bconfirm\(/);
  // Deleting asks first in the page's own dialog, and the form errors have their places.
  assert.match(html, /<dialog class="confirm" id="confirm" role="alertdialog"/);
  ["exp-desc-error", "exp-amount-error", "split-error", "person-error", "new-group-error", "join-error", "pay-amount-error"].forEach(function(id){
    assert.match(html, new RegExp('id="' + id + '"'), id);
  });
});

test("module imports carry the cache version, and the service worker caches exactly those URLs", function(){
  // If index.html got a new module but a phone's old service worker served an old cached copy,
  // the page would break or show wrong numbers. So each release imports "?v=N" with N from the
  // cache name, and the service worker caches those exact URLs.
  const html = read("index.html");
  const sw = read("service-worker.js");
  const version = /const CACHE = "splitsheet-v(\d+)";/.exec(sw)[1];
  const imports = localImports(html);
  assert.deepEqual(imports, ["./group-code.js", "./ledger-client.js", "./ledger-rules.js", "./money.js", "./outbox.js", "./recent-groups.js", "./sync-status.js"]
    .map(function(p){ return p + "?v=" + version; }));
  const shell = swList(sw, "SHELL");
  imports.forEach(function(path){ assert.ok(shell.includes(path), path + " is not in SHELL"); });
  assert.ok(shell.includes("./index.html"));
});

test("every module the page imports imports nothing, so one ?v= covers it (SF-035)", function(){
  // A module importing "./money.js" would load a second copy without ?v=, which the service
  // worker doesn't keep: the app could then start offline with a module missing.
  localImports(read("index.html")).forEach(function(p){
    const file = p.replace(/^\.\//, "").replace(/\?.*$/, "");
    assert.deepEqual(relativeImports(file), [], file);
    assert.doesNotMatch(read(file), /^\s*import\b/m, file);
  });
});

test("nothing shipped mentions Firebase, Firestore or gstatic, and the page talks only to its own server (SF-035, SF-038)", function(){
  dockerFiles(read("Dockerfile")).filter(function(f){ return !f.endsWith(".png"); }).forEach(function(f){
    assert.doesNotMatch(read(f), /firebase|firestore|gstatic/i, f);
  });
  assert.doesNotMatch(read("service-worker.js"), /const SDK\b/);
  // The only other site the page names is Google Fonts (until SF-025 serves the fonts itself).
  const hosts = [...read("index.html").matchAll(/https:\/\/([^/"'\s]+)/g)].map(function(m){ return m[1]; });
  assert.ok(hosts.length > 0);
  hosts.forEach(function(h){ assert.equal(h, "fonts.googleapis.com", h); });
});

test("the server serves exactly the files phones cache, plus the worker, the iPhone icon and assetlinks.json (SF-031)", function(){
  const shell = swList(read("service-worker.js"), "SHELL").map(function(p){ return "/" + p.replace(/^\.\//, "").replace(/\?.*$/, ""); });
  const expected = shell.concat(["/service-worker.js", "/apple-touch-icon.png", "/.well-known/assetlinks.json"]).sort();
  assert.deepEqual(Object.keys(STATIC_FILES).sort(), expected);
});

test("the Docker image ships every file the server serves or imports, and .dockerignore lets them in (SF-011, SF-031)", function(){
  const shipped = dockerFiles(read("Dockerfile"));
  const allowed = read(".dockerignore").split(/\r?\n/).filter(function(l){ return l.startsWith("!"); }).map(function(l){ return l.slice(1); });
  const served = Object.keys(STATIC_FILES).map(function(p){ return p.slice(1); });
  const server = serverFiles();
  const imported = server.flatMap(relativeImports);
  assert.ok(server.includes("server/main.js"));
  assert.ok(imported.includes("ledger-rules.js") && imported.includes("group-code.js"));
  served.concat(server, imported).forEach(function(f){
    assert.ok(shipped.includes(f), f + " is not copied by the Dockerfile");
    assert.ok(allowed.includes(f), f + " is not let in by .dockerignore");
  });
  // The modules those modules import are shipped too (ledger-rules.js imports nothing).
  imported.forEach(function(f){ relativeImports(f).forEach(function(g){ assert.ok(shipped.includes(g), g + " (imported by " + f + ") is not shipped"); }); });
  shipped.forEach(function(f){ assert.ok(allowed.includes(f), f + " is copied but .dockerignore keeps it out"); });
  // Nothing but the app: no docs, tests, tooling, rules, local data or secrets.
  shipped.forEach(function(f){ assert.doesNotMatch(f, /^(docs|tests|node_modules|android|data)\/|\.md$|^package|^firebase|^firestore|\.env|Caddyfile/); });
});

test("the image runs the Node server on node:24 Alpine, checked at /healthz; Caddy is gone (SF-031)", function(){
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /^FROM node:24(\.\d+){0,2}-alpine\s*$/m);
  assert.match(dockerfile, /^CMD \["node", "server\/main\.js"\]\s*$/m);
  assert.match(dockerfile, /^RUN echo '\{ "type": "module" \}' > \/app\/package\.json\s*$/m);
  assert.equal(existsSync(new URL("../Caddyfile", import.meta.url)), false);
  assert.doesNotMatch(read(".dockerignore"), /Caddyfile/);
  const railway = JSON.parse(read("railway.json"));
  assert.equal(railway.deploy.healthcheckPath, "/healthz");
  assert.ok(railway.build.watchPatterns.includes("/server/**"));
  assert.ok(!railway.build.watchPatterns.includes("/Caddyfile"));
  assert.equal(JSON.parse(read("package.json")).scripts.start, "node server/main.js");
  // Only Node's own modules: nothing to install in the image.
  serverFiles().forEach(function(f){
    [...read(f).matchAll(/from "([^"]+)";/g)].forEach(function(m){
      assert.match(m[1], /^(node:|\.\.?\/)/, f + " imports " + m[1]);
    });
  });
});

test("shipped files use HTTPS only: no localhost and no plain http:// URLs (SF-011)", function(){
  dockerFiles(read("Dockerfile")).filter(function(f){ return !f.endsWith(".png"); }).forEach(function(f){
    const text = read(f);
    assert.doesNotMatch(text, /http:\/\//, f);
    assert.doesNotMatch(text, /localhost|127\.0\.0\.1/, f);
  });
});

test("the page's inputs and ledger-rules.js keep the same limits, and the amount limit is money.js's (SF-033)", function(){
  const html = read("index.html");
  const maxlength = function(id){ return Number(new RegExp('id="' + id + '"[^>]*maxlength="(\\d+)"').exec(html)[1]); };
  assert.equal(maxlength("person-name"), ledgerRules.MAX_NAME_LENGTH);
  assert.equal(maxlength("exp-desc"), ledgerRules.MAX_DESC_LENGTH);
  assert.equal(maxlength("currency-input"), ledgerRules.MAX_CURRENCY_LENGTH);
  assert.equal(ledgerRules.MAX_AMOUNT_PAISE, MAX_AMOUNT_PAISE);
  // ledger-rules.js imports nothing, so the page can load it with one ?v= and no nested versions.
  assert.deepEqual(relativeImports("ledger-rules.js"), []);
  assert.doesNotMatch(read("ledger-rules.js"), /^import /m);
});

test("Firebase is gone from the repo: no rules, no Firebase settings, no emulator tests or tools (SF-038)", function(){
  for(const f of ["firestore.rules", "firebase.json", "tests/rules", "docs/google-play/FIRESTORE_RULES.md"]){
    assert.equal(existsSync(new URL("../" + f, import.meta.url)), false, f);
  }
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(pkg.dependencies, undefined);
  assert.deepEqual(Object.keys(pkg.scripts).sort(), ["start", "test"]);
  const lock = JSON.parse(read("package-lock.json"));
  assert.deepEqual(Object.keys(lock.packages), [""]);
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
