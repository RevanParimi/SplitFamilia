// T-09, D-18: what reading the largest group allowed costs now, measured as the second T-08
// review's Q8 did (37.3 MB, 1.74 s per read, `/` held 16.7 s by ten unread reads). The real
// server in-process on 127.0.0.1 with a temporary database; nothing leaves this machine.
//   node --expose-gc docs/planning/evidence/T-09-read-cost-probe.mjs
// Prints one JSON object; the expected values are worked out by hand in the T-09 receipt.
import { connect } from "node:net";
import { startTestServer, api, raw } from "../../../tests/helpers/test-server.js";

const out = {};
const mb = function(n){ return Math.round(n / 104857.6) / 10; };
const ip = function(n){ return { "X-Real-IP": n }; };

// Random text that gzip can't shrink much: IDs of 64 letters and digits, and descriptions of 200
// Devanagari characters, as unlike each other as real ones could be.
let seed = 20260930;
function rand(n){ seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; }
const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomId(){ let t = ""; for(let i = 0; i < 64; i++) t += ALNUM[rand(ALNUM.length)]; return t; }
function randomDesc(){ let t = ""; for(let i = 0; i < 200; i++) t += String.fromCharCode(0x0905 + rand(0x39)); return t; }

// Fills group `code` with `peopleCount` people and `count` expenses, each split among the first
// `splitSize` of them, from rotating addresses under `net` (each under 300 changes). → the
// statuses of the adds, and one more add after them.
async function fill(s, code, net, peopleCount, count, splitSize){
  let sent = 0;
  const address = function(){ return net + Math.floor(sent++ / 290) + ".1"; };
  const people = Array.from({ length: peopleCount }, randomId);
  await api(s.base, "PUT", "/api/group", { code: code, headers: ip(address()), body: { currency: "₹" } });
  for(const id of people) await api(s.base, "POST", "/api/people", { code: code, headers: ip(address()), body: { id: id, name: "N" } });
  const statuses = [];
  for(let batch = 0; batch < Math.ceil(count / 50); batch++){
    const round = [];
    for(let j = 0; j < 50 && batch * 50 + j < count; j++){
      round.push(api(s.base, "POST", "/api/expenses", { code: code, headers: ip(address()), body: {
        id: randomId(), date: "2026-09-30T04:15:00.000Z", desc: randomDesc(),
        amountPaise: 1, paidBy: people[0], split: people.slice(0, splitSize) } }));
    }
    (await Promise.all(round)).forEach(function(r){ statuses.push(r.status); });
  }
  const one = await api(s.base, "POST", "/api/expenses", { code: code, headers: ip(net + "250.2"), body: {
    id: "one-more", date: "2026-09-30T04:15:00.000Z", desc: "x", amountPaise: 1, paidBy: people[0], split: [people[0]] } });
  return { statuses: statuses, oneMore: [one.status, one.body] };
}

async function measure(s, code){
  const port = Number(new URL(s.base).port);
  const headers = { "X-Group-Code": code, "X-Real-IP": "10.7.0.1" };
  let t0 = Date.now();
  const first = await raw(s.base, "/api/group", { headers: headers });
  const firstMs = Date.now() - t0;
  t0 = Date.now();
  const again = await raw(s.base, "/api/group", { headers: headers });
  const againMs = Date.now() - t0;
  const zipped = await raw(s.base, "/api/group", { headers: Object.assign({ "Accept-Encoding": "gzip" }, headers) });
  // Ten reads whose answers are never read, and the page's own "/" meanwhile.
  global.gc && global.gc();
  const before = process.memoryUsage();
  const socks = [];
  const heads = [];
  for(let i = 0; i < 10; i++){
    heads.push(new Promise(function(resolve){
      const sock = connect(port, "127.0.0.1");
      sock.on("error", function(){});
      sock.once("data", function(){ sock.pause(); resolve(); });
      socks.push(sock);
      sock.write("GET /api/group HTTP/1.1\r\nHost: x\r\nAccept-Encoding: gzip\r\nX-Real-IP: 10.7.0.2\r\nX-Group-Code: " + code + "\r\n\r\n");
    }));
  }
  const tPage = Date.now();
  const page = await raw(s.base, "/");
  const pageMs = Date.now() - tPage;
  await Promise.all(heads);
  await new Promise(function(r){ setTimeout(r, 500); });
  global.gc && global.gc();
  const during = process.memoryUsage();
  socks.forEach(function(k){ k.destroy(); });
  // After a change the answer is built again, once: how long does the page's "/" wait meanwhile?
  await api(s.base, "PUT", "/api/group", { code: code, headers: ip("10.7.0.3"), body: { currency: "$" } });
  const tRebuild = Date.now();
  const rebuilt = raw(s.base, "/api/group", { headers: Object.assign({ "Accept-Encoding": "gzip" }, headers) }).then(function(){ return Date.now() - tRebuild; });
  const rebuildReadMs = await rebuilt;
  // The part that holds the server (everything else meanwhile waits): building the answer. The
  // gzip runs on Node's worker threads. Timed directly, three times.
  const builds = [];
  for(let i = 0; i < 3; i++){
    const tb = process.hrtime.bigint();
    Buffer.from(JSON.stringify(s.app.ledger.readGroup(code)), "utf8");
    builds.push(Math.round(Number(process.hrtime.bigint() - tb) / 1e6));
  }
  return {
    afterAChange: { rebuildReadMs: rebuildReadMs, buildHoldsServerMs: builds },
    expensesShown: JSON.parse(first.body.toString("utf8")).expenses.length,
    responseBytes: first.body.length, responseMB: mb(first.body.length), firstReadMs: firstMs, secondReadMs: againMs,
    gzipBytes: zipped.body.length, gzipMB: mb(zipped.body.length), contentEncoding: zipped.headers["content-encoding"] || "none",
    tenUnreadGzipReads: { pageStatus: page.status, pageMsMeanwhile: pageMs, rssMBBefore: mb(before.rss), rssMBHeld: mb(during.rss) }
  };
}

const s = await startTestServer({ trustProxy: true });
try{
  // Shape A, the largest read the caps allow: 5,000 expenses, each split among 4 (20,000 entries).
  const a = await fill(s, "wide-a-trip", "10.9.", 4, 5000, 4);
  out.A_fill = { adds: a.statuses.reduce(function(t, x){ t[x] = (t[x] || 0) + 1; return t; }, {}), oneMore: a.oneMore };
  out.A_read = await measure(s, "wide-a-trip");
  // Shape B: 100 people, 200 expenses each split among all 100 (20,000 entries).
  const b = await fill(s, "wide-b-trip", "10.10.", 100, 200, 100);
  out.B_fill = { adds: b.statuses.reduce(function(t, x){ t[x] = (t[x] || 0) + 1; return t; }, {}), oneMore: b.oneMore };
  out.B_read = await measure(s, "wide-b-trip");
  const pages = s.app.ledger.query("PRAGMA page_count")[0].page_count * s.app.ledger.query("PRAGMA page_size")[0].page_size;
  out.databaseMB = mb(pages);
}finally{
  await s.close();
}
console.log(JSON.stringify(out, null, 1));
