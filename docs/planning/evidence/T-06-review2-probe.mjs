// T-06 second review probe (evidence only, not part of `npm test`; 2026-10-02 IST): F-16 as
// reworked, from a hostile angle. Expected values (the comments) were worked out by hand first.
//   node docs/planning/evidence/T-06-review2-probe.mjs <repoDir>   (about 2 s)
// Local only: the real server on 127.0.0.1, a temporary database, made-up codes, RFC 5737
// addresses sent as X-Real-IP (trustProxy, as on Railway). Prints one JSON object.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { request } from "node:http";

const repo = process.argv[2];
const { createApp } = await import(pathToFileURL(join(repo, "server", "server.js")).href);
const apiMod = await import(pathToFileURL(join(repo, "server", "api.js")).href);
const { createGuessLimiter, createWriteLimiter, GUESS_LIMIT, WRITE_LIMIT, GUESS_WINDOW_MS } = apiMod;

const out = {};
const wait = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };

// ---------- A: the real server, production limits, fake clock, a 25 ms sweep ----------
{
  const dir = mkdtempSync(join(tmpdir(), "sf-review2-"));
  let clock = Date.parse("2026-10-02T02:30:00Z");
  const app = createApp({ root: repo, dbFile: join(dir, "p.db"), trustProxy: true, sweepMs: 25,
    log: function(){}, now: function(){ return clock; } });
  await new Promise(function(r){ app.server.listen(0, "127.0.0.1", r); });
  const port = app.server.address().port;
  const base = "http://127.0.0.1:" + port;
  const call = function(method, code, ip, body){
    return fetch(base + "/api/group", { method: method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: Object.assign({ "X-Group-Code": code, "X-Real-IP": ip }, body === undefined ? {} : { "Content-Type": "application/json" }) })
      .then(function(r){ return r.text().then(function(){ return r.status; }); });
  };
  const sizes = function(){ return [app.limiter.size(), app.writes.size(), app.hub.addresses()]; };
  let stream = null;
  try{
    // Guesser 192.0.2.10: 30 unknown codes (one at a time), then refused.
    const guesses = [];
    for(let i = 0; i < GUESS_LIMIT; i++) guesses.push(await call("GET", "review2-unknown-" + i, "192.0.2.10"));
    out.A_guesses404 = guesses.filter(function(s){ return s === 404; }).length; // expect 30
    out.A_guess31 = await call("GET", "review2-unknown-x", "192.0.2.10");     // expect 429
    // Writer 198.51.100.20: a new group (1 unknown code + 1 change), then 299 more changes.
    const writes = [];
    for(let i = 0; i < WRITE_LIMIT; i++) writes.push(await call("PUT", "review2-trip", "198.51.100.20", { currency: i % 2 ? "$" : "₹" }));
    out.A_writes200 = writes.filter(function(s){ return s === 200; }).length;  // expect 300
    out.A_write301 = await call("PUT", "review2-trip", "198.51.100.20", { currency: "₹" }); // expect 429
    out.A_writerCanRead = await call("GET", "review2-trip", "198.51.100.20");  // expect 200
    // Watcher 203.0.113.30: a live stream on the group, kept open.
    stream = await new Promise(function(resolve, reject){
      const req = request({ host: "127.0.0.1", port: port, path: "/api/group/events",
        headers: { "X-Group-Code": "review2-trip", "X-Real-IP": "203.0.113.30" } }, function(res){
        res.once("data", function(){ resolve({ req: req, res: res, status: res.statusCode }); });
      });
      req.on("error", reject);
      req.end();
    });
    out.A_streamStatus = stream.status;                    // expect 200
    await wait(80);
    out.A_sizesAtStart = sizes();                          // expect [2, 1, 1]
    clock += GUESS_WINDOW_MS - 1;                          // all events were at the same fake instant
    await wait(120);                                       // several sweeps
    out.A_sizesOneMsBefore = sizes();                      // expect [2, 1, 1]
    out.A_guesserStillBlocked = app.limiter.blocked("192.0.2.10"); // expect true
    clock += 1;
    await wait(120);
    out.A_sizesAtWindowEnd = sizes();                      // expect [0, 0, 1]: the stream stays
    stream.req.destroy();
    await wait(120);
    out.A_sizesAfterStreamClosed = sizes();                // expect [0, 0, 0]
    out.A_guesserBackKnownCode = await call("GET", "review2-trip", "192.0.2.10"); // expect 200
    out.A_sizesAfterReturn = sizes();                      // expect [0, 0, 0]: a read of a known group records nothing
  }finally{
    if(stream) stream.req.destroy();
    await app.close();
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

// ---------- B: 10,000 addresses, half expired: the sweep deletes while it walks the Map ----------
{
  let clock = 0;
  const lim = createGuessLimiter({ now: function(){ return clock; } });
  for(let i = 0; i < 10000; i++){
    clock = i % 2 === 0 ? 0 : 5 * 60 * 1000;  // even at 0, odd at 5 minutes (insertion order interleaved)
    lim.hit("a" + i);
  }
  clock = GUESS_WINDOW_MS;  // evens' events are exactly at the cutoff: gone; odds' are 5 minutes old: kept
  lim.sweep();
  out.B_sizeAfterSweep = lim.size();    // expect 5000 (read before anything else looks an address up)
  let evensLeft = 0, oddsLeft = 0;
  for(let i = 0; i < 10000; i++){
    if(lim.retryAfter("a" + i) > 0) (i % 2 === 0 ? evensLeft++ : oddsLeft++);
  }
  out.B_evensLeft = evensLeft;          // expect 0
  out.B_oddsLeft = oddsLeft;            // expect 5000
  clock = GUESS_WINDOW_MS + 5 * 60 * 1000;
  lim.sweep();
  out.B_sizeLater = lim.size();         // expect 0
}

// ---------- C: the worst sweep: 10,000 addresses, 300 changes each, all expiring at once ----------
{
  let clock = 0;
  const lim = createWriteLimiter({ now: function(){ return clock; } });
  for(let i = 0; i < 10000; i++){ for(let k = 0; k < WRITE_LIMIT; k++) lim.hit("w" + i); }
  out.C_sizeBefore = lim.size();        // expect 10000
  let t = process.hrtime.bigint();
  lim.sweep();
  out.C_sweepNothingExpiredMs = Number(process.hrtime.bigint() - t) / 1e6;
  clock = GUESS_WINDOW_MS;
  t = process.hrtime.bigint();
  lim.sweep();
  out.C_sweepAllExpiredMs = Number(process.hrtime.bigint() - t) / 1e6;
  out.C_sizeAfter = lim.size();         // expect 0
}

console.log(JSON.stringify(out, null, 1));
