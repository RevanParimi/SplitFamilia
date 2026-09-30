// T-08 rework review (a fresh conversation): adversarial probes of the reworked server, in-process
// on 127.0.0.1 with temporary databases (tests/helpers/test-server.js). Nothing is edited; nothing
// leaves this machine. Run from the repo: node docs/planning/evidence/T-08-review2-probe.mjs
// Prints one JSON object with every probe's observed result; the expected results are written by
// hand in the review receipt (T-08-review.md, "Second review: the rework").
import { connect } from "node:net";
import { startTestServer, api, raw } from "../../../tests/helpers/test-server.js";
import { checkExpense } from "../../../ledger-rules.js";

const out = {};
const servers = []; // every server's log lines are checked at the end (Q6)
const secrets = []; // every code and address used, none of which may appear in a log line

async function server(options){
  const s = await startTestServer(options);
  servers.push(s);
  return s;
}

function tally(statuses){
  const t = {};
  statuses.forEach(function(s){ t[s] = (t[s] || 0) + 1; });
  return t;
}

// Sends a request's head at once and its body only when `release` resolves, over its own socket.
// Resolves once connected (so a caller can open hundreds one by one, within Windows' backlog) to
// { answer: Promise of the status code }.
function heldRequest(port, method, path, headers, body, release){
  return new Promise(function(connected){
    const answer = new Promise(function(resolve, reject){
      const sock = connect(port, "127.0.0.1", function(){ connected({ answer: answer }); });
      let text = "";
      sock.setEncoding("utf8");
      sock.on("data", function(d){ text += d; });
      sock.on("error", function(){ /* the server may close after answering */ });
      sock.on("close", function(){
        const m = /^HTTP\/1\.1 (\d{3})/.exec(text);
        m ? resolve(Number(m[1])) : reject(new Error("no answer: " + JSON.stringify(text.slice(0, 80))));
      });
      const head = [method + " " + path + " HTTP/1.1", "Host: 127.0.0.1", "Connection: close"]
        .concat(Object.entries(headers).map(function([k, v]){ return k + ": " + v; }))
        .concat(["Content-Length: " + Buffer.byteLength(body), "", ""]).join("\r\n");
      sock.write(head);
      release.then(function(){ sock.write(body); });
    });
  });
}

const smallExpense = function(id, payer){
  return { id: id, date: "2026-09-30T06:00:00.000Z", desc: "Tea", amountPaise: 1000, paidBy: payer || "asha", split: [payer || "asha"] };
};
const ip = function(n){ return { "X-Real-IP": n }; };
// Headers of a response without the ones that differ by time alone.
function headersOf(res){
  const h = {};
  res.headers.forEach(function(v, k){ if(k !== "date") h[k] = v; });
  return h;
}

// ---------- Q1: held bodies against the change limit, at the real 300 ----------
// Contract (D-17, REVIEW.md): one address sends at most 300 changes in 10 minutes, then 429 for its
// changes. Held bodies pass the first check (F-8's shape), so this checks the second one holds.
const q1 = await server({ trustProxy: true });
const Q1_CODE = "held-writes-trip";
const A = "10.0.0.1", B = "10.0.0.2";
secrets.push(Q1_CODE, A, B);
{
  const port = Number(new URL(q1.base).port);
  const put = await api(q1.base, "PUT", "/api/group", { code: Q1_CODE, headers: ip(A), body: { currency: "₹" } }); // change 1
  const person = await api(q1.base, "POST", "/api/people", { code: Q1_CODE, headers: ip(A), body: { id: "asha", name: "Asha" } }); // change 2
  let go;
  const release = new Promise(function(r){ go = r; });
  const pending = [];
  for(let i = 0; i < 400; i++){
    pending.push((await heldRequest(port, "POST", "/api/expenses",
      { "X-Group-Code": Q1_CODE, "Content-Type": "application/json", "X-Real-IP": A },
      JSON.stringify(smallExpense("h" + i)), release)).answer);
  }
  await new Promise(function(r){ setTimeout(r, 500); }); // every head has been read
  go();
  const statuses = await Promise.all(pending);
  const read = await api(q1.base, "GET", "/api/group", { code: Q1_CODE, headers: ip(A) });
  const other = await api(q1.base, "POST", "/api/people", { code: Q1_CODE, headers: ip(B), body: { id: "ben", name: "Ben" } });
  out.Q1_heldWrites = {
    setup: [put.status, person.status], held: 400, answers: tally(statuses),
    readSameAddress: read.status, expensesStored: read.body && read.body.expenses.length,
    otherAddressWrite: other.status
  };
}

