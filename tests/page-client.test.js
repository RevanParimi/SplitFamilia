// SF-035 and SF-036: the page's side of the API (ledger-client.js request, getGroup, sendChange)
// and its outbox (outbox.js), against the real server in-process with a temporary database.
// Each expected result is worked out from the cards and server/api.js's contract.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { startTestServer } from "./helpers/test-server.js";
import { request, getGroup, sendChange, changeRequest, GROUP_HEADER } from "../ledger-client.js";
import { createOutbox, memoryStore, overlay, forBalances } from "../outbox.js";
import { friendlyError } from "../sync-status.js";
import { computeBalances } from "../money.js";

let t;
before(async function(){ t = await startTestServer({ guessLimit: 100000, writeLimit: 100000 }); });
after(async function(){ await t.close(); });

let seq = 0;
const newCode = function(){ return "page-trip-" + (++seq); };
const opts = function(extra){ return Object.assign({ baseUrl: t.base }, extra); };
const person = function(code, id, name){ return { kind: "person", code: code, id: id, name: name }; };
const expense = function(code, id, paise, paidBy, split){
  return { kind: "expense", code: code, id: id, date: "2026-09-30T06:00:00.000Z", desc: "Tea " + id, amountPaise: paise, paidBy: paidBy, split: split };
};

test("start a new group: its create answers with version 1, and reading it gives ₹ and nothing else", async function(){
  const code = newCode();
  const created = await sendChange({ kind: "group", code: code, currency: "₹", create: true }, opts());
  assert.equal(created.status, 200);
  assert.deepEqual(created.body, { version: 1 });
  assert.deepEqual(await getGroup(code, opts()), { status: 200, group: { currency: "₹", version: 1, people: [], expenses: [] } });
});

test("join: a group that exists is read whole; an unknown one is 404; a bad code is 400", async function(){
  const code = newCode();
  await sendChange({ kind: "group", code: code, currency: "₹" }, opts());
  await sendChange(person(code, "asha", "Asha"), opts());
  const found = await getGroup(code, opts());
  assert.equal(found.status, 200);
  assert.deepEqual(found.group.people, [{ id: "asha", name: "Asha" }]);
  assert.equal((await getGroup("no-such-trip", opts())).status, 404);
  assert.equal(friendlyError("not-found"), "No group found with that code. Check it, or ask for the invite link.");
  assert.equal((await getGroup("Goa-Trip", opts())).status, 400);
});

test("add, remove and currency: each change answers as the contract says, and the group shows it", async function(){
  const code = newCode();
  await sendChange({ kind: "group", code: code, currency: "₹" }, opts());
  assert.equal((await sendChange(person(code, "asha", "Asha"), opts())).status, 201);
  assert.equal((await sendChange(person(code, "ben", "Ben"), opts())).status, 201);
  assert.equal((await sendChange(expense(code, "tea", 1000, "asha", ["asha", "ben"]), opts())).status, 201);
  assert.equal((await sendChange({ kind: "group", code: code, currency: "$" }, opts())).status, 200);
  assert.equal((await sendChange({ kind: "expense-delete", code: code, id: "tea" }, opts())).status, 200);
  assert.equal((await sendChange({ kind: "person-delete", code: code, id: "ben", name: "Ben" }, opts())).status, 200);
  const g = (await getGroup(code, opts())).group;
  assert.equal(g.currency, "$");
  assert.deepEqual(g.people, [{ id: "asha", name: "Asha" }]);
  assert.deepEqual(g.expenses, []);
  assert.equal(g.version, 7); // create 1, then six changes
});

