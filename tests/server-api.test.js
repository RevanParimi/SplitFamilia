// SF-033: the ledger API on the real server (in-process, temporary database). Every case from
// tests/rules/firestore-rules.test.js is here, as the API's version of it. Each expected status
// was worked out by hand from the story card, not copied from the server's answers.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { connect } from "node:net";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { startTestServer, api, raw, REPO_ROOT } from "./helpers/test-server.js";
import { MAX_BODY_BYTES, WRITE_LIMIT, WRITE_WINDOW_MS, GUESS_WINDOW_MS, SWEEP_MS, createGuessLimiter, createWriteLimiter } from "../server/api.js";
import { MAX_EXPENSES, MAX_SPLIT_ENTRIES } from "../ledger-rules.js";
import { computeBalances, simplifyDebts } from "../money.js";
import { forBalances } from "../outbox.js";

const GROUP = "goa-trip-2026"; // an old-style code, made from the group's name
const NEW_GROUP = "goa-trip-7k2m9xqpwd"; // a new-style code with its random part
const BAD_CODES = ["Goa-Trip", "goa--trip", "-goa", "goa-", "goa_trip", "goa trip", "goa.trip", "a".repeat(81)];

let t;
// Every new group counts as an unknown code, and these tests send far more than 300 changes from
// one address, so this server allows many of both; the limits have their own tests at the end, on
// servers of their own.
before(async function(){ t = await startTestServer({ guessLimit: 100000, writeLimit: 100000 }); });
after(async function(){ await t.close(); });

let seq = 0;
// Each test gets its own group, like the rules tests' fresh start: Asha and Ben, and expense e1.
async function freshGroup(){
  const code = "trip-" + (++seq);
  assert.equal((await api(t.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } })).status, 200);
  assert.equal((await api(t.base, "POST", "/api/people", { code: code, body: { id: "asha", name: "Asha" } })).status, 201);
  assert.equal((await api(t.base, "POST", "/api/people", { code: code, body: { id: "ben", name: "Ben" } })).status, 201);
  assert.equal((await api(t.base, "POST", "/api/expenses", { code: code, body: expense() })).status, 201);
  return code;
}

// An expense exactly as the page will send it, with fields changed or removed by `changes`
// (a value of undefined removes the field).
function expense(changes){
  const e = { id: "e1", date: "2026-09-29T06:30:00.000Z", desc: "Hotel", amountPaise: 30000, paidBy: "asha", split: ["asha", "ben"] };
  Object.entries(changes || {}).forEach(function([k, v]){ if(v === undefined) delete e[k]; else e[k] = v; });
  return e;
}
const ids = function(n){ return Array.from({ length: n }, function(_, i){ return "p" + i; }); };
const get = function(code){ return api(t.base, "GET", "/api/group", { code: code }); };
const addPerson = function(code, body){ return api(t.base, "POST", "/api/people", { code: code, body: body }); };
const addExpense = function(code, body){ return api(t.base, "POST", "/api/expenses", { code: code, body: body }); };

// ---------- allowed ----------

test("every API answer is no-store and nosniff: reads, changes and refusals alike", async function(){
  // A browser or proxy must never keep group data, not even a change's answer or an error.
  const code = await freshGroup();
  const answers = [
    await get(code),
    await api(t.base, "PUT", "/api/group", { code: code, body: { currency: "$" } }),
    await addPerson(code, { id: "zed", name: "Zed" }),
    await addPerson(code, { id: "zed", name: "Zed" }),
    await api(t.base, "DELETE", "/api/people/zed", { code: code }),
    await get("no-such-group"),
    await api(t.base, "GET", "/api/group", { code: "Bad-Code" }),
    await addPerson(code, { id: "x" }),
    await api(t.base, "DELETE", "/api/people/asha", { code: code }),
    await api(t.base, "GET", "/api/nothing-here", { code: code })
  ];
  assert.deepEqual(answers.map(function(r){ return r.status; }), [200, 200, 201, 200, 200, 404, 400, 400, 409, 404]);
  answers.forEach(function(r, i){
    assert.equal(r.headers.get("cache-control"), "no-store", "answer " + i);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff", "answer " + i);
  });
});

test("allowed: open a group by its code", async function(){
  const code = await freshGroup();
  const res = await get(code);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  // Created (1), Asha (2), Ben (3), e1 (4).
  assert.deepEqual(res.body, {
    currency: "₹",
    version: 4,
    people: [{ id: "asha", name: "Asha" }, { id: "ben", name: "Ben" }],
    expenses: [{ id: "e1", date: "2026-09-29T06:30:00.000Z", desc: "Hotel", amountPaise: 30000, paidBy: "asha", split: ["asha", "ben"] }]
  });
  // The longest code is fine.
  assert.equal((await api(t.base, "PUT", "/api/group", { code: "a".repeat(80), body: { currency: "₹" } })).status, 200);
  assert.equal((await get("a".repeat(80))).status, 200);
});

test("an unknown code gives 404 not-found, which is what 'Join' needs", async function(){
  const res = await get("no-such-group");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: "not-found" });
  // Adding to, or deleting from, a group that doesn't exist doesn't create it.
  assert.equal((await addPerson("no-such-group", { id: "asha", name: "Asha" })).status, 404);
  assert.equal((await addExpense("no-such-group", expense())).status, 404);
  assert.equal((await api(t.base, "DELETE", "/api/people/asha", { code: "no-such-group" })).status, 404);
  assert.equal((await api(t.base, "DELETE", "/api/expenses/e1", { code: "no-such-group" })).status, 404);
  assert.equal((await get("no-such-group")).status, 404);
});

test("allowed: start a new group ({ currency: '₹' }) and change its currency", async function(){
  assert.deepEqual((await api(t.base, "PUT", "/api/group", { code: NEW_GROUP, body: { currency: "₹" } })).body, { version: 1 });
  assert.deepEqual((await api(t.base, "PUT", "/api/group", { code: NEW_GROUP, body: { currency: "$" } })).body, { version: 2 });
  assert.deepEqual((await api(t.base, "PUT", "/api/group", { code: NEW_GROUP, body: { currency: "Rs." } })).body, { version: 3 });
  assert.deepEqual((await api(t.base, "PUT", "/api/group", { code: NEW_GROUP, body: { currency: "€" } })).body, { version: 4 });
  const res = await get(NEW_GROUP);
  assert.deepEqual(res.body, { currency: "€", version: 4, people: [], expenses: [] });
  // A new group is found by 'Join' before anyone is added.
  assert.equal(res.status, 200);
});

test("allowed: add a person with a name of 1 to 60 characters, in any script", async function(){
  const code = await freshGroup();
  const names = ["Chitra", "C", "x".repeat(60), "अ".repeat(60), "😀".repeat(30)];
  for(let i = 0; i < names.length; i++){
    const res = await addPerson(code, { id: "n" + i, name: names[i] });
    assert.equal(res.status, 201, names[i]);
    assert.deepEqual(res.body, { version: 5 + i });
  }
  assert.deepEqual((await get(code)).body.people.slice(2).map(function(p){ return p.name; }), names);
});

