// PC-009 against the live site after T-04's push: health (migration 2 ran), the v7 files
// byte-identical to the pushed commit, and the new edit route. Prints no group code, name or
// amount; the probe's code is made up here and names no group.
//   node docs/planning/evidence/T-04-pc009-check.mjs <pushed commit>
import { request } from "node:https";
import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";

const [commit] = process.argv.slice(2);
const HOST = "splitfamilia.up.railway.app";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => console.log(s);
const committed = (file) => execFileSync("git", ["show", commit + ":" + file]);
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // group-code.js's CODE_ALPHABET

function send(method, p, headers, body){
  return new Promise(function(resolve, reject){
    const req = request({ host: HOST, path: p, method: method, headers: headers || {} }, function(res){
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("timeout")));
    req.end(body);
  });
}

say("PC-009 against https://" + HOST + "/ and commit " + commit + ", " + new Date().toISOString());

// Wait for the new build: the worker names splitsheet-v7.
let waited = 0;
for (; waited < 90; waited++) {
  try { if ((await send("GET", "/service-worker.js")).body.toString("utf8").includes('"splitsheet-v7"')) break; } catch {}
  await sleep(5000);
}
say("new build seen after about " + waited * 5 + " s");

// Step 1. Health: the server only starts when every migration has run.
const hz = await send("GET", "/healthz");
say("1. /healthz → " + hz.status + " " + hz.body.toString("utf8"));

// Step 2. The page, its seven modules, the worker, the manifest and the icons, byte for byte.
const files = [["/", "index.html"], ["/index.html", "index.html"]];
for (const m of ["money", "group-code", "sync-status", "ledger-rules", "ledger-client", "outbox", "recent-groups"]) files.push(["/" + m + ".js?v=7", m + ".js"]);
files.push(["/service-worker.js", "service-worker.js"], ["/manifest.json", "manifest.json"], ["/icon-192.png", "icon-192.png"], ["/icon-512.png", "icon-512.png"], ["/apple-touch-icon.png", "apple-touch-icon.png"]);
let same = 0;
for (const [p, file] of files) {
  const r = await send("GET", p);
  const ok = r.status === 200 && r.body.equals(committed(file));
  if (ok) same++;
  say("2. " + p + " → " + r.status + " | byte-identical: " + ok + " | " + r.headers["cache-control"] + " | " + r.headers["x-content-type-options"]);
}
say("2. " + same + " of " + files.length + " byte-identical; the worker's cache: " + (/const CACHE = "([^"]+)"/.exec((await send("GET", "/service-worker.js")).body.toString("utf8")) || [])[1]);

// Steps 3 and 4. The edit route exists (the old server answered 405), and an unknown code makes nothing.
let random = "";
for (let i = 0; i < 10; i++) random += ALPHABET[randomInt(ALPHABET.length)];
const code = "pc009-probe-" + random;
const body = JSON.stringify({ id: "pc009-probe-new", date: new Date().toISOString(), desc: "Probe", amountPaise: 100, paidBy: "p-a", split: ["p-a"] });
const put = await send("PUT", "/api/expenses/pc009-probe", { "X-Group-Code": code, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }, body);
say("3. PUT /api/expenses/pc009-probe (unknown code, valid body) → " + put.status + " " + put.body.toString("utf8"));
const get = await send("GET", "/api/group", { "X-Group-Code": code });
say("4. GET /api/group (that code) → " + get.status + " " + get.body.toString("utf8"));
