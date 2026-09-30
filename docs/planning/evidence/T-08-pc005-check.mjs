// PC-005 steps 2-4 against the live Railway deployment of T-08. Read-only: GET requests to the
// public site, nothing written. Run from the repo: node docs/planning/evidence/T-08-pc005-check.mjs <commit>
import { request } from "node:https";
import { execFileSync } from "node:child_process";

const HOST = "splitfamilia.up.railway.app";
const commit = process.argv[2] || "HEAD";

// One GET with the path exactly as given (no URL tidying), the body undecoded.
function get(path, headers){
  return new Promise(function(resolve, reject){
    const req = request({ host: HOST, path: path, method: "GET", headers: headers || {} }, function(res){
      const chunks = [];
      res.on("data", function(c){ chunks.push(c); });
      res.on("end", function(){ resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }); });
    });
    req.on("error", reject);
    req.setTimeout(20000, function(){ req.destroy(new Error("timeout")); });
    req.end();
  });
}
const committed = function(file){ return execFileSync("git", ["show", commit + ":" + file]); };
const lines = [];
const say = function(s){ lines.push(s); console.log(s); };

say("PC-005 against https://" + HOST + " and commit " + commit + ", " + new Date().toISOString());

// Step 2
const hz = await get("/healthz");
say("2. /healthz → " + hz.status + " " + hz.body.toString("utf8"));

// Step 3
const root = await get("/");
const h = root.headers;
say("3. / → " + root.status + " | title SplitFamilia: " + /<title>SplitFamilia/.test(root.body.toString("utf8")) +
  " | cache-control " + h["cache-control"] + " | " + h["x-content-type-options"] + " | " + h["referrer-policy"]);
for(const [path, file] of [["/index.html", "index.html"], ["/money.js?v=5", "money.js"], ["/group-code.js?v=5", "group-code.js"],
  ["/sync-status.js?v=5", "sync-status.js"], ["/service-worker.js", "service-worker.js"], ["/manifest.json", "manifest.json"]]){
  const r = await get(path);
  say("   " + path + " → " + r.status + " | byte-identical to " + commit + ":" + file + ": " + r.body.equals(committed(file)) +
    " | " + r.headers["content-type"] + " | " + r.headers["cache-control"] + " | " + r.headers["x-content-type-options"]);
}
const links = await get("/.well-known/assetlinks.json");
say("   /.well-known/assetlinks.json → " + links.status + " " + links.headers["content-type"]);

// Step 4
for(const path of ["/package.json", "/server/main.js", "/docs/planning/STATE.json", "/%2e%2e/", "/ledger-rules.js", "/data/splitfamilia.db"]){
  const r = await get(path);
  say("4. " + path + " → " + r.status + " | " + r.headers["x-content-type-options"]);
}