test("allowed: add an expense exactly as the page sends it, at the edges of each limit", async function(){
  const code = await freshGroup();
  for(let i = 0; i < 50; i++) assert.equal((await addPerson(code, { id: "p" + i, name: "P" + i })).status, 201);
  const cases = [
    {}, { amountPaise: 9950 }, { amountPaise: 1 }, { amountPaise: 1000000000 },
    { desc: "d".repeat(200) }, { desc: "च".repeat(200) }, { split: ["asha"] }, { split: ids(50), paidBy: "p0" },
    { id: "a1b2C3d4E5f6G7h8I9j0" }, { id: "0b9b5a3e-6f7c-4d1a-9e2b-8c7d6e5f4a3b" }, { id: "x".repeat(64) },
    { date: "2026-09-29T06:30:00Z" }, { desc: "Chai; 2 cups' worth" }
  ];
  for(let i = 0; i < cases.length; i++){
    const body = expense(Object.assign({ id: "new" + i }, cases[i]));
    const res = await addExpense(code, body);
    assert.equal(res.status, 201, JSON.stringify(cases[i]).slice(0, 80));
  }
  const stored = (await get(code)).body.expenses;
  assert.equal(stored.length, 1 + cases.length);
  assert.equal(stored.find(function(e){ return e.id === "new3"; }).amountPaise, 1000000000);
  assert.deepEqual(stored.find(function(e){ return e.id === "new7"; }).split, ids(50));
  // And in a brand-new group once its people are there.
  await api(t.base, "PUT", "/api/group", { code: "fresh-" + code, body: { currency: "₹" } });
  await addPerson("fresh-" + code, { id: "asha", name: "Asha" });
  await addPerson("fresh-" + code, { id: "ben", name: "Ben" });
  assert.equal((await addExpense("fresh-" + code, expense())).status, 201);
});

test("allowed: delete a person no expense uses, and an expense", async function(){
  const code = await freshGroup();
  await addPerson(code, { id: "chitra", name: "Chitra" }); // version 5
  const del = await api(t.base, "DELETE", "/api/people/chitra", { code: code });
  assert.equal(del.status, 200);
  assert.deepEqual(del.body, { version: 6 });
  const delExp = await api(t.base, "DELETE", "/api/expenses/e1", { code: code });
  assert.equal(delExp.status, 200);
  assert.deepEqual(delExp.body, { version: 7 });
  const group = (await get(code)).body;
  assert.deepEqual(group.people.map(function(p){ return p.id; }), ["asha", "ben"]);
  assert.deepEqual(group.expenses, []);
  // Deleting again is harmless, and changes nothing.
  assert.deepEqual((await api(t.base, "DELETE", "/api/expenses/e1", { code: code })).body, { version: 7 });
  assert.deepEqual((await api(t.base, "DELETE", "/api/people/chitra", { code: code })).body, { version: 7 });
  assert.deepEqual((await api(t.base, "DELETE", "/api/people/nobody", { code: code })).body, { version: 7 });
});

// ---------- denied ----------

test("denied: listing every group (there is no endpoint for it)", async function(){
  for(const path of ["/api/groups", "/api/group/all", "/api", "/api/"]){
    assert.equal((await api(t.base, "GET", path, { code: GROUP })).status, 404, path);
  }
  // Without a code there is nothing to open.
  const res = await api(t.base, "GET", "/api/group");
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: "invalid-argument", field: "code" });
});

test("denied: reading people or expenses across groups", async function(){
  for(const path of ["/api/people", "/api/expenses", "/api/people/asha", "/api/expenses/e1"]){
    const res = await api(t.base, "GET", path, { code: GROUP });
    assert.equal(res.status, 405, path);
    assert.equal(res.body.error, "invalid-argument", path);
  }
});

test("denied (F-7): every operation with each code the app would never make", async function(){
  const code = await freshGroup();
  const calls = [
    ["GET", "/api/group", undefined],
    ["PUT", "/api/group", { currency: "₹" }],
    ["POST", "/api/people", { id: "zed", name: "Zed" }],
    ["DELETE", "/api/people/ben", undefined],
    ["POST", "/api/expenses", expense({ id: "e9" })],
    ["DELETE", "/api/expenses/e1", undefined],
    ["PUT", "/api/expenses/e1", expense({ id: "e1-edit" })],
    ["POST", "/api/expenses", expense({ id: "pay", paidBy: "ben", split: ["asha"], kind: "settlement" })],
    ["GET", "/api/group/events", undefined]
  ];
  for(const bad of BAD_CODES){
    for(const [method, path, body] of calls){
      const res = await api(t.base, method, path, { code: bad, body: body });
      assert.equal(res.status, 400, method + " " + path + " " + bad);
      assert.deepEqual(res.body, { error: "invalid-argument", field: "code" }, method + " " + path + " " + bad);
    }
  }
  // Nothing changed anywhere.
  assert.equal((await get(code)).body.version, 4);
});

test("denied: a group that isn't exactly { currency } of 1 to 3 characters", async function(){
  const code = await freshGroup();
  const bad = [
    [{ currency: "₹", name: "Goa" }, "fields"], [{}, "fields"], [{ currency: "" }, "currency"],
    [{ currency: "Rupe" }, "currency"], [{ currency: 1 }, "currency"], [{ owner: "x" }, "fields"],
    [{ currency: "  " }, "currency"], [["₹"], "fields"], [null, "fields"], ["₹", "fields"]
  ];
  for(const [body, field] of bad){
    const res = await api(t.base, "PUT", "/api/group", { code: code, body: JSON.stringify(body) });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.deepEqual(res.body, { error: "invalid-argument", field: field }, JSON.stringify(body));
    // A refused new group isn't created either.
    assert.equal((await api(t.base, "PUT", "/api/group", { code: "never-" + seq, body: JSON.stringify(body) })).status, 400);
  }
  assert.equal((await get("never-" + seq)).status, 404);
  assert.equal((await get(code)).body.currency, "₹");
});

test("denied: deleting a group", async function(){
  const code = await freshGroup();
  const res = await api(t.base, "DELETE", "/api/group", { code: code });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "GET, PUT");
  assert.equal((await get(code)).status, 200);
});

