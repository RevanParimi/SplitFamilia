// SF-037: the move from Firestore (scripts/move-from-firestore.mjs) with fake Firestore responses,
// and end to end against the real server in-process with a temporary database. Nothing here
// reaches Firestore or any real group. Expected values are worked out by hand from the card.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTestServer } from "./helpers/test-server.js";
import {
  readFirestoreGroup, planGroup, sameBalances, fingerprint, importGroup, checkGroupOnServer, reportText, summaryLine, main
} from "../scripts/move-from-firestore.mjs";

const PROJECT = "demo-project";
const DOCS = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents/groups/";
const TOKEN = "a-test-import-token-of-32-chars!";

// Firestore's REST form of a document.
function fsDoc(path, fields){
  const encode = function(v){
    if(typeof v === "string") return { stringValue: v };
    if(Number.isInteger(v)) return { integerValue: String(v) };
    if(typeof v === "number") return { doubleValue: v };
    if(Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
    return { nullValue: null };
  };
  const out = { name: "projects/" + PROJECT + "/databases/(default)/documents/groups/" + path, fields: {} };
  Object.keys(fields).forEach(function(k){ out.fields[k] = encode(fields[k]); });
  return out;
}

// A fake Firestore: `groups` maps a code to { doc (fields or null), people: [[id, name]], expenses: [[id, fields]] }.
// Lists come back `pageSize` at a time with nextPageToken, as the real API does.
function fakeFirestore(groups, pageSize){
  const calls = [];
  const fetchFn = async function(url){
    calls.push(url);
    const u = new URL(url);
    const rest = decodeURIComponent(u.pathname.split("/documents/groups/")[1]);
    const [code, coll] = rest.split("/");
    const g = groups[code];
    const json = function(status, body){ return { status: status, ok: status === 200, json: async function(){ return body; } }; };
    if(!coll){
      return g && g.doc ? json(200, fsDoc(code, g.doc)) : json(404, { error: { code: 404, status: "NOT_FOUND" } });
    }
    const all = (g && g[coll] || []).map(function(d){
      return fsDoc(code + "/" + coll + "/" + d[0], coll === "people" ? { name: d[1] } : d[1]);
    });
    const size = pageSize || 300;
    const start = Number(u.searchParams.get("pageToken") || 0);
    const page = all.slice(start, start + size);
    const body = page.length ? { documents: page } : {};
    if(start + size < all.length) body.nextPageToken = String(start + size);
    return json(200, body);
  };
  return { fetch: fetchFn, calls: calls };
}

const exp = function(amount, paidBy, split, desc, date){
  return { date: date || "2026-09-29T06:30:00.000Z", desc: desc || "Hotel", amount: amount, paidBy: paidBy, split: split };
};

// The family's shape: a group document, three people, a removed person still in a split, a
// decimal amount, a flagged one ("12" as text), and a group with no group document.
const GROUPS = {
  "goa-trip-2026": {
    doc: { currency: "₹" },
    people: [["asha1", "Asha"], ["ben22", "Ben"], ["chitra3", "Chitra"]],
    expenses: [
      ["e1", exp(99.5, "asha1", ["asha1", "ben22"], "Tea")],
      ["e2", exp(100, "ben22", ["asha1", "ben22", "chitra3", "zedGone"], "Taxi")],
      ["e3", exp("12", "asha1", ["asha1"], "Bad amount")]
    ]
  },
  "people-only-trip": {
    doc: null,
    people: [["p1", "Dev"]],
    expenses: []
  }
};

test("a group with its own document, and one with only people (no group document), are both read", async function(){
  const fs = fakeFirestore(GROUPS);
  const a = await readFirestoreGroup("goa-trip-2026", { project: PROJECT, fetch: fs.fetch });
  assert.equal(a.found, true);
  assert.equal(a.hasGroupDocument, true);
  assert.equal(a.currency, "₹");
  assert.deepEqual(a.people, [{ id: "asha1", name: "Asha" }, { id: "ben22", name: "Ben" }, { id: "chitra3", name: "Chitra" }]);
  assert.deepEqual(a.expenses[0], { id: "e1", date: "2026-09-29T06:30:00.000Z", desc: "Tea", amount: 99.5, paidBy: "asha1", split: ["asha1", "ben22"] });
  const b = await readFirestoreGroup("people-only-trip", { project: PROJECT, fetch: fs.fetch });
  assert.equal(b.found, true);
  assert.equal(b.hasGroupDocument, false);
  assert.equal(planGroup(b).payload.currency, "₹");
  const none = await readFirestoreGroup("no-such-trip", { project: PROJECT, fetch: fs.fetch });
  assert.equal(none.found, false);
  // The code only ever goes in Firestore's own URL path.
  fs.calls.forEach(function(u){ assert.ok(u.startsWith(DOCS), u); });
});

test("long collections are read page by page", async function(){
  const many = { "big-trip": { doc: { currency: "₹" }, people: Array.from({ length: 7 }, function(_, i){ return ["p" + i, "P" + i]; }), expenses: [] } };
  const g = await readFirestoreGroup("big-trip", { project: PROJECT, fetch: fakeFirestore(many, 3).fetch });
  assert.equal(g.people.length, 7);
});

test("the plan: 99.5 → 9950 paise; '12' left out and listed; a removed person keeps their share; balances kept", async function(){
  const plan = planGroup(await readFirestoreGroup("goa-trip-2026", { project: PROJECT, fetch: fakeFirestore(GROUPS).fetch }));
  assert.deepEqual(plan.payload.expenses.map(function(e){ return [e.id, e.amountPaise, e.split]; }),
    [["e1", 9950, ["asha1", "ben22"]], ["e2", 10000, ["asha1", "ben22", "chitra3", "zedGone"]]]);
  assert.deepEqual(plan.left, [{ id: "e3", desc: "Bad amount", amount: "12", reason: "not counted today (amount)" }]);
  // By hand. Tea 9950 by Asha, 2 ways: 4975 each. Taxi 10000 by Ben, 4 ways: 2500 each.
  // Asha: +9950 − 4975 − 2500 = +2475; Ben: +10000 − 4975 − 2500 = +2525; Chitra −2500; zedGone −2500.
  assert.deepEqual(Object.fromEntries(plan.balancesToday), { asha1: 2475, ben22: 2525, chitra3: -2500, zedGone: -2500 });
  assert.equal(plan.keepsBalances, true);
  assert.deepEqual(plan.overLimits, []);
});

test("an expense the server can't take, but the page counts today, is flagged as changing the balances", function(){
  const plan = planGroup({ code: "odd-trip", found: true, hasGroupDocument: true, currency: "₹", people: [{ id: "a", name: "A" }],
    expenses: [Object.assign({ id: "x" }, exp(10, "a", ["a", "b"], "Lunch", "yesterday"))] });
  assert.deepEqual(plan.left.map(function(e){ return e.reason; }), ["the server can't take its date"]);
  assert.equal(plan.keepsBalances, false);
});

test("the balance check fails if one paisa differs (the card's break check)", function(){
  const a = new Map([["asha", 2475], ["ben", -2475]]);
  assert.equal(sameBalances(a, new Map([["asha", 2475], ["ben", -2475]])), true);
  assert.equal(sameBalances(a, new Map([["asha", 2476], ["ben", -2476]])), false);
  assert.equal(sameBalances(a, new Map([["asha", 2475], ["ben", -2475], ["chitra", 0]])), true);
  assert.equal(sameBalances(a, new Map([["asha", 2475]])), false);
  assert.notEqual(fingerprint(a), fingerprint(new Map([["asha", 2476], ["ben", -2476]])));
});

test("end to end: copy both groups to a local server, read them back, and every balance matches; again adds nothing", async function(){
  const s = await startTestServer({ importToken: TOKEN });
  try{
    const fs = fakeFirestore(GROUPS);
    for(const code of ["goa-trip-2026", "people-only-trip"]){
      const plan = planGroup(await readFirestoreGroup(code, { project: PROJECT, fetch: fs.fetch }));
      const first = await importGroup(plan, { server: s.base, token: TOKEN });
      assert.equal(first.status, 200, code);
      assert.equal(first.body.created, true);
      const check = await checkGroupOnServer(plan, { server: s.base });
      assert.equal(check.matches, true, code);
      const again = await importGroup(plan, { server: s.base, token: TOKEN });
      assert.equal(again.status, 200);
      assert.deepEqual(again.body.added, { people: 0, expenses: 0 });
      assert.equal(again.body.version, first.body.version);
    }
    // Stored as the plan said: whole paise, the removed person kept in the split.
    const rows = s.app.ledger.query("SELECT id, amount_paise AS p, typeof(amount_paise) AS t FROM expenses WHERE group_code = ? ORDER BY id", ["goa-trip-2026"]);
    assert.deepEqual(rows.map(function(r){ return [r.id, r.p, r.t]; }), [["e1", 9950, "integer"], ["e2", 10000, "integer"]]);
    assert.deepEqual(s.app.ledger.readGroup("goa-trip-2026").expenses[1].split, ["asha1", "ben22", "chitra3", "zedGone"]);
  }finally{
    await s.close();
  }
});

test("the import endpoint: off without a long token; a wrong token looks like no such path; bad bodies refused", async function(){
  const off = await startTestServer({ importToken: "too-short" });
  const on = await startTestServer({ importToken: TOKEN });
  try{
    const plan = planGroup({ code: "t-trip", found: true, hasGroupDocument: true, currency: "₹", people: [{ id: "a", name: "A" }], expenses: [] });
    assert.equal((await importGroup(plan, { server: off.base, token: "too-short" })).status, 404);
    assert.equal((await importGroup(plan, { server: on.base, token: TOKEN + "x" })).status, 404);
    assert.equal((await importGroup(plan, { server: on.base, token: "" })).status, 404);
    const post = function(body){
      return fetch(on.base + "/api/import", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + TOKEN }, body: JSON.stringify(body) });
    };
    assert.equal((await post({ code: "Bad-Code", currency: "₹", people: [], expenses: [] })).status, 400);
    assert.equal((await post({ code: "t-trip", currency: "₹", people: [{ id: "a", name: "" }], expenses: [] })).status, 400);
    assert.equal((await post({ code: "t-trip", currency: "₹", people: [{ id: "a", name: "A" }, { id: "a", name: "B" }], expenses: [] })).status, 400);
    assert.equal((await post({ code: "t-trip", currency: "₹", people: [], expenses: [{ id: "e", date: "x", desc: "d", amountPaise: 1, paidBy: "a", split: ["a"] }] })).status, 400);
    const tooMany = Array.from({ length: 101 }, function(_, i){ return { id: "p" + i, name: "P" }; });
    assert.equal((await post({ code: "t-trip", currency: "₹", people: tooMany, expenses: [] })).status, 400);
    // No log line holds the token or the code.
    on.logs.concat(off.logs).forEach(function(l){ assert.doesNotMatch(l, /test-import-token|t-trip|too-short/, l); });
  }finally{
    await off.close();
    await on.close();
  }
});