test("the code goes only in the header, never in the URL, and only the change's own fields are sent", async function(){
  const seen = [];
  const spy = function(url, init){ seen.push({ url: url, init: init }); return fetch(url, init); };
  const code = newCode();
  await sendChange({ kind: "group", code: code, currency: "₹", create: true }, opts({ fetch: spy }));
  await sendChange(Object.assign(person(code, "asha", "Asha"), { key: 7, waiting: true }), opts({ fetch: spy }));
  await sendChange({ kind: "person-delete", code: code, id: "asha", name: "Asha" }, opts({ fetch: spy }));
  await getGroup(code, opts({ fetch: spy }));
  seen.forEach(function(s){
    assert.doesNotMatch(s.url, new RegExp(code), s.url);
    assert.equal(s.init.headers[GROUP_HEADER], code);
  });
  assert.deepEqual(JSON.parse(seen[0].init.body), { currency: "₹" });
  assert.deepEqual(JSON.parse(seen[1].init.body), { id: "asha", name: "Asha" });
  assert.equal(seen[2].init.body, undefined);
  assert.deepEqual(changeRequest({ kind: "expense-delete", code: code, id: "e-1" }), { method: "DELETE", path: "/api/expenses/e-1" });
});

test("the server's refusals come out as plain words, never its own text (F-6)", async function(){
  const full = await startTestServer({ maxExpenses: 2 });
  try{
    const o = { baseUrl: full.base };
    const code = newCode();
    await sendChange({ kind: "group", code: code, currency: "₹" }, o);
    await sendChange(person(code, "asha", "Asha"), o);
    await sendChange(expense(code, "e1", 1000, "asha", ["asha"]), o);
    const inUse = await sendChange({ kind: "person-delete", code: code, id: "asha" }, o);
    assert.equal(inUse.status, 409);
    assert.equal(friendlyError({ code: inUse.body.error, field: inUse.body.field }, "person-delete"),
      "That person is in an expense now, so they can't be removed. Delete their expenses first.");
    // Ben was removed on another phone before this expense arrived.
    const gone = await sendChange(expense(code, "e3", 1000, "asha", ["asha", "ben"]), o);
    assert.equal(gone.status, 400);
    assert.equal(friendlyError({ code: gone.body.error, field: gone.body.field }, "expense"),
      "Someone it's split among isn't in the group any more, or it's split among more than 100 people.");
    assert.equal((await sendChange(expense(code, "e2", 1000, "asha", ["asha"]), o)).status, 201);
    const isFull = await sendChange(expense(code, "e4", 1000, "asha", ["asha"]), o);
    assert.equal(isFull.status, 409);
    assert.equal(friendlyError({ code: isFull.body.error, field: isFull.body.field }, "expense"), "This group is full: it can't take more expenses.");
  }finally{
    await full.close();
  }
});

test("no connection, or no answer in time, is status 0: 'try again later', not a refusal", async function(){
  // A port where nothing listens.
  const closed = await new Promise(function(resolve){
    const s = createServer();
    s.listen(0, "127.0.0.1", function(){ const port = s.address().port; s.close(function(){ resolve(port); }); });
  });
  assert.equal((await getGroup("any-trip", { baseUrl: "http://127.0.0.1:" + closed })).status, 0);
  // A server that takes the connection and never answers.
  const silent = createServer(function(){});
  await new Promise(function(r){ silent.listen(0, "127.0.0.1", r); });
  try{
    const res = await request("GET", "/api/group", "any-trip", undefined, { baseUrl: "http://127.0.0.1:" + silent.address().port, timeoutMs: 200 });
    assert.equal(res.status, 0);
  }finally{
    silent.close();
  }
});

// ---------- the outbox against the real server (SF-036) ----------

// A fetch that fails like a phone with no signal while `net.online` is false.
function phoneFetch(net){
  return function(url, init){
    if(!net.online) return Promise.reject(new TypeError("Failed to fetch"));
    return fetch(url, init);
  };
}