test("denied: a person that isn't exactly { id, name } with a name of 1 to 60 characters", async function(){
  const code = await freshGroup();
  const bad = [
    [{ id: "c", name: "Asha", admin: true }, "fields"], [{}, "fields"], [{ id: "c", name: "" }, "name"],
    [{ id: "c", name: "x".repeat(61) }, "name"], [{ id: "c", name: 7 }, "name"], [{ name: "Chitra" }, "fields"],
    [{ id: "", name: "Chitra" }, "id"], [{ id: "a/b", name: "Chitra" }, "id"], [{ id: "x".repeat(65), name: "Chitra" }, "id"],
    [{ id: 5, name: "Chitra" }, "id"], [{ id: "c", name: "   " }, "name"], [{ id: "c", name: "\ud800" }, "name"]
  ];
  for(const [body, field] of bad){
    const res = await addPerson(code, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.deepEqual(res.body, { error: "invalid-argument", field: field }, JSON.stringify(body));
  }
  assert.equal((await get(code)).body.people.length, 2);
});

test("denied: an expense that isn't ledger-shaped", async function(){
  const code = await freshGroup();
  const bad = [
    [{ amountPaise: "lots" }, "amountPaise"], [{ amountPaise: "300" }, "amountPaise"], [{ amountPaise: 0 }, "amountPaise"],
    [{ amountPaise: -5 }, "amountPaise"], [{ amountPaise: 1000000001 }, "amountPaise"], [{ amountPaise: 99.5 }, "amountPaise"],
    [{ amountPaise: null }, "amountPaise"], [{ amountPaise: undefined }, "fields"],
    [{ desc: "" }, "desc"], [{ desc: "d".repeat(201) }, "desc"], [{ desc: 5 }, "desc"], [{ desc: undefined }, "fields"],
    [{ split: [] }, "split"], [{ split: ids(101) }, "split"], [{ split: "asha" }, "split"], [{ split: undefined }, "fields"],
    [{ split: ["asha", "asha"] }, "split"], [{ split: ["asha", "nobody"] }, "split"],
    [{ paidBy: "" }, "paidBy"], [{ paidBy: 5 }, "paidBy"], [{ paidBy: undefined }, "fields"], [{ paidBy: "nobody" }, "paidBy"],
    [{ date: 20260929 }, "date"], [{ date: "" }, "date"], [{ date: undefined }, "fields"], [{ date: "yesterday" }, "date"],
    [{ date: "2026-13-45T06:30:00.000Z" }, "date"],
    [{ note: "extra field" }, "fields"], [{ amount: 300 }, "fields"], [{ id: "a b" }, "id"]
  ];
  for(let i = 0; i < bad.length; i++){
    const [changes, field] = bad[i];
    const res = await addExpense(code, expense(Object.assign({ id: "bad" + i }, changes)));
    assert.equal(res.status, 400, JSON.stringify(changes).slice(0, 60));
    assert.deepEqual(res.body, { error: "invalid-argument", field: field }, JSON.stringify(changes).slice(0, 60));
  }
  // JSON's 1e999 is Infinity, which is no amount.
  const inf = await api(t.base, "POST", "/api/expenses", { code: code, body: JSON.stringify(expense({ id: "inf" })).replace("30000", "1e999") });
  assert.equal(inf.status, 400);
  assert.equal((await get(code)).body.expenses.length, 1);
});

// A new group with nobody in it yet.
async function emptyGroup(){
  const code = "empty-" + (++seq);
  assert.equal((await api(t.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } })).status, 200);
  return code;
}

test("a group holds at most 100 people: the 101st gets 409 failed-precondition", async function(){
  const code = await emptyGroup();
  for(let i = 0; i < 100; i++){
    assert.equal((await addPerson(code, { id: "p" + i, name: "P" + i })).status, 201, "person " + (i + 1));
  }
  const full = await addPerson(code, { id: "p100", name: "One too many" });
  assert.equal(full.status, 409);
  assert.deepEqual(full.body, { error: "failed-precondition", field: "group-full" });
  // Sending someone already there again still succeeds (a replay), full or not.
  assert.equal((await addPerson(code, { id: "p5", name: "P5" })).status, 200);
  // After someone leaves there is room again.
  assert.equal((await api(t.base, "DELETE", "/api/people/p7", { code: code })).status, 200);
  assert.equal((await addPerson(code, { id: "p100", name: "Now fits" })).status, 201);
  assert.equal((await addPerson(code, { id: "p101", name: "Too many again" })).status, 409);
  assert.equal((await get(code)).body.people.length, 100);
});

test("F-6: a split of 100 people is accepted, and of 101 refused", async function(){
  const code = await emptyGroup();
  for(let i = 0; i < 100; i++) await addPerson(code, { id: "p" + i, name: "P" + i });
  assert.equal((await addExpense(code, expense({ id: "trek", paidBy: "p0", split: ids(100) }))).status, 201);
  const res = await addExpense(code, expense({ id: "one-more", paidBy: "p0", split: ids(101) }));
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: "invalid-argument", field: "split" });
  const stored = (await get(code)).body.expenses.find(function(e){ return e.id === "trek"; });
  assert.deepEqual(stored.split, ids(100));
});

test("the largest expense allowed fits in one request: 100 people with 64-character IDs", async function(){
  const code = await emptyGroup();
  const longIds = Array.from({ length: 100 }, function(_, i){ return String(i).padStart(4, "0") + "x".repeat(60); });
  for(const id of longIds) assert.equal((await addPerson(code, { id: id, name: "P" })).status, 201);
  const body = expense({ id: "y".repeat(64), paidBy: longIds[0], split: longIds, desc: "च".repeat(200), amountPaise: 1000000000 });
  const bytes = Buffer.byteLength(JSON.stringify(body));
  assert.ok(bytes > 6 * 1024 && bytes < MAX_BODY_BYTES, bytes + " bytes");
  assert.equal((await addExpense(code, body)).status, 201);
});

test("denied: editing a person, and changing an expense other than by PUT (SF-022's edit)", async function(){
  const code = await freshGroup();
  for(const [method, path, allow] of [["PUT", "/api/people/asha", "DELETE"], ["PATCH", "/api/people/asha", "DELETE"], ["PATCH", "/api/expenses/e1", "PUT, DELETE"], ["POST", "/api/expenses/e1", "PUT, DELETE"]]){
    const res = await api(t.base, method, path, { code: code, body: { name: "Asha K" } });
    assert.equal(res.status, 405, method + " " + path);
    assert.equal(res.headers.get("allow"), allow, method + " " + path);
  }
  // Sending an existing ID again doesn't overwrite it.
  assert.equal((await addPerson(code, { id: "asha", name: "Asha K" })).status, 200);
  assert.equal((await addExpense(code, expense({ amountPaise: 1 }))).status, 200);
  const group = (await get(code)).body;
  assert.equal(group.people[0].name, "Asha");
  assert.equal(group.expenses[0].amountPaise, 30000);
  assert.equal(group.version, 4);
});

// ---------- SF-022: editing an expense ----------

const edit = function(code, oldId, body){ return api(t.base, "PUT", "/api/expenses/" + oldId, { code: code, body: body }); };
// The group's balances in paise, worked out by money.js from what the server answers.
async function balancesOf(code){
  const group = (await get(code)).body;
  return Object.fromEntries(computeBalances(group.people, forBalances(group.expenses)));
}
const sum = function(b){ return Object.values(b).reduce(function(a, v){ return a + v; }, 0); };

