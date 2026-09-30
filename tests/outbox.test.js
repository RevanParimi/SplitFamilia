// outbox.js (SF-036) as a pure module: a fake store and a fake network. The expected results are
// worked out from the card: changes go in order, one is removed only when the server confirms it,
// a refused one is dropped with its message, and deletes count like any change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOutbox, memoryStore, outcome, applyChange, overlay, forBalances, EMPTY_GROUP } from "../outbox.js";
import { toPaise, computeBalances, MAX_AMOUNT_PAISE } from "../money.js";

const CODE = "goa-trip-2026";
const person = function(id, name){ return { kind: "person", code: CODE, id: id, name: name }; };
const expense = function(id, paise, paidBy, split){
  return { kind: "expense", code: CODE, id: id, date: "2026-09-30T06:00:00.000Z", desc: "Tea " + id, amountPaise: paise, paidBy: paidBy, split: split };
};

// A fake server that keeps rows by ID, as the real one does: an ID it has is left alone, and a
// delete of what isn't there still succeeds. `answer(change)` may override the status.
function fakeServer(){
  const server = { online: true, sent: [], people: new Map(), expenses: new Map(), answer: null, dropAnswer: 0 };
  server.send = async function(change){
    if(!server.online) return { status: 0, body: null, retryAfter: 0 };
    server.sent.push(change.kind + " " + change.id);
    const forced = server.answer && server.answer(change);
    if(forced) return forced;
    if(change.kind === "person") server.people.set(change.id, change.name);
    if(change.kind === "expense" && !server.expenses.has(change.id)) server.expenses.set(change.id, change);
    if(change.kind === "person-delete") server.people.delete(change.id);
    if(change.kind === "expense-delete") server.expenses.delete(change.id);
    // The server applied it, but the answer never reached the phone (the signal dropped).
    if(server.dropAnswer > 0){
      server.dropAnswer--;
      throw new TypeError("Failed to fetch");
    }
    return { status: 200, body: { version: server.sent.length }, retryAfter: 0 };
  };
  return server;
}

function setup(server, store){
  const log = { confirmed: [], refused: [], changes: 0 };
  const box = createOutbox({
    store: store || memoryStore(),
    send: server.send,
    onConfirmed: function(c){ log.confirmed.push(c.id); },
    onRefused: function(c, body){ log.refused.push([c.id, body && body.error, body && body.field]); },
    onChange: function(){ log.changes++; }
  });
  return { box: box, log: log };
}

// ---------- what an answer means ----------

test("2xx is confirmed; 400, 404, 409 are refused; no connection, 408, 429 and 5xx wait", function(){
  for(const s of [200, 201, 204]) assert.equal(outcome(s), "confirmed", String(s));
  for(const s of [400, 404, 405, 409, 413, 415]) assert.equal(outcome(s), "refused", String(s));
  for(const s of [0, 408, 429, 500, 502, 503]) assert.equal(outcome(s), "retry", String(s));
});

// ---------- the outbox ----------

test("offline, changes wait in order; back online they are sent in that order and each is removed", async function(){
  const server = fakeServer();
  server.online = false;
  const { box, log } = setup(server);
  await box.add(person("asha", "Asha"));
  await box.add(expense("tea", 1000, "asha", ["asha"]));
  await box.add({ kind: "expense-delete", code: CODE, id: "old" });
  assert.deepEqual(await box.flush(), { state: "wait", retryAfter: 0 });
  assert.equal(box.count(CODE), 3);
  server.online = true;
  assert.deepEqual(await box.flush(), { state: "done" });
  assert.deepEqual(server.sent, ["person asha", "expense tea", "expense-delete old"]);
  assert.deepEqual(log.confirmed, ["asha", "tea", "old"]);
  assert.equal(box.count(CODE), 0);
});

test("a refused change is dropped with its reason, and the next one is still sent", async function(){
  const server = fakeServer();
  server.answer = function(c){
    return c.id === "full" ? { status: 409, body: { error: "failed-precondition", field: "group-full" }, retryAfter: 0 } : null;
  };
  const { box, log } = setup(server);
  await box.add(person("full", "Zed"));
  await box.add(person("ben", "Ben"));
  assert.deepEqual(await box.flush(), { state: "done" });
  assert.deepEqual(log.refused, [["full", "failed-precondition", "group-full"]]);
  assert.deepEqual(log.confirmed, ["ben"]);
  assert.equal(box.count(), 0);
  // Never retried: another flush sends nothing.
  await box.flush();
  assert.deepEqual(server.sent, ["person full", "person ben"]);
});

