// T-06 rework probe (evidence only, not part of `npm test`; 2026-10-02 IST): the review's F-16,
// on the real server with its real sweep interval (SWEEP_MS, 30 s), not the tests' 20 ms.
//   node docs/planning/evidence/T-06-rework-probe.mjs   (from the repository root; about 40 s)
// Everything is local: the server on 127.0.0.1 with a temporary database, made-up group codes and
// documentation IP addresses (RFC 5737), sent as X-Real-IP as Railway's proxy does.
// Prints one JSON object.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../../../server/server.js";
import { SWEEP_MS, GUESS_WINDOW_MS, WRITE_WINDOW_MS } from "../../../server/api.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "splitfamilia-rework-probe-"));
let clock = Date.parse("2026-10-02T00:00:00Z");
const app = createApp({ root: root, dbFile: join(dir, "probe.db"), trustProxy: true, log: function(){}, now: function(){ return clock; } });
await new Promise(function(r){ app.server.listen(0, "127.0.0.1", r); });
const base = "http://127.0.0.1:" + app.server.address().port;
const call = function(method, path, code, ip, body){
  return fetch(base + path, { method: method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: Object.assign({ "X-Group-Code": code, "X-Real-IP": ip }, body === undefined ? {} : { "Content-Type": "application/json" }) });
};
const sizes = function(){ return { guessLimiter: app.limiter.size(), writeLimiter: app.writes.size(), liveHub: app.hub.addresses() }; };
const out = { sweepMs: SWEEP_MS, windowsMs: [GUESS_WINDOW_MS, WRITE_WINDOW_MS], policyBoundMinutes: 11 };

try{
  // One unknown code from one address, and a new group (a change) from another; neither returns.
  out.unknownCode = (await call("GET", "/api/group", "rework-probe-unknown", "192.0.2.1")).status;
  out.newGroup = (await call("PUT", "/api/group", "rework-probe-trip", "198.51.100.2", { currency: "₹" })).status;
  // A third address keeps a live stream open.
  const ac = new AbortController();
  const stream = await fetch(base + "/api/group/events", { headers: { "X-Group-Code": "rework-probe-trip", "X-Real-IP": "203.0.113.3" }, signal: ac.signal });
  out.streamStatus = stream.status;
  await new Promise(function(r){ setTimeout(r, 200); });
  out.atStart = sizes();

  // 9 minutes 59 seconds later (the server's clock), after a real sweep: still inside the window.
  clock += 10 * 60 * 1000 - 1000;
  await new Promise(function(r){ setTimeout(r, SWEEP_MS + 2000); });
  out.after9m59s = sizes();

  // The window passes. No request comes from either address: only the timer can forget them.
  clock += 1000;
  const t0 = Date.now();
  while((app.limiter.size() > 0 || app.writes.size() > 0) && Date.now() - t0 < SWEEP_MS + 5000){
    await new Promise(function(r){ setTimeout(r, 250); });
  }
  out.afterWindow = sizes();
  out.realSecondsUntilForgotten = Math.round((Date.now() - t0) / 100) / 10;
  out.forgottenWithinOneSweep = app.limiter.size() === 0 && app.writes.size() === 0 && Date.now() - t0 <= SWEEP_MS + 1000;

  // The stream's address is held while it is open, and dropped when it closes.
  out.streamHeldAfterWindow = app.hub.countFrom("203.0.113.3");
  ac.abort();
  const t1 = Date.now();
  while(app.hub.addresses() > 0 && Date.now() - t1 < 5000) await new Promise(function(r){ setTimeout(r, 50); });
  out.afterStreamClosed = sizes();
  out.pass = out.unknownCode === 404 && out.newGroup === 200 && out.streamStatus === 200 &&
    out.atStart.guessLimiter === 2 && out.atStart.writeLimiter === 1 && out.atStart.liveHub === 1 &&
    out.after9m59s.guessLimiter === 2 && out.after9m59s.writeLimiter === 1 &&
    out.forgottenWithinOneSweep && out.streamHeldAfterWindow === 1 && out.afterStreamClosed.liveHub === 0;
}finally{
  await app.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
console.log(JSON.stringify(out, null, 2));
process.exitCode = out.pass ? 0 : 1;