test("SF-022: an edit changes the balances by exactly the difference, and they still sum to 0", async function(){
  // By hand. e1: ₹300.00 paid by Asha, split Asha and Ben: Asha +30000 − 15000 = +15000, Ben −15000.
  // Edited to ₹325.50: Asha +32550 − 16275 = +16275, Ben −16275: each moves by half the
  // ₹25.50 difference, 1275 paise. Then paid by Ben for Asha alone: Asha −32550, Ben +32550.
  const code = await freshGroup();
  assert.deepEqual(await balancesOf(code), { asha: 15000, ben: -15000 });
  const first = await edit(code, "e1", expense({ id: "e1-v2", amountPaise: 32550 }));
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { version: 5 });
  const after = await balancesOf(code);
  assert.deepEqual(after, { asha: 16275, ben: -16275 });
  assert.equal(after.asha - 15000, 1275);
  assert.equal(sum(after), 0);
  // The expense is counted once: the edited one, under its new ID, and the old one is gone.
  const group = (await get(code)).body;
  assert.deepEqual(group.expenses, [expense({ id: "e1-v2", amountPaise: 32550 })]);
  assert.equal(group.version, 5);
  // Description, payer and split change too, with the same checks as adding.
  assert.equal((await edit(code, "e1-v2", expense({ id: "e1-v3", desc: "Hotel, 2 nights", amountPaise: 32550, paidBy: "ben", split: ["asha"] }))).status, 200);
  assert.deepEqual(await balancesOf(code), { asha: -32550, ben: 32550 });
  assert.deepEqual((await get(code)).body.expenses.map(function(e){ return [e.id, e.desc]; }), [["e1-v3", "Hotel, 2 nights"]]);
});

test("SF-022: an edit sent again (its answer lost) succeeds and adds nothing; the version moved once", async function(){
  const code = await freshGroup();
  const body = expense({ id: "e1-v2", amountPaise: 45000 });
  assert.deepEqual((await edit(code, "e1", body)).body, { version: 5 });
  const again = await edit(code, "e1", body);
  assert.equal(again.status, 200);
  assert.deepEqual(again.body, { version: 5 });
  // Even after the edited expense was itself deleted, the replay brings nothing back.
  assert.equal((await api(t.base, "DELETE", "/api/expenses/e1-v2", { code: code })).status, 200);
  assert.deepEqual((await edit(code, "e1", body)).body, { version: 6 });
  assert.deepEqual((await get(code)).body.expenses, []);
});

test("SF-022: two phones edit the same expense: the second gets 409 gone, so it is never counted twice", async function(){
  const code = await freshGroup();
  assert.equal((await edit(code, "e1", expense({ id: "phone-a", amountPaise: 40000 }))).status, 200);
  const late = await edit(code, "e1", expense({ id: "phone-b", amountPaise: 50000 }));
  assert.equal(late.status, 409);
  assert.deepEqual(late.body, { error: "failed-precondition", field: "gone" });
  assert.deepEqual((await get(code)).body.expenses.map(function(e){ return [e.id, e.amountPaise]; }), [["phone-a", 40000]]);
  // An edit of a deleted expense, or of one that never was, is refused the same way.
  assert.equal((await api(t.base, "DELETE", "/api/expenses/phone-a", { code: code })).status, 200);
  assert.deepEqual((await edit(code, "phone-a", expense({ id: "phone-c" }))).body, { error: "failed-precondition", field: "gone" });
  assert.deepEqual((await edit(code, "never", expense({ id: "phone-d" }))).body, { error: "failed-precondition", field: "gone" });
  const group = (await get(code)).body;
  assert.deepEqual(group.expenses, []);
  assert.equal(group.version, 6);
  // An edit for a group that doesn't exist doesn't create anything.
  assert.equal((await edit("no-such-group", "e1", expense({ id: "x" }))).status, 404);
  assert.equal((await get("no-such-group")).status, 404);
});

test("SF-022: denied: an edit that isn't ledger-shaped, keeps the old ID, or names someone not in the group", async function(){
  const code = await freshGroup();
  const bad = [
    [{ id: "e1" }, "id"], [{ id: "v2", amountPaise: 0 }, "amountPaise"], [{ id: "v2", desc: "" }, "desc"],
    [{ id: "v2", split: [] }, "split"], [{ id: "v2", split: ["asha", "zed"] }, "split"],
    [{ id: "v2", paidBy: "zed" }, "paidBy"], [{ id: "v2", note: "x" }, "fields"], [{ id: "v2", amountPaise: undefined }, "fields"],
    [{ id: "a b" }, "id"], [{ id: "v2", kind: "gift" }, "kind"]
  ];
  for(const [changes, field] of bad){
    const res = await edit(code, "e1", expense(changes));
    assert.equal(res.status, 400, JSON.stringify(changes));
    assert.deepEqual(res.body, { error: "invalid-argument", field: field }, JSON.stringify(changes));
  }
  assert.deepEqual((await api(t.base, "PUT", "/api/expenses/a%20b", { code: code, body: expense({ id: "v2" }) })).body, { error: "invalid-argument", field: "id" });
  const group = (await get(code)).body;
  assert.deepEqual(group.expenses, [expense()]);
  assert.equal(group.version, 4);
});

test("SF-022: each edit counts as one more expense and its split entries towards the group's limits", async function(){
  const g = await startTestServer({ maxExpenses: 3 });
  try{
    const code = "edit-trip";
    const put = function(path, body){ return api(g.base, "PUT", path, { code: code, body: body }); };
    await put("/api/group", { currency: "₹" });
    for(const id of ["asha", "ben"]) await api(g.base, "POST", "/api/people", { code: code, body: { id: id, name: id } });
    assert.equal((await api(g.base, "POST", "/api/expenses", { code: code, body: expense() })).status, 201); // 1 expense
    assert.equal((await put("/api/expenses/e1", expense({ id: "v2" }))).status, 200); // 2
    assert.equal((await put("/api/expenses/v2", expense({ id: "v3" }))).status, 200); // 3
    const full = await put("/api/expenses/v3", expense({ id: "v4" }));
    assert.equal(full.status, 409);
    assert.deepEqual(full.body, { error: "failed-precondition", field: "group-full" });
    // A replay of an edit already made still succeeds.
    assert.equal((await put("/api/expenses/v2", expense({ id: "v3" }))).status, 200);
  }finally{
    await g.close();
  }
  const h = await startTestServer({ maxSplitEntries: 3 });
  try{
    const code = "entries-edit";
    await api(h.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } });
    for(const id of ["asha", "ben"]) await api(h.base, "POST", "/api/people", { code: code, body: { id: id, name: id } });
    assert.equal((await api(h.base, "POST", "/api/expenses", { code: code, body: expense() })).status, 201); // 2 entries
    const full = await api(h.base, "PUT", "/api/expenses/e1", { code: code, body: expense({ id: "v2" }) }); // 4 > 3
    assert.deepEqual(full.body, { error: "failed-precondition", field: "group-full" });
    assert.equal((await api(h.base, "PUT", "/api/expenses/e1", { code: code, body: expense({ id: "v2", split: ["ben"] }) })).status, 200); // 3
  }finally{
    await h.close();
  }
});

// ---------- SF-023: recording a settle-up ----------

const settle = function(code, id, from, to, paise){
  return addExpense(code, { id: id, date: "2026-09-30T06:00:00.000Z", desc: "Payment", amountPaise: paise, paidBy: from, split: [to], kind: "settlement" });
};
const debts = async function(code){ return simplifyDebts(new Map(Object.entries(await balancesOf(code)))); };