test("offline: delete 'Tea' and add 'Taxi' wait as 2 changes; online, the server holds exactly Taxi (the T-03 probe's E2/E3)", async function(){
  const code = newCode();
  // The group as it was: Asha and Ben, and "Tea" (₹10.00 by Asha, split between both).
  for(const c of [{ kind: "group", code: code, currency: "₹" }, person(code, "asha", "Asha"), person(code, "ben", "Ben"),
    expense(code, "tea", 1000, "asha", ["asha", "ben"])]) await sendChange(c, opts());
  const copy = (await getGroup(code, opts())).group;

  const net = { online: false };
  const confirmed = [];
  const box = createOutbox({
    store: memoryStore(),
    send: function(c){ return sendChange(c, opts({ fetch: phoneFetch(net) })); },
    onConfirmed: function(c){ confirmed.push(c.kind + " " + c.id); }
  });
  await box.add({ kind: "expense-delete", code: code, id: "tea", desc: "Tea" });
  await box.add(expense(code, "taxi", 25000, "ben", ["asha", "ben"]));
  assert.equal((await box.flush()).state, "wait");
  assert.equal(box.count(code), 2);
  // Balances while waiting already include both: Taxi ₹250.00 by Ben, split two ways → Asha owes Ben ₹125.00.
  const view = overlay(copy, box.changes(), code);
  assert.deepEqual(view.expenses.map(function(e){ return e.id; }), ["taxi"]);
  assert.deepEqual(Object.fromEntries(computeBalances(view.people, forBalances(view.expenses))), { asha: -12500, ben: 12500 });

  net.online = true;
  assert.deepEqual(await box.flush(), { state: "done" });
  assert.deepEqual(confirmed, ["expense-delete tea", "expense taxi"]);
  assert.equal(box.count(code), 0);
  const after = (await getGroup(code, opts())).group;
  assert.deepEqual(after.expenses.map(function(e){ return [e.id, e.amountPaise, e.paidBy, e.split]; }), [["taxi", 25000, "ben", ["asha", "ben"]]]);
  const rows = t.app.ledger.query("SELECT id, deleted_at IS NOT NULL AS deleted FROM expenses WHERE group_code = ? ORDER BY id", [code]);
  assert.deepEqual(rows.map(function(r){ return [r.id, r.deleted]; }), [["taxi", 0], ["tea", 1]]);
});

test("two phones: both adds are kept, and deleting what the other already deleted is harmless", async function(){
  const code = newCode();
  for(const c of [{ kind: "group", code: code, currency: "₹" }, person(code, "asha", "Asha"),
    expense(code, "tea", 1000, "asha", ["asha"])]) await sendChange(c, opts());
  const phones = [0, 1].map(function(){
    return createOutbox({ store: memoryStore(), send: function(c){ return sendChange(c, opts()); } });
  });
  await phones[0].add(expense(code, "from-a", 500, "asha", ["asha"]));
  await phones[0].add({ kind: "expense-delete", code: code, id: "tea" });
  await phones[1].add(expense(code, "from-b", 700, "asha", ["asha"]));
  await phones[1].add({ kind: "expense-delete", code: code, id: "tea" });
  const results = await Promise.all([phones[0].flush(), phones[1].flush()]);
  assert.deepEqual(results, [{ state: "done" }, { state: "done" }]);
  const ids = (await getGroup(code, opts())).group.expenses.map(function(e){ return e.id; }).sort();
  assert.deepEqual(ids, ["from-a", "from-b"]);
});

test("a change sent twice (its answer lost) leaves one row on the real server", async function(){
  const code = newCode();
  await sendChange({ kind: "group", code: code, currency: "₹" }, opts());
  await sendChange(person(code, "asha", "Asha"), opts());
  const e = expense(code, "tea", 1000, "asha", ["asha"]);
  assert.equal((await sendChange(e, opts())).status, 201);
  assert.equal((await sendChange(e, opts())).status, 200);
  assert.equal(t.app.ledger.query("SELECT COUNT(*) AS n FROM expenses WHERE group_code = ?", [code])[0].n, 1);
  assert.equal(t.app.ledger.query("SELECT COUNT(*) AS n FROM expense_split WHERE group_code = ?", [code])[0].n, 1);
});
