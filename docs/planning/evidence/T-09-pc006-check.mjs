// PC-006 steps 1-3 against the live Railway deployment of T-09's push A. Nothing is written: GET
// requests, plus POSTs to /api/import with made-up wrong tokens, which the server answers before
// reading anything. The real import token is never sent from here.
// Run from the repo: node docs/planning/evidence/T-09-pc006-check.mjs <push A commit> <baseline commit>
import { request } from "node:https";
import { execFileSync } from "node:child_process";

const HOST = "splitfamilia.up.railway.app";
const pushA = process.argv[2] || "HEAD";
const baseline = process.argv[3] || "a8bffb8";

// One request with the path exactly as given, the body undecoded.
function send(method, path, headers, body){
  return new Promise(function(resolve, reject){
    const req = request({ host: HOST, path: path, method: method, headers: headers || {} }, function(res){
      const chunks = [];
      res.on("data", function(c){ chunks.push(c); });
      res.on("end", function(){ resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }); });
    });
    req.on("error", reject);
    req.setTimeout(20000, function(){ req.destroy(new Error("timeout")); });
    req.end(body);
  });
}
const committed = function(commit, file){ return execFileSync("git", ["show", commit + ":" + file]); };
const say = function(s){ console.log(s); };

say("PC-006 against https://" + HOST + ": push A " + pushA + ", baseline " + baseline + ", " + new Date().toISOString());

// Step 1
const hz = await send("GET", "/healthz");
say("1. /healthz → " + hz.status + " " + hz.body.toString("utf8"));

// Step 2: the page is push A's, which is the baseline's.
for(const [path, file] of [["/", "index.html"], ["/index.html", "index.html"], ["/money.js?v=5", "money.js"], ["/group-code.js?v=5", "group-code.js"],
  ["/sync-status.js?v=5", "sync-status.js"], ["/service-worker.js", "service-worker.js"], ["/manifest.json", "manifest.json"]]){
  const r = await send("GET", path);
  say("2. " + path + " → " + r.status + " | byte-identical to " + baseline + ": " + r.body.equals(committed(baseline, file)) +
    " | to " + pushA + ": " + r.body.equals(committed(pushA, file)) + " | " + r.headers["cache-control"] + " | " + r.headers["x-content-type-options"]);
}
const sw = (await send("GET", "/service-worker.js")).body.toString("utf8");
say("2. the worker's cache: " + (/const CACHE = "([^"]+)"/.exec(sw) || [])[1]);

// Step 3: the import endpoint is off while IMPORT_TOKEN is unset.
const fake = JSON.stringify({ code: "pc-check-trip", currency: "₹", people: [], expenses: [] });
const json = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(fake) };
for(const [label, auth] of [["no Authorization", null], ["a made-up token", "Bearer pc006-made-up-token-not-the-real-one-000"]]){
  const r = await send("POST", "/api/import", Object.assign({}, json, auth ? { "Authorization": auth } : {}), fake);
  say("3. POST /api/import with " + label + " → " + r.status + " " + r.body.toString("utf8"));
}
const g = await send("GET", "/api/import");
say("3. GET /api/import → " + g.status + " (404 while off; 405 would mean the endpoint is on)");