test("SF-023: Ben owes Asha ₹100; recording 'Ben paid Asha ₹100' brings both to 0", async function(){
  // By hand: ₹200.00 paid by Asha, split Asha and Ben: Asha +10000, Ben −10000, so Ben owes Asha
  // ₹100.00. The settle-up is paid by Ben, split to Asha alone: Ben +10000, Asha −10000.
  const code = await emptyGroup();
  for(const id of ["asha", "ben"]) await addPerson(code, { id: id, name: id });
  await addExpense(code, expense({ amountPaise: 20000 }));
  assert.deepEqual(await debts(code), [{ from: "ben", to: "asha", amount: 10000 }]);
  const res = await settle(code, "pay1", "ben", "asha", 10000);
  assert.equal(res.status, 201);
  assert.deepEqual(await balancesOf(code), { asha: 0, ben: 0 });
  assert.deepEqual(await debts(code), []);
  // It reads back marked as a settle-up; the ordinary expense has no kind.
  const [e1, pay1] = (await get(code)).body.expenses;
  assert.equal("kind" in e1, false);
  assert.equal(pay1.kind, "settlement");
  assert.deepEqual(pay1.split, ["asha"]);
});

test("SF-023: a part payment of ₹40 leaves Ben owing Asha ₹60; it can be edited and deleted like an expense", async function(){
  const code = await emptyGroup();
  for(const id of ["asha", "ben"]) await addPerson(code, { id: id, name: id });
  await addExpense(code, expense({ amountPaise: 20000 }));
  assert.equal((await settle(code, "pay1", "ben", "asha", 4000)).status, 201);
  // Ben −10000 + 4000 = −6000; Asha +10000 − 4000 = +6000.
  assert.deepEqual(await debts(code), [{ from: "ben", to: "asha", amount: 6000 }]);
  // Edited to ₹100 (the edit keeps it a settle-up), it settles the rest.
  const body = { id: "pay1-v2", date: "2026-09-30T06:00:00.000Z", desc: "Payment", amountPaise: 10000, paidBy: "ben", split: ["asha"], kind: "settlement" };
  assert.equal((await edit(code, "pay1", body)).status, 200);
  assert.deepEqual(await balancesOf(code), { asha: 0, ben: 0 });
  assert.equal((await get(code)).body.expenses[1].kind, "settlement");
  assert.equal((await api(t.base, "DELETE", "/api/expenses/pay1-v2", { code: code })).status, 200);
  assert.deepEqual(await balancesOf(code), { asha: 10000, ben: -10000 });
});

test("SF-023: denied: a settle-up to more than one person, to the payer, or of another kind", async function(){
  const code = await freshGroup();
  const pay = function(changes){ return Object.assign({ id: "pay", date: "2026-09-30T06:00:00.000Z", desc: "Payment", amountPaise: 100, paidBy: "ben", split: ["asha"], kind: "settlement" }, changes); };
  for(const [changes, field] of [[{ split: ["asha", "ben"] }, "split"], [{ split: ["ben"] }, "split"], [{ kind: "refund" }, "kind"], [{ kind: null }, "kind"], [{ split: ["zed"] }, "split"]]){
    const res = await addExpense(code, pay(changes));
    assert.equal(res.status, 400, JSON.stringify(changes));
    assert.deepEqual(res.body, { error: "invalid-argument", field: field }, JSON.stringify(changes));
  }
  assert.equal((await get(code)).body.expenses.length, 1);
});

test("denied: every other path", async function(){
  for(const path of ["/api/settlements", "/api/other/x", "/api/group/x", "/api/people/asha/notes", "/api/expenses/"]){
    assert.equal((await api(t.base, "GET", path, { code: GROUP })).status, path === "/api/expenses/" ? 405 : 404, path);
  }
});

test("a person used in an expense (as payer or in the split) can't be deleted: 409 failed-precondition", async function(){
  const code = await freshGroup();
  await addPerson(code, { id: "chitra", name: "Chitra" });
  await addExpense(code, expense({ id: "e2", paidBy: "chitra", split: ["asha"] }));
  for(const id of ["asha", "ben", "chitra"]){
    const res = await api(t.base, "DELETE", "/api/people/" + id, { code: code });
    assert.equal(res.status, 409, id);
    assert.deepEqual(res.body, { error: "failed-precondition", field: "in-use" }, id);
  }
  // Once their expenses are gone, they can go.
  await api(t.base, "DELETE", "/api/expenses/e1", { code: code });
  assert.equal((await api(t.base, "DELETE", "/api/people/ben", { code: code })).status, 200);
  assert.equal((await api(t.base, "DELETE", "/api/people/asha", { code: code })).status, 409);
  // And an expense can't name someone who has gone.
  assert.deepEqual((await addExpense(code, expense({ id: "e3", split: ["ben"] }))).body, { error: "invalid-argument", field: "split" });
});

test("a duplicate POST leaves one row, and sending it again after a delete doesn't bring it back", async function(){
  const code = await freshGroup();
  const first = await addExpense(code, expense({ id: "twice" }));
  assert.equal(first.status, 201);
  const again = await addExpense(code, expense({ id: "twice" }));
  assert.equal(again.status, 200);
  assert.deepEqual(again.body, first.body);
  assert.equal((await get(code)).body.expenses.filter(function(e){ return e.id === "twice"; }).length, 1);
  await api(t.base, "DELETE", "/api/expenses/twice", { code: code });
  assert.equal((await addExpense(code, expense({ id: "twice" }))).status, 200);
  assert.equal((await get(code)).body.expenses.filter(function(e){ return e.id === "twice"; }).length, 0);
  // A replay whose payer has since gone still succeeds, as the first send did.
  await addPerson(code, { id: "chitra", name: "Chitra" });
  await addExpense(code, expense({ id: "by-chitra", paidBy: "chitra", split: ["chitra"] }));
  await api(t.base, "DELETE", "/api/expenses/by-chitra", { code: code });
  await api(t.base, "DELETE", "/api/people/chitra", { code: code });
  assert.equal((await addExpense(code, expense({ id: "by-chitra", paidBy: "chitra", split: ["chitra"] }))).status, 200);
});

test("the version goes up by one with each change, and not for a change that changes nothing", async function(){
  const code = await freshGroup();
  const versions = [];
  versions.push((await addPerson(code, { id: "c", name: "C" })).body.version);
  versions.push((await addPerson(code, { id: "c", name: "C" })).body.version);
  versions.push((await api(t.base, "PUT", "/api/group", { code: code, body: { currency: "$" } })).body.version);
  versions.push((await api(t.base, "DELETE", "/api/people/c", { code: code })).body.version);
  versions.push((await api(t.base, "DELETE", "/api/people/c", { code: code })).body.version);
  assert.deepEqual(versions, [5, 5, 6, 7, 7]);
  assert.equal((await get(code)).body.version, 7);
});