// ---------- Q3: does a 429 or a 503 tell a guesser that a code exists? ----------
// (a) At the change limit, every change gets the same 429 whether its code exists or not, and
// isn't looked up, so it isn't counted as a guess either.
{
  const UNKNOWN = "no-such-trip-q3";
  secrets.push(UNKNOWN);
  const shapes = [
    ["PUT", "/api/group", { currency: "$" }],
    ["POST", "/api/people", { id: "zed", name: "Zed" }],
    ["POST", "/api/expenses", smallExpense("q3")],
    ["DELETE", "/api/people/asha", undefined],
    ["DELETE", "/api/expenses/h0", undefined]
  ];
  const pairs = [];
  for(const [method, path, body] of shapes){
    const known = await api(q1.base, method, path, { code: Q1_CODE, headers: ip(A), body: body });
    const unknown = await api(q1.base, method, path, { code: UNKNOWN, headers: ip(A), body: body });
    pairs.push({
      request: method + " " + path, known: known.status, unknown: unknown.status,
      sameBody: JSON.stringify(known.body) === JSON.stringify(unknown.body),
      sameHeaders: JSON.stringify(headersOf(known)) === JSON.stringify(headersOf(unknown)),
      retryAfter: [known.headers.get("retry-after"), unknown.headers.get("retry-after")]
    });
  }
  const more = [];
  for(let i = 0; i < 40; i++){
    more.push((await api(q1.base, "POST", "/api/people", { code: "q3-guess-" + i, headers: ip(A), body: { id: "p", name: "P" } })).status);
  }
  const knownRead = await api(q1.base, "GET", "/api/group", { code: Q1_CODE, headers: ip(A) });
  const unknownRead = await api(q1.base, "GET", "/api/group", { code: UNKNOWN, headers: ip(A) });
  out.Q3a_changeLimit = {
    pairs: pairs, fortyUnknownChanges: tally(more),
    afterwards: { knownRead: knownRead.status, unknownRead: unknownRead.status }
  };
}
// (b) At the stream cap, 503 comes only where 200 would have come; an unknown code still gets 404
// and counts as a guess.
{
  const C = "10.0.0.3", D = "10.0.0.4";
  secrets.push(C, D);
  const port = Number(new URL(q1.base).port);
  const socks = [];
  function openStream(code, address){
    return new Promise(function(resolve){
      const sock = connect(port, "127.0.0.1");
      let text = "";
      sock.setEncoding("utf8");
      sock.on("error", function(){});
      sock.on("data", function(d){
        text += d;
        const m = /^HTTP\/1\.1 (\d{3})[^]*?\r\n\r\n([^]*)$/.exec(text);
        if(m) resolve({ status: Number(m[1]), body: m[2].slice(0, 60) });
      });
      socks.push(sock);
      sock.write("GET /api/group/events HTTP/1.1\r\nHost: x\r\nX-Real-IP: " + address + "\r\nX-Group-Code: " + code + "\r\n\r\n");
    });
  }
  const held = [];
  for(let i = 0; i < 10; i++) held.push((await openStream(Q1_CODE, C)).status);
  const eleventhKnown = await openStream(Q1_CODE, C);
  const eleventhUnknown = await openStream("no-such-trip-q3b", C);
  const freshKnown = await openStream(Q1_CODE, D);
  const freshUnknown = await openStream("no-such-trip-q3b", D);
  out.Q3b_streamCap = {
    tenFromOneAddress: tally(held),
    atCap: { known: eleventhKnown, unknown: eleventhUnknown.status },
    belowCap: { known: freshKnown.status, unknown: freshUnknown.status }
  };
  socks.forEach(function(k){ k.destroy(); });
}

