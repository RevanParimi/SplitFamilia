// T-08 image check (Docker isn't installed on the development machine, so the image itself is
// not built). This stages exactly what the Dockerfile puts in /app — its COPY lines and its RUN
// line's package.json, nothing else — into an empty folder, starts `node server/main.js` there
// the way the image's CMD does, with Railway-like variables and a stand-in volume folder, and
// checks it from outside over HTTP.
// Run from the repo root: node docs/planning/evidence/T-08-image-check.mjs <empty scratch folder>
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawn } from "node:child_process";

const scratch = process.argv[2];
if(!scratch || (existsSync(scratch) && readdirSync(scratch).length > 0)) throw new Error("give an empty scratch folder");
const app = join(scratch, "app");
const volume = join(scratch, "volume");
mkdirSync(app, { recursive: true });
mkdirSync(volume, { recursive: true });

const out = [];
const say = function(line){ out.push(line); console.log(line); };

// 1. Stage /app from the Dockerfile.
const dockerfile = readFileSync("Dockerfile", "utf8");
const staged = [];
dockerfile.split(/\r?\n/).forEach(function(line){
  const copy = /^COPY\s+(.+)$/.exec(line.trim());
  if(copy){
    const parts = copy[1].trim().split(/\s+/);
    const dest = parts.pop().replace(/^\/app\/?/, "");
    parts.forEach(function(src){
      const target = dest === "" || dest.endsWith("/") ? dest + src.split("/").pop() : dest;
      mkdirSync(dirname(join(app, target)), { recursive: true });
      copyFileSync(src, join(app, target));
      staged.push(target);
    });
  }
  const run = /^RUN echo '(.+)' > \/app\/package\.json$/.exec(line.trim());
  if(run) writeFileSync(join(app, "package.json"), run[1] + "\n");
});
say("FROM line: " + /^FROM .+$/m.exec(dockerfile)[0]);
say("staged " + staged.length + " files: " + staged.join(", ") + " (+ package.json from the RUN line)");

// 2. Start it as the image's CMD would, as Railway would.
const port = 18000 + Math.floor(Math.random() * 1000);
const env = Object.assign({}, process.env, {
  PORT: String(port), NODE_ENV: "production",
  RAILWAY_ENVIRONMENT_NAME: "production", RAILWAY_VOLUME_MOUNT_PATH: volume
});
const child = spawn(process.execPath, ["server/main.js"], { cwd: app, env: env });
let logs = "";
child.stdout.on("data", function(d){ logs += d; });
child.stderr.on("data", function(d){ logs += d; });
const base = "http://127.0.0.1:" + port;
for(let i = 0; i < 100 && !/listening/.test(logs); i++) await new Promise(function(r){ setTimeout(r, 50); });

try{
  const check = async function(path, init){
    const res = await fetch(base + path, init);
    const body = Buffer.from(await res.arrayBuffer());
    return { res: res, body: body };
  };
  // 3. The app's files, byte for byte, with their headers.
  for(const path of ["/", "/index.html?g=goa-trip-2026", "/service-worker.js", "/money.js?v=5", "/group-code.js?v=5", "/sync-status.js?v=5", "/manifest.json", "/icon-192.png", "/.well-known/assetlinks.json"]){
    const r = await check(path, { headers: { "Accept-Encoding": "identity" } });
    const file = path === "/" || path.startsWith("/index.html") ? "index.html" : path.slice(1).replace(/\?.*$/, "");
    const same = Buffer.compare(r.body, readFileSync(file)) === 0;
    say(path + " → " + r.res.status + " " + r.res.headers.get("content-type") + " | cache-control " + r.res.headers.get("cache-control") +
      " | " + r.res.headers.get("x-content-type-options") + " | " + r.res.headers.get("referrer-policy") + " | same bytes as the repo: " + same);
  }
  // 4. What must not be served, including the server, the database and ledger-rules.js (not a page file yet).
  for(const path of ["/package.json", "/server/main.js", "/ledger-rules.js", "/docs/planning/STATE.json", "/firestore.rules", "/Dockerfile", "/splitfamilia.db", "/../package.json"]){
    const r = await check(path);
    say(path + " → " + r.res.status);
  }
  // 5. Health, then the API on the stand-in volume.
  const health = await check("/healthz");
  say("/healthz → " + health.res.status + " " + health.body.toString("utf8"));
  const H = { "X-Group-Code": "image-check", "Content-Type": "application/json" };
  const steps = [
    ["PUT", "/api/group", { currency: "₹" }], ["POST", "/api/people", { id: "asha", name: "Asha" }],
    ["POST", "/api/people", { id: "ben", name: "Ben" }],
    ["POST", "/api/expenses", { id: "e1", date: "2026-09-30T06:00:00.000Z", desc: "Taxi", amountPaise: 10000, paidBy: "asha", split: ["asha", "ben"] }],
    ["GET", "/api/group", undefined]
  ];
  for(const [method, path, body] of steps){
    const r = await check(path, { method: method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
    say(method + " " + path + " → " + r.res.status + " " + r.body.toString("utf8"));
  }
  say("database file on the stand-in volume: " + existsSync(join(volume, "splitfamilia.db")) + "; in the app folder: " + existsSync(join(app, "data")));
}finally{
  child.kill();
  await new Promise(function(r){ child.on("exit", r); });
}
say("server log:");
logs.trim().split(/\r?\n/).forEach(function(l){ say("  " + l); });
say("log mentions the group code: " + logs.includes("image-check"));