test("bodies over 16 KB, bodies that aren't JSON and requests that don't say JSON are refused", async function(){
  const code = await freshGroup();
  assert.equal(MAX_BODY_BYTES, 16 * 1024);
  const big = JSON.stringify({ id: "big", name: "x".repeat(MAX_BODY_BYTES) });
  const tooBig = await api(t.base, "POST", "/api/people", { code: code, body: big });
  assert.equal(tooBig.status, 413);
  assert.deepEqual(tooBig.body, { error: "invalid-argument", field: "size" });
  // Exactly the limit is read (and then refused for its long name, not its size).
  const exact = JSON.stringify({ id: "big", name: "" }).length;
  const edge = await api(t.base, "POST", "/api/people", { code: code, body: JSON.stringify({ id: "big", name: "x".repeat(MAX_BODY_BYTES - exact) }) });
  assert.equal(edge.status, 400);
  assert.equal(edge.body.field, "name");
  // Sent in chunks with no Content-Length, it is still counted.
  const chunked = await raw(t.base, "/api/people", {
    method: "POST", body: big,
    headers: { "X-Group-Code": code, "Content-Type": "application/json", "Transfer-Encoding": "chunked" }
  });
  assert.equal(chunked.status, 413);
  const notJson = await api(t.base, "POST", "/api/people", { code: code, body: "{ id: asha }" });
  assert.deepEqual([notJson.status, notJson.body], [400, { error: "invalid-argument", field: "json" }]);
  for(const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]){
    const res = await api(t.base, "POST", "/api/people", { code: code, body: JSON.stringify({ id: "c", name: "C" }), headers: { "Content-Type": type } });
    assert.equal(res.status, 415, type);
  }
  assert.equal((await api(t.base, "POST", "/api/people", { code: code, body: JSON.stringify({ id: "c", name: "C" }), headers: { "Content-Type": "application/json; charset=utf-8" } })).status, 201);
  assert.equal((await get(code)).body.people.length, 3);
});

test("no CORS: another website's page can't call the API from a visitor's browser", async function(){
  const res = await api(t.base, "OPTIONS", "/api/group", { code: GROUP, headers: { "Origin": "https://evil.example", "Access-Control-Request-Method": "PUT" } });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  const got = await api(t.base, "GET", "/api/group", { code: GROUP, headers: { "Origin": "https://evil.example" } });
  assert.equal(got.headers.get("access-control-allow-origin"), null);
});

test("no log line holds a group code, a name or a description", async function(){
  const typed = ["Asha", "Ben", "Hotel", "Chitra", "Chai", "Zed", "evil.example"];
  const codes = ["goa-trip-2026", "goa-trip-7k2m9xqpwd", "trip-1", "no-such-group"].concat(BAD_CODES);
  assert.ok(t.logs.length > 20, "the tests above log their refusals");
  t.logs.forEach(function(line){
    assert.match(line, /^SplitFamilia api: (GET|PUT|POST|DELETE|PATCH|OPTIONS) \d{3} [a-z-]+$/, line);
    typed.concat(codes).forEach(function(s){ assert.ok(!line.includes(s), line + " holds " + s); });
  });
});

// ---------- guessing (a fresh server, so the other tests' 404s don't count) ----------

test("the 31st unknown code from one address in 10 minutes gives 429, for every code, until the window passes", async function(){
  let clock = Date.parse("2026-09-30T06:00:00Z");
  const g = await startTestServer({ now: function(){ return clock; } });
  try{
    await api(g.base, "PUT", "/api/group", { code: "family", body: { currency: "₹" } }); // a new group counts: 1
    for(let i = 2; i <= 29; i++){
      const res = await api(g.base, "GET", "/api/group", { code: "guess-" + i });
      assert.equal(res.status, 404, "guess " + i);
    }
    // Below the limit the family's own group opens as usual.
    assert.equal((await api(g.base, "GET", "/api/group", { code: "family" })).status, 200);
    assert.equal((await api(g.base, "GET", "/api/group", { code: "guess-30" })).status, 404);
    const res = await api(g.base, "GET", "/api/group", { code: "guess-31" });
    assert.equal(res.status, 429);
    assert.deepEqual(res.body, { error: "resource-exhausted" });
    assert.equal(res.headers.get("retry-after"), "600");
    // Now every request from that address waits, known codes too (else 429 would say "unknown").
    assert.equal((await api(g.base, "GET", "/api/group", { code: "family" })).status, 429);
    assert.equal((await api(g.base, "GET", "/api/group/events", { code: "family" })).status, 429);
    assert.equal((await api(g.base, "PUT", "/api/group", { code: "another", body: { currency: "₹" } })).status, 429);
    assert.equal((await api(g.base, "GET", "/api/group", { code: "another" })).status, 429);
    // The page itself is still served.
    assert.equal((await raw(g.base, "/")).status, 200);
    // One line says the limit was reached; no line per refusal.
    assert.equal(g.logs.filter(function(l){ return /limit of unknown group codes/.test(l); }).length, 1);
    assert.equal(g.logs.filter(function(l){ return / 429 /.test(l); }).length, 0);
    // After 10 minutes the first ones drop out of the window.
    clock += 10 * 60 * 1000 + 1;
    assert.equal((await api(g.base, "GET", "/api/group", { code: "family" })).status, 200);
    assert.equal((await api(g.base, "GET", "/api/group", { code: "another" })).status, 404);
  }finally{
    await g.close();
  }
});

test("the address comes from X-Real-IP only behind Railway's proxy", async function(){
  const direct = await startTestServer({ guessLimit: 2 });
  const proxied = await startTestServer({ guessLimit: 2, trustProxy: true });
  try{
    // Direct: a made-up X-Real-IP doesn't give a guesser a fresh address.
    for(const [code, ip] of [["guess-a", "1.1.1.1"], ["guess-b", "2.2.2.2"]]){
      assert.equal((await api(direct.base, "GET", "/api/group", { code: code, headers: { "X-Real-IP": ip } })).status, 404);
    }
    assert.equal((await api(direct.base, "GET", "/api/group", { code: "guess-c", headers: { "X-Real-IP": "3.3.3.3" } })).status, 429);
    // Behind the proxy (which sets it), each client has its own count.
    for(const ip of ["1.1.1.1", "1.1.1.1"]) await api(proxied.base, "GET", "/api/group", { code: "guess-x", headers: { "X-Real-IP": ip } });
    assert.equal((await api(proxied.base, "GET", "/api/group", { code: "guess-y", headers: { "X-Real-IP": "1.1.1.1" } })).status, 429);
    assert.equal((await api(proxied.base, "GET", "/api/group", { code: "guess-y", headers: { "X-Real-IP": "2.2.2.2" } })).status, 404);
  }finally{
    await direct.close();
    await proxied.close();
  }
});

// Requests on their own connections, all heads first and every body only after `holdMs`, as a
// guesser can send them: while a body is on its way, the request has passed the first check.
// requests: [{ method, path, headers, body }] → the status of each, in order.
function heldRequests(base, requests, holdMs){
  const port = Number(new URL(base).port);
  let release;
  const go = new Promise(function(r){ release = r; });
  const answers = requests.map(function(r){
    return new Promise(function(resolve, reject){
      const sock = connect(port, "127.0.0.1");
      let text = "";
      sock.setEncoding("utf8");
      sock.on("data", function(d){ text += d; });
      sock.on("error", function(){});
      sock.on("close", function(){
        const m = /^HTTP\/1\.1 (\d{3})/.exec(text);
        m ? resolve(Number(m[1])) : reject(new Error("no answer"));
      });
      const body = JSON.stringify(r.body);
      const head = [r.method + " " + r.path + " HTTP/1.1", "Host: x", "Connection: close", "Content-Type: application/json",
        "Content-Length: " + Buffer.byteLength(body)]
        .concat(Object.entries(r.headers).map(function([k, v]){ return k + ": " + v; }));
      sock.write(head.join("\r\n") + "\r\n\r\n");
      go.then(function(){ sock.write(body); });
    });
  });
  setTimeout(release, holdMs);
  return Promise.all(answers);
}
const tally = function(statuses){
  return statuses.reduce(function(t, s){ t[s] = (t[s] || 0) + 1; return t; }, {});
};