test("the import keeps the split-entry cap (D-18), and the dry run lists a group over it", async function(){
  const s = await startTestServer({ importToken: TOKEN, maxSplitEntries: 2 });
  try{
    const plan = planGroup({ code: "wide-trip", found: true, hasGroupDocument: true, currency: "₹", people: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }],
      expenses: [Object.assign({ id: "x" }, exp(30, "a", ["a", "b", "c"]))] });
    const res = await importGroup(plan, { server: s.base, token: TOKEN });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: "failed-precondition", field: "group-full" });
    assert.equal(s.app.ledger.groupVersion("wide-trip"), null);
  }finally{
    await s.close();
  }
  const split = Array.from({ length: 100 }, function(_, i){ return "p" + i; });
  const big = planGroup({ code: "huge-trip", found: true, hasGroupDocument: true, currency: "₹",
    people: split.map(function(id){ return { id: id, name: id }; }),
    expenses: Array.from({ length: 201 }, function(_, i){ return Object.assign({ id: "e" + i }, exp(100, "p0", split)); }) });
  assert.deepEqual(big.overLimits, ["more than 20000 split entries in all"]);
});

test("the terminal shows counts and fingerprints only; the owner's report has the names and balances", async function(){
  const plan = planGroup(await readFirestoreGroup("goa-trip-2026", { project: PROJECT, fetch: fakeFirestore(GROUPS).fetch }));
  const line = summaryLine(plan, 0);
  assert.equal(line, "group 1: 3 people, 2 expenses to copy, 1 expenses and 0 people left out; balances " + fingerprint(plan.balancesToday) + ", kept by the copy");
  assert.doesNotMatch(line, /goa|Asha|Ben|Tea|₹/);
  const report = reportText([plan], "2026-09-30T00:00:00.000Z");
  assert.match(report, /Group 1: goa-trip-2026/);
  assert.match(report, /Asha: is owed ₹24\.75/);
  assert.match(report, /\(removed: zedGone\): owes ₹25\.00/);
  assert.match(report, /Expense left out: "Bad amount", amount "12": not counted today \(amount\)/);
  assert.match(report, /The copy keeps every balance: yes/);
});