// ---------- Q4: a replay into a full group, at the real 5,000; then Q8: reading that group ----------
// The family's own group grows over time from several addresses, so the fill rotates addresses to
// stay under the change limit. Each expense is the largest allowed: split among 100 people with
// 64-character IDs, a 200-character description.
const q4 = await server({ trustProxy: true });
const FULL = "full-trek-q4";
secrets.push(FULL);
const people = Array.from({ length: 100 }, function(_, i){ return ("p" + i).padEnd(64, "x"); });
const largest = function(id, payer){
  return { id: id, date: "2026-09-30T04:15:00.000Z", desc: "ऋ".repeat(200), amountPaise: 1, paidBy: payer || people[0], split: people };
};
{
  let sent = 0;
  const address = function(){ return "10.1." + Math.floor(sent++ / 290) + ".1"; };
  await api(q4.base, "PUT", "/api/group", { code: FULL, headers: ip(address()), body: { currency: "₹" } });
  for(const id of people) await api(q4.base, "POST", "/api/people", { code: FULL, headers: ip(address()), body: { id: id, name: "N" } });
  const fill = [];
  const t0 = Date.now();
  for(let batch = 0; batch < 100; batch++){
    const round = [];
    for(let j = 0; j < 50; j++) round.push(api(q4.base, "POST", "/api/expenses", { code: FULL, headers: ip(address()), body: largest("f" + (batch * 50 + j)) }));
    (await Promise.all(round)).forEach(function(r){ fill.push(r.status); });
  }
  const fillMs = Date.now() - t0;
  const R = "10.2.0.1";
  secrets.push(R);
  const version = function(r){ return r.body && r.body.version; };
  const del = await api(q4.base, "DELETE", "/api/expenses/f0", { code: FULL, headers: ip(R) });
  const fresh = await api(q4.base, "POST", "/api/expenses", { code: FULL, headers: ip(R), body: largest("f5000") });
  const replayLive = await api(q4.base, "POST", "/api/expenses", { code: FULL, headers: ip(R), body: largest("f1") });
  const replayDeleted = await api(q4.base, "POST", "/api/expenses", { code: FULL, headers: ip(R), body: largest("f0") });
  const replayChanged = await api(q4.base, "POST", "/api/expenses", { code: FULL, headers: ip(R), body: largest("f2", "no-longer-here") });
  const pages = q4.app.ledger.query("PRAGMA page_count")[0].page_count * q4.app.ledger.query("PRAGMA page_size")[0].page_size;
  const rows = q4.app.ledger.query("SELECT COUNT(*) AS n, SUM(deleted_at IS NOT NULL) AS deleted FROM expenses WHERE group_code = ?", [FULL])[0];
  out.Q4_fullGroup = {
    fill: tally(fill), fillMs: fillMs, databaseBytes: pages, bytesPerExpense: Math.round(pages / 5000),
    deleteOne: [del.status, version(del)],
    newAfterDelete: [fresh.status, fresh.body],
    replayLive: [replayLive.status, version(replayLive)],
    replayDeleted: [replayDeleted.status, version(replayDeleted)],
    replayWithChangedPayer: [replayChanged.status, version(replayChanged)],
    rows: rows
  };
}