test("F-8: requests whose bodies arrive after their heads are limited too: of 60 unknown codes, 30 get 404", async function(){
  const g = await startTestServer();
  try{
    const posts = Array.from({ length: 60 }, function(_, i){
      return { method: "POST", path: "/api/people", headers: { "X-Group-Code": "held-guess-" + i }, body: { id: "p1", name: "P" } };
    });
    assert.deepEqual(tally(await heldRequests(g.base, posts, 300)), { 404: 30, 429: 30 });
    // Creating a group counts as an unknown code, so 60 held PUTs make 30 groups, not 60.
    const h = await startTestServer();
    try{
      const puts = Array.from({ length: 60 }, function(_, i){
        return { method: "PUT", path: "/api/group", headers: { "X-Group-Code": "held-new-" + i }, body: { currency: "₹" } };
      });
      assert.deepEqual(tally(await heldRequests(h.base, puts, 300)), { 200: 30, 429: 30 });
      assert.equal(h.app.ledger.query("SELECT COUNT(*) AS n FROM groups")[0].n, 30);
    }finally{
      await h.close();
    }
  }finally{
    await g.close();
  }
});

test("an address sends at most 300 changes in 10 minutes; then its changes wait, and its reads don't", async function(){
  assert.equal(WRITE_LIMIT, 300); // the owner's number (D-17)
  assert.equal(WRITE_WINDOW_MS, 10 * 60 * 1000);
  let clock = Date.parse("2026-09-30T06:00:00Z");
  // A limit of 6 here, so the test is quick; behind the proxy, so two addresses can be told apart.
  const g = await startTestServer({ writeLimit: 6, trustProxy: true, now: function(){ return clock; } });
  const asha = { "X-Real-IP": "1.1.1.1" };
  try{
    const code = "writes-trip";
    assert.equal((await api(g.base, "PUT", "/api/group", { code: code, headers: asha, body: { currency: "₹" } })).status, 200); // 1
    assert.equal((await api(g.base, "POST", "/api/people", { code: code, headers: asha, body: { id: "asha", name: "Asha" } })).status, 201); // 2
    // 10 more at once, held like F-8's: exactly 4 get through.
    const adds = Array.from({ length: 10 }, function(_, i){
      return { method: "POST", path: "/api/expenses", headers: Object.assign({ "X-Group-Code": code }, asha),
        body: { id: "e" + i, date: "2026-09-30T06:00:00.000Z", desc: "Tea", amountPaise: 1000, paidBy: "asha", split: ["asha"] } };
    });
    assert.deepEqual(tally(await heldRequests(g.base, adds, 200)), { 201: 4, 429: 6 });
    const refused = await api(g.base, "DELETE", "/api/expenses/e0", { code: code, headers: asha });
    assert.equal(refused.status, 429);
    assert.deepEqual(refused.body, { error: "resource-exhausted" });
    assert.equal(refused.headers.get("retry-after"), "600");
    // Reading still works, and shows the 4 that got through.
    const read = await api(g.base, "GET", "/api/group", { code: code, headers: asha });
    assert.equal(read.status, 200);
    assert.equal(read.body.expenses.length, 4);
    // Another address isn't held up.
    assert.equal((await api(g.base, "POST", "/api/people", { code: code, headers: { "X-Real-IP": "2.2.2.2" }, body: { id: "ben", name: "Ben" } })).status, 201);
    // One line says the limit was reached; no line per refusal.
    assert.equal(g.logs.filter(function(l){ return /limit of changes/.test(l); }).length, 1);
    assert.equal(g.logs.filter(function(l){ return / 429 /.test(l); }).length, 0);
    // After 10 minutes the first ones drop out of the window.
    clock += 10 * 60 * 1000 + 1;
    assert.equal((await api(g.base, "DELETE", "/api/expenses/e0", { code: code, headers: asha })).status, 200);
  }finally{
    await g.close();
  }
});

// ---------- forgetting addresses (the privacy policy's 11 minutes; the T-06 review's F-16) ----------

test("F-16: a sweep forgets an address that never comes back once its last event leaves the window", function(){
  assert.equal(SWEEP_MS, 30 * 1000);
  for(const [name, make, windowMs] of [["guesses", createGuessLimiter, GUESS_WINDOW_MS], ["changes", createWriteLimiter, WRITE_WINDOW_MS]]){
    let clock = Date.parse("2026-10-02T00:00:00Z");
    const lim = make({ now: function(){ return clock; } });
    lim.hit("192.0.2.1");
    clock += 5 * 60 * 1000;
    lim.hit("192.0.2.1"); // its last event
    lim.hit("198.51.100.2");
    clock += windowMs - 1;
    lim.sweep();
    assert.equal(lim.size(), 2, name + ": both still have an event in the window");
    clock += 1;
    lim.sweep();
    assert.equal(lim.size(), 0, name + ": nothing left in the window, so nothing kept");
    // The sweep changes nothing else: an address that returns starts afresh.
    assert.equal(lim.blocked("192.0.2.1"), false, name);
    lim.hit("192.0.2.1");
    lim.sweep();
    assert.equal(lim.size(), 1, name + ": a fresh event stays");
  }
});

test("F-16: the server sweeps both limiters on a timer, without another request, and stops sweeping on close", async function(){
  let clock = Date.parse("2026-10-02T00:00:00Z");
  const g = await startTestServer({ sweepMs: 20, now: function(){ return clock; } });
  let closed = false;
  try{
    // Creating a group counts as an unknown code and as a change.
    assert.equal((await api(g.base, "PUT", "/api/group", { code: "sweep-trip", body: { currency: "₹" } })).status, 200);
    assert.equal((await api(g.base, "GET", "/api/group", { code: "sweep-guess" })).status, 404);
    await new Promise(function(r){ setTimeout(r, 100); });
    assert.deepEqual([g.app.limiter.size(), g.app.writes.size()], [1, 1], "still inside the window");
    clock += 10 * 60 * 1000;
    await new Promise(function(r){ setTimeout(r, 100); });
    assert.deepEqual([g.app.limiter.size(), g.app.writes.size()], [0, 0], "forgotten with no request since");
    // After close() the timer is gone: nothing calls the sweep any more.
    await g.close();
    closed = true;
    let calls = 0;
    g.app.limiter.sweep = function(){ calls++; };
    g.app.writes.sweep = function(){ calls++; };
    await new Promise(function(r){ setTimeout(r, 100); });
    assert.equal(calls, 0);
  }finally{
    if(!closed) await g.close();
  }
});