test("a change that must wait (429) stops the queue there, so nothing overtakes it", async function(){
  const server = fakeServer();
  let busy = true;
  server.answer = function(c){ return busy && c.id === "first" ? { status: 429, body: { error: "resource-exhausted" }, retryAfter: 120 } : null; };
  const { box } = setup(server);
  await box.add(person("first", "Asha"));
  await box.add(person("second", "Ben"));
  assert.deepEqual(await box.flush(), { state: "wait", retryAfter: 120 });
  assert.deepEqual(server.sent, ["person first"]);
  assert.equal(box.count(), 2);
  busy = false;
  assert.deepEqual(await box.flush(), { state: "done" });
  assert.deepEqual(server.sent, ["person first", "person first", "person second"]);
});

test("a lost answer means the change is sent again, and the server still holds one row", async function(){
  const server = fakeServer();
  server.dropAnswer = 1;
  const { box, log } = setup(server);
  await box.add(expense("tea", 1000, "asha", ["asha"]));
  assert.equal((await box.flush()).state, "wait");
  assert.equal(box.count(), 1);
  assert.equal((await box.flush()).state, "done");
  assert.deepEqual(server.sent, ["expense tea", "expense tea"]);
  assert.equal(server.expenses.size, 1);
  assert.deepEqual(log.confirmed, ["tea"]);
});

test("the count includes deletes (the T-03 review's F-5), per group", async function(){
  const server = fakeServer();
  server.online = false;
  const { box } = setup(server);
  await box.add({ kind: "expense-delete", code: CODE, id: "tea" });
  await box.add(expense("taxi", 25000, "asha", ["asha", "ben"]));
  await box.add({ kind: "person-delete", code: "other-group", id: "zed" });
  assert.equal(box.count(CODE), 2);
  assert.equal(box.count("other-group"), 1);
  assert.equal(box.count(), 3);
  assert.deepEqual(box.changes(CODE).map(function(c){ return c.kind; }), ["expense-delete", "expense"]);
});

test("two flushes at once send each change once, and a change added during a flush is sent too", async function(){
  const server = fakeServer();
  const { box } = setup(server);
  await box.add(person("a", "A"));
  const one = box.flush();
  const two = box.flush();
  await box.add(person("b", "B"));
  const three = box.flush();
  await Promise.all([one, two, three]);
  assert.deepEqual(server.sent, ["person a", "person b"]);
  assert.equal(box.count(), 0);
});

test("every send runs inside the lock, so two tabs never send at once", async function(){
  const server = fakeServer();
  let inside = 0;
  let most = 0;
  const box = createOutbox({
    store: memoryStore(),
    send: async function(c){ most = Math.max(most, inside); return server.send(c); },
    lock: async function(fn){ inside++; try{ return await fn(); }finally{ inside--; } }
  });
  await box.add(person("a", "A"));
  await box.flush();
  assert.equal(most, 1);
});

test("what waited when the page closed is loaded again, in order, from the phone's store", async function(){
  const store = memoryStore();
  const server = fakeServer();
  server.online = false;
  const first = setup(server, store);
  await first.box.add(person("asha", "Asha"));
  await first.box.add(person("ben", "Ben"));
  const second = setup(server, store);
  await second.box.load();
  assert.deepEqual(second.box.changes(CODE).map(function(c){ return c.id; }), ["asha", "ben"]);
  server.online = true;
  await second.box.flush();
  assert.deepEqual(server.sent, ["person asha", "person ben"]);
});

test("a store that fails leaves the changes where they are, and says wait", async function(){
  const store = memoryStore();
  const server = fakeServer();
  const { box } = setup(server, store);
  await box.add(person("asha", "Asha"));
  const remove = store.remove;
  store.remove = async function(){ throw new Error("QuotaExceededError"); };
  assert.deepEqual(await box.flush(), { state: "wait", retryAfter: 0 });
  store.remove = remove;
  assert.equal((await box.flush()).state, "done"); // sent again: harmless, the server ignores the ID
  assert.equal(server.people.size, 1);
});