// ---------- Q8: reading the full group (reads have no per-address limit) ----------
// Not in any card's contract; measured, as P8 was for writes.
{
  const port = Number(new URL(q4.base).port);
  const R = "10.3.0.1";
  secrets.push(R);
  // One read, timed, and its size.
  const t0 = Date.now();
  const one = await raw(q4.base, "/api/group", { headers: { "X-Group-Code": FULL, "X-Real-IP": R } });
  const oneMs = Date.now() - t0;
  const gzipAsked = await raw(q4.base, "/api/group", { headers: { "X-Group-Code": FULL, "X-Real-IP": R, "Accept-Encoding": "gzip" } });
  // Ten reads whose answers are never read: what the server holds meanwhile, and how long the
  // page's own "/" takes while they are built.
  global.gc && global.gc();
  const before = process.memoryUsage();
  const socks = [];
  const heads = [];
  for(let i = 0; i < 10; i++){
    heads.push(new Promise(function(resolve){
      const sock = connect(port, "127.0.0.1");
      sock.on("error", function(){});
      sock.once("data", function(){ sock.pause(); resolve(); }); // the first bytes, then stop reading
      socks.push(sock);
      sock.write("GET /api/group HTTP/1.1\r\nHost: x\r\nX-Real-IP: " + R + "\r\nX-Group-Code: " + FULL + "\r\n\r\n");
    }));
  }
  const tPage = Date.now();
  const page = await raw(q4.base, "/");
  const pageMs = Date.now() - tPage;
  await Promise.all(heads);
  await new Promise(function(r){ setTimeout(r, 500); });
  global.gc && global.gc();
  const during = process.memoryUsage();
  socks.forEach(function(k){ k.destroy(); });
  await new Promise(function(r){ setTimeout(r, 500); });
  global.gc && global.gc();
  const afterClose = process.memoryUsage();
  const mb = function(n){ return Math.round(n / 1048576); };
  out.Q8_bigRead = {
    visibleExpenses: 4999, responseBytes: one.body.length, ms: oneMs,
    contentEncodingWhenGzipAsked: gzipAsked.headers["content-encoding"] || "none",
    tenUnreadReads: {
      pageStatus: page.status, pageMsWhileBuilding: pageMs,
      externalMBBefore: mb(before.external), externalMBHeld: mb(during.external), externalMBAfterClose: mb(afterClose.external),
      rssMBBefore: mb(before.rss), rssMBHeld: mb(during.rss)
    }
  };
}

// ---------- Q5: isDate against a calendar worked out independently ----------
// Valid exactly when 1 <= month <= 12, 1 <= day <= the month's days (February 29 in leap years:
// divisible by 4, except centuries not divisible by 400), hour <= 23, minute <= 59, second <= 59.
{
  const daysIn = function(y, m){
    if(m === 2) return (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28;
    return [4, 6, 9, 11].includes(m) ? 30 : 31;
  };
  const pad = function(n, w){ return String(n).padStart(w, "0"); };
  const times = [[0, 0, 0], [23, 59, 59], [24, 0, 0], [12, 60, 0], [12, 0, 60], [25, 0, 0], [9, 5, 7]];
  const fractions = ["", ".0", ".5", ".999"];
  let checked = 0;
  const mismatches = [];
  for(const y of [1900, 2000, 2023, 2024, 2026, 2100, 9999]){
    for(let m = 0; m <= 13; m++){
      for(let d = 0; d <= 32; d++){
        for(const [h, mi, s] of times){
          for(const f of fractions){
            const value = pad(y, 4) + "-" + pad(m, 2) + "-" + pad(d, 2) + "T" + pad(h, 2) + ":" + pad(mi, 2) + ":" + pad(s, 2) + f + "Z";
            const real = m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m) && h <= 23 && mi <= 59 && s <= 59;
            const got = checkExpense({ id: "e", date: value, desc: "d", amountPaise: 1, paidBy: "a", split: ["a"] }, ["a"]) === null;
            checked++;
            if(got !== real && mismatches.length < 10) mismatches.push({ value: value, expected: real, got: got });
          }
        }
      }
    }
  }
  out.Q5_isDate = { checked: checked, mismatches: mismatches };
}

// ---------- Q6: no log line holds a code, an address or typed text ----------
{
  const allowed = [
    /^SplitFamilia api: (GET|PUT|POST|DELETE) \d{3} [a-z-]+$/,
    /^SplitFamilia api: an address reached the limit of (changes|unknown group codes)$/
  ];
  const lines = [];
  servers.forEach(function(s){ s.logs.forEach(function(l){ lines.push(l); }); });
  const bad = lines.filter(function(l){
    return !allowed.some(function(re){ return re.test(l); }) || secrets.concat(["Asha", "Ben", "Zed", "Tea", "ऋ"]).some(function(x){ return l.includes(x); });
  });
  out.Q6_logs = { lines: lines.length, distinct: Array.from(new Set(lines)), bad: bad };
}

for(const s of servers) await s.close();
console.log(JSON.stringify(out, null, 1));