test("F-16: the sweep timer doesn't keep the process running", function(){
  const dir = mkdtempSync(join(tmpdir(), "splitfamilia-sweep-"));
  try{
    // An app made and never closed or started: the process must still end by itself.
    const code = "import { createApp } from " + JSON.stringify(pathToFileURL(join(REPO_ROOT, "server", "server.js")).href) + ";\n" +
      "createApp({ root: " + JSON.stringify(REPO_ROOT) + ", dbFile: " + JSON.stringify(join(dir, "s.db")) + ", log: function(){} });\n";
    const run = spawnSync(process.execPath, ["--input-type=module", "--no-warnings", "-e", code], { encoding: "utf8", timeout: 15000 });
    assert.equal(run.error, undefined, "the process was still running after 15 seconds");
    assert.equal(run.status, 0, run.stderr);
  }finally{
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("a group holds at most 5,000 expenses, deleted ones included: then 409 group-full; a replay still succeeds", async function(){
  // A cap of 3 here, so the test is quick; ledger-rules.test.js checks MAX_EXPENSES is 5,000.
  const g = await startTestServer({ maxExpenses: 3 });
  try{
    const code = "full-trip";
    await api(g.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } });
    await api(g.base, "POST", "/api/people", { code: code, body: { id: "asha", name: "Asha" } });
    const add = function(id){
      return api(g.base, "POST", "/api/expenses", { code: code,
        body: { id: id, date: "2026-09-30T06:00:00.000Z", desc: "Tea", amountPaise: 1000, paidBy: "asha", split: ["asha"] } });
    };
    for(const id of ["e1", "e2", "e3"]) assert.equal((await add(id)).status, 201, id);
    assert.equal((await api(g.base, "DELETE", "/api/expenses/e3", { code: code })).status, 200);
    const full = await add("e4");
    assert.equal(full.status, 409);
    assert.deepEqual(full.body, { error: "failed-precondition", field: "group-full" });
    // Sending one that's already there still succeeds, deleted or not, and changes nothing.
    assert.equal((await add("e1")).status, 200);
    assert.equal((await add("e3")).status, 200);
    const read = await api(g.base, "GET", "/api/group", { code: code });
    assert.deepEqual(read.body.expenses.map(function(e){ return e.id; }), ["e1", "e2"]);
  }finally{
    await g.close();
  }
});

// ---------- reading a large group stays cheap (D-18, the second T-08 review's F-10) ----------

test("a group holds at most 20,000 split entries, deleted expenses included: then 409 group-full; a replay still succeeds", async function(){
  // A cap of 5 here, so the test is quick; ledger-rules.test.js checks MAX_SPLIT_ENTRIES is 20,000.
  assert.equal(MAX_SPLIT_ENTRIES, 20000);
  const g = await startTestServer({ maxSplitEntries: 5 });
  try{
    const code = "entries-trip";
    await api(g.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } });
    for(const id of ["a", "b", "c"]) await api(g.base, "POST", "/api/people", { code: code, body: { id: id, name: id.toUpperCase() } });
    const add = function(id, split){
      return api(g.base, "POST", "/api/expenses", { code: code,
        body: { id: id, date: "2026-09-30T06:00:00.000Z", desc: "Tea", amountPaise: 900, paidBy: "a", split: split } });
    };
    assert.equal((await add("e1", ["a", "b", "c"])).status, 201); // 3 entries
    assert.equal((await api(g.base, "DELETE", "/api/expenses/e1", { code: code })).status, 200); // still 3
    const full = await add("e2", ["a", "b", "c"]); // 6 > 5
    assert.equal(full.status, 409);
    assert.deepEqual(full.body, { error: "failed-precondition", field: "group-full" });
    assert.equal((await add("e3", ["a", "b"])).status, 201); // exactly 5
    assert.equal((await add("e1", ["a", "b", "c"])).status, 200); // a replay: already there
    assert.equal((await add("e4", ["a"])).status, 409);
  }finally{
    await g.close();
  }
});

test("a group's answer is gzipped when the browser accepts it, and the same data either way", async function(){
  const code = await freshGroup();
  for(let i = 0; i < 20; i++) await addExpense(code, expense({ id: "g" + i, desc: "Dinner at the beach shack " + i }));
  const plain = await raw(t.base, "/api/group", { headers: { "X-Group-Code": code } });
  const zipped = await raw(t.base, "/api/group", { headers: { "X-Group-Code": code, "Accept-Encoding": "gzip, deflate, br" } });
  const refused = await raw(t.base, "/api/group", { headers: { "X-Group-Code": code, "Accept-Encoding": "gzip;q=0" } });
  assert.equal(plain.headers["content-encoding"], undefined);
  assert.equal(refused.headers["content-encoding"], undefined);
  assert.equal(zipped.headers["content-encoding"], "gzip");
  for(const r of [plain, zipped, refused]){
    assert.equal(r.status, 200);
    assert.equal(r.headers["vary"], "Accept-Encoding");
    assert.equal(r.headers["cache-control"], "no-store");
    assert.equal(r.headers["x-content-type-options"], "nosniff");
    assert.equal(Number(r.headers["content-length"]), r.body.length);
  }
  assert.ok(zipped.body.length < plain.body.length / 3, zipped.body.length + " vs " + plain.body.length);
  assert.deepEqual(gunzipSync(zipped.body), plain.body);
  assert.equal(JSON.parse(plain.body.toString("utf8")).expenses.length, 21);
});

test("a group's answer is built once per version and shared by every reader; the oldest goes past the byte budget", async function(){
  const g = await startTestServer({ maxAnswerBytes: 2000 });
  try{
    let builds = 0;
    const read = g.app.ledger.readGroup;
    g.app.ledger.readGroup = function(code){ builds++; return read(code); };
    const get = function(code){ return api(g.base, "GET", "/api/group", { code: code }); };
    await api(g.base, "PUT", "/api/group", { code: "one-trip", body: { currency: "₹" } });
    await api(g.base, "PUT", "/api/group", { code: "two-trip", body: { currency: "₹" } });
    for(let i = 0; i < 3; i++) assert.equal((await get("one-trip")).status, 200);
    assert.equal(builds, 1);
    await api(g.base, "POST", "/api/people", { code: "one-trip", body: { id: "asha", name: "Asha" } });
    assert.deepEqual((await get("one-trip")).body.people, [{ id: "asha", name: "Asha" }]);
    assert.equal(builds, 2);
    await get("two-trip");
    assert.equal(builds, 3);
    // A group of over 2 KB pushes the others out of a 2,000-byte budget.
    await api(g.base, "PUT", "/api/group", { code: "big-trip", body: { currency: "₹" } });
    for(let i = 0; i < 40; i++) await api(g.base, "POST", "/api/people", { code: "big-trip", body: { id: "p" + i, name: "Person number " + i + " with a longer name" } });
    await get("big-trip");
    assert.equal(builds, 4);
    await get("one-trip");
    assert.equal(builds, 5, "one-trip was dropped and built again");
    await get("one-trip");
    assert.equal(builds, 5);
  }finally{
    await g.close();
  }
});