// ---------- what the page shows ----------

test("the page shows the server's copy with the waiting changes on top, marked as waiting", function(){
  const copy = { currency: "₹", version: 7, people: [{ id: "asha", name: "Asha" }, { id: "ben", name: "Ben" }],
    expenses: [expense("tea", 1000, "asha", ["asha", "ben"])].map(function(e){ return { id: e.id, date: e.date, desc: e.desc, amountPaise: e.amountPaise, paidBy: e.paidBy, split: e.split }; }) };
  const waiting = [
    { kind: "expense-delete", code: CODE, id: "tea", key: 1 },
    expense("taxi", 25000, "ben", ["asha", "ben"]),
    person("chitra", "Chitra"),
    { kind: "group", code: CODE, currency: "$" },
    person("zed", "Zed from another group")
  ];
  waiting[4].code = "other-group";
  const view = overlay(copy, waiting, CODE);
  assert.equal(view.currency, "$");
  assert.equal(view.version, 7);
  assert.deepEqual(view.people.map(function(p){ return [p.id, Boolean(p.waiting)]; }), [["asha", false], ["ben", false], ["chitra", true]]);
  assert.deepEqual(view.expenses.map(function(e){ return [e.id, Boolean(e.waiting)]; }), [["taxi", true]]);
  // The copy itself is untouched.
  assert.equal(copy.expenses.length, 1);
  assert.equal(copy.currency, "₹");
  // With no copy yet (a new group, or an offline open of a new link), the waiting changes alone.
  assert.deepEqual(overlay(null, [person("asha", "Asha")], CODE).people, [{ id: "asha", name: "Asha", waiting: true }]);
  assert.deepEqual(overlay(null, [], CODE), EMPTY_GROUP);
});

test("applying a change the server already has, or deleting what isn't there, changes nothing", function(){
  const g = { currency: "₹", version: 3, people: [{ id: "asha", name: "Asha" }], expenses: [] };
  assert.deepEqual(applyChange(g, person("asha", "Asha again")), g);
  assert.deepEqual(applyChange(g, { kind: "person-delete", code: CODE, id: "nobody" }), g);
  assert.deepEqual(applyChange(g, { kind: "expense-delete", code: CODE, id: "nothing" }), g);
});

test("balances while changes wait include them: ₹100.00 by Asha split three ways, then ₹0.05 by Ben", function(){
  // By hand: 10000 ÷ 3 = 3333 r 1, the extra paisa to the first ID in code-unit order (asha):
  // asha 3334, ben 3333, chitra 3333. 5 ÷ 3 = 1 r 2: asha 2, ben 2, chitra 1.
  // asha: +10000 − 3334 − 2 = +6664; ben: +5 − 3333 − 2 = −3330; chitra: −3333 − 1 = −3334. Sum 0.
  const view = overlay(null, [
    person("asha", "Asha"), person("ben", "Ben"), person("chitra", "Chitra"),
    expense("e1", 10000, "asha", ["asha", "ben", "chitra"]),
    expense("e2", 5, "ben", ["asha", "ben", "chitra"])
  ], CODE);
  const balances = computeBalances(view.people, forBalances(view.expenses));
  assert.deepEqual(Object.fromEntries(balances), { asha: 6664, ben: -3330, chitra: -3334 });
});

test("money.js reads back exactly the server's paise for every amount allowed", function(){
  // amountPaise / 100 then Math.round(× 100): checked for every amount up to ₹20,000.00, the top
  // of the range, and 200,000 amounts spread over the rest.
  const bad = [];
  const check = function(p){ if(toPaise(forBalances([{ amountPaise: p }])[0].amount) !== p) bad.push(p); };
  for(let p = 1; p <= 2000000; p++) check(p);
  for(let p = MAX_AMOUNT_PAISE - 200000; p <= MAX_AMOUNT_PAISE; p++) check(p);
  let x = 12345;
  for(let i = 0; i < 200000; i++){
    x = (x * 1103515245 + 12345) % 2147483648;
    check(1 + (x % MAX_AMOUNT_PAISE));
  }
  assert.deepEqual(bad, []);
});