test("the command line refuses bad input before reading anything, and never prints a code", async function(){
  const lines = [];
  const out = function(l){ lines.push(l); };
  assert.equal(await main([], {}, out), 2);
  assert.equal(await main(["Not-A-Code"], {}, out), 2);
  assert.equal(await main(["--import", "https://example.invalid", "goa-trip-2026"], {}, out), 2);
  assert.equal(await main(["--import", "http://example.invalid", "goa-trip-2026"], { IMPORT_TOKEN: TOKEN }, out), 2);
  assert.equal(await main(["--codes-file", "no/such/file.txt"], {}, out), 2);
  assert.equal(await main(["--import", "https://example.invalid", "--token-file", "no/such/token.txt", "goa-trip-2026"], {}, out), 2);
  lines.forEach(function(l){ assert.doesNotMatch(l, /goa-trip|Not-A-Code/, l); });
});

test("the whole command against fakes: dry run, copy, check, with the report in a scratch file", async function(){
  const s = await startTestServer({ importToken: TOKEN });
  const dir = mkdtempSync(join(tmpdir(), "splitfamilia-move-"));
  const realFetch = globalThis.fetch;
  const fs = fakeFirestore(GROUPS);
  globalThis.fetch = function(url, init){ return String(url).startsWith("https://firestore.googleapis.com/") ? fs.fetch(url, init) : realFetch(url, init); };
  try{
    const lines = [];
    // The codes and the token come from files, as the move guide says, so neither is on a command line.
    writeFileSync(join(dir, "codes.txt"), "goa-trip-2026\npeople-only-trip\n");
    writeFileSync(join(dir, "token.txt"), TOKEN + "\n");
    const code = await main(["--project", PROJECT, "--import", s.base, "--report", join(dir, "report.txt"),
      "--codes-file", join(dir, "codes.txt"), "--token-file", join(dir, "token.txt")], {}, function(l){ lines.push(l); });
    assert.equal(code, 0, lines.join("\n"));
    assert.equal(lines[lines.length - 1], "Every balance matches to the paisa.");
    assert.equal(lines.filter(function(l){ return /: MATCH$/.test(l); }).length, 2);
    lines.forEach(function(l){ assert.doesNotMatch(l, /goa-trip|people-only|Asha|Dev|a-test-import-token/, l); });
    assert.match(readFileSync(join(dir, "report.txt"), "utf8"), /Chitra: owes ₹25\.00/);
  }finally{
    globalThis.fetch = realFetch;
    rmSync(dir, { recursive: true, force: true });
    await s.close();
  }
});
