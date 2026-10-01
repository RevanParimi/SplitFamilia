// SF-032: the ledger's SQLite database. Each test uses a new file in a temporary folder.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openLedger, dataDir, SCHEMA_VERSION, DB_FILE_NAME } from "../server/db.js";
import { startTestServer, api, raw, REPO_ROOT } from "./helpers/test-server.js";

let dir, file, ledger;
beforeEach(function(){
  dir = mkdtempSync(join(tmpdir(), "splitfamilia-db-"));
  file = join(dir, "nested", DB_FILE_NAME);
  ledger = null;
});
afterEach(function(){
  if(ledger) ledger.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const expense = function(changes){
  return Object.assign({ id: "e1", date: "2026-09-29T06:30:00.000Z", desc: "Hotel", amountPaise: 30000, paidBy: "asha", split: ["asha", "ben"] }, changes || {});
};
const tables = function(l){
  return l.query("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name");
};

test("the file is created in its folder, with WAL and foreign keys on", function(){
  ledger = openLedger(file);
  assert.ok(existsSync(file));
  assert.equal(ledger.query("PRAGMA journal_mode")[0].journal_mode, "wal");
  assert.equal(ledger.query("PRAGMA foreign_keys")[0].foreign_keys, 1);
  assert.deepEqual(tables(ledger).map(function(t){ return t.name; }),
    ["expense_split", "expenses", "groups", "people", "schema_version"]);
});

test("migrations run once: a second start changes nothing and keeps the data", function(){
  ledger = openLedger(file);
  ledger.setCurrency("goa-trip-2026", "₹");
  ledger.addPerson("goa-trip-2026", { id: "asha", name: "Asha" });
  const before = tables(ledger);
  ledger.close();
  ledger = openLedger(file);
  const versions = ledger.query("SELECT version FROM schema_version");
  assert.equal(versions.length, 1);
  assert.equal(versions[0].version, SCHEMA_VERSION);
  assert.deepEqual(tables(ledger), before);
  assert.deepEqual(ledger.readGroup("goa-trip-2026").people, [{ id: "asha", name: "Asha" }]);
  assert.equal(SCHEMA_VERSION, 2);
});

test("migration 2 (SF-023) adds settle-ups to a version-1 database and keeps every expense as it was", function(){
  // A database as T-08 and T-09 made it: migration 1 only, with an expense in it.
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
  ledger = openLedger(file);
  ledger.setCurrency("g", "₹");
  ledger.addPerson("g", { id: "asha", name: "Asha" });
  ledger.addPerson("g", { id: "ben", name: "Ben" });
  ledger.addExpense("g", expense());
  ledger.close();
  ledger = null;
  const raw = new DatabaseSync(file);
  raw.exec("ALTER TABLE expenses DROP COLUMN kind; UPDATE schema_version SET version = 1;");
  assert.deepEqual(raw.prepare("SELECT name FROM pragma_table_info('expenses') WHERE name = 'kind'").all(), []);
  raw.close();
  ledger = openLedger(file);
  assert.equal(ledger.query("SELECT version FROM schema_version")[0].version, 2);
  // The old expense reads back exactly as before: no kind.
  assert.deepEqual(ledger.readGroup("g").expenses, [expense()]);
  assert.equal(ledger.groupVersion("g"), 4);
  // A server from before migration 2 adds expenses without the column: they are ordinary ones.
  ledger.query("INSERT INTO expenses (group_code, id, date, description, amount_paise, paid_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
    ["g", "old-code", "2026-09-30T06:00:00.000Z", "Tea", 1000, "ben", "2026-10-01T00:00:00.000Z"]);
  assert.equal(ledger.readGroup("g").expenses[1].kind, undefined);
  // Only 'settlement' fits the column.
  assert.throws(function(){
    ledger.query("UPDATE expenses SET kind = 'gift' WHERE id = ? RETURNING id", ["e1"]);
  }, /CHECK constraint failed/);
});

test("a settle-up keeps its kind, and an ordinary expense has none", function(){
  ledger = openLedger(file);
  ledger.setCurrency("g", "₹");
  ledger.addPerson("g", { id: "asha", name: "Asha" });
  ledger.addPerson("g", { id: "ben", name: "Ben" });
  ledger.addExpense("g", expense());
  assert.deepEqual(ledger.addExpense("g", expense({ id: "pay1", desc: "Payment", amountPaise: 10000, paidBy: "ben", split: ["asha"], kind: "settlement" })), { added: true, version: 5 });
  const [e1, pay1] = ledger.readGroup("g").expenses;
  assert.equal("kind" in e1, false);
  assert.deepEqual(pay1, { id: "pay1", date: "2026-09-29T06:30:00.000Z", desc: "Payment", amountPaise: 10000, paidBy: "ben", split: ["asha"], kind: "settlement" });
  assert.deepEqual(ledger.query("SELECT id, kind FROM expenses ORDER BY rowid").map(function(r){ return [r.id, r.kind]; }), [["e1", null], ["pay1", "settlement"]]);
});

test("an edit (SF-022) marks the old expense deleted and adds the new one, in one version step", function(){
  ledger = openLedger(file);
  ledger.setCurrency("g", "₹");
  ledger.addPerson("g", { id: "asha", name: "Asha" });
  ledger.addPerson("g", { id: "ben", name: "Ben" });
  ledger.addExpense("g", expense());
  assert.equal(ledger.groupVersion("g"), 4);
  const edited = expense({ id: "e1-v2", amountPaise: 32550, split: ["asha", "ben"] });
  assert.equal(ledger.expenseLive("g", "e1"), true);
  assert.deepEqual(ledger.replaceExpense("g", "e1", edited), { replaced: true, version: 5 });
  assert.deepEqual(ledger.readGroup("g").expenses, [edited]);
  assert.equal(ledger.expenseLive("g", "e1"), false);
  assert.equal(ledger.expenseExists("g", "e1"), true);
  // The same edit again, or another edit of the old one, changes nothing.
  assert.deepEqual(ledger.replaceExpense("g", "e1", edited), { replaced: false, version: 5 });
  assert.deepEqual(ledger.replaceExpense("g", "e1", expense({ id: "e1-v3", amountPaise: 1 })), { replaced: false, version: 5 });
  assert.equal(ledger.expenseExists("g", "e1-v3"), false);
  // Both rows count towards the limits: 2 expenses, 4 split entries.
  assert.equal(ledger.expenseCount("g"), 2);
  assert.equal(ledger.splitEntryCount("g"), 4);
  assert.deepEqual(ledger.readGroup("g").expenses.map(function(e){ return e.amountPaise; }), [32550]);
});

test("a round trip keeps whole paise exactly, stored as integers", function(){
  ledger = openLedger(file);
  ledger.setCurrency("g", "₹");
  ledger.addPerson("g", { id: "asha", name: "Asha" });
  ledger.addPerson("g", { id: "ben", name: "Ben" });
  ledger.addExpense("g", expense({ id: "e1", amountPaise: 3334 }));
  ledger.addExpense("g", expense({ id: "e2", amountPaise: 1000000000, split: ["ben"] }));
  ledger.addExpense("g", expense({ id: "e3", amountPaise: 1 }));
  const group = ledger.readGroup("g");
  assert.deepEqual(group.expenses.map(function(e){ return e.amountPaise; }), [3334, 1000000000, 1]);
  assert.deepEqual(group.expenses[0], { id: "e1", date: "2026-09-29T06:30:00.000Z", desc: "Hotel", amountPaise: 3334, paidBy: "asha", split: ["asha", "ben"] });
  assert.deepEqual(group.expenses[1].split, ["ben"]);
  const stored = ledger.query("SELECT amount_paise, typeof(amount_paise) AS type FROM expenses ORDER BY rowid");
  assert.deepEqual(stored.map(function(r){ return [r.amount_paise, r.type]; }), [[3334, "integer"], [1000000000, "integer"], [1, "integer"]]);
  // The table itself refuses a fraction of a paisa, zero and text that isn't a whole number.
  // (SQLite's STRICT tables take "3334" as the integer 3334; the API refuses any string first.)
  assert.throws(function(){ ledger.addExpense("g", expense({ id: "e4", amountPaise: 3334.5 })); });
  assert.throws(function(){ ledger.addExpense("g", expense({ id: "e5", amountPaise: 0 })); });
  assert.throws(function(){ ledger.addExpense("g", expense({ id: "e6", amountPaise: "lots" })); });
  assert.equal(ledger.readGroup("g").expenses.length, 3);
});

test("the split keeps its order, and each expense its own", function(){
  ledger = openLedger(file);
  ledger.setCurrency("g", "₹");
  ["c", "a", "b"].forEach(function(id){ ledger.addPerson("g", { id: id, name: id.toUpperCase() }); });
  ledger.addExpense("g", expense({ id: "x", paidBy: "c", split: ["c", "a", "b"] }));
  ledger.addExpense("g", expense({ id: "y", paidBy: "a", split: ["b", "a"] }));
  const group = ledger.readGroup("g");
  assert.deepEqual(group.people.map(function(p){ return p.id; }), ["c", "a", "b"]);
  assert.deepEqual(group.expenses.map(function(e){ return [e.id, e.split]; }), [["x", ["c", "a", "b"]], ["y", ["b", "a"]]]);
});

test("a duplicate ID is ignored: the first write stays, and the version moves once", function(){
  ledger = openLedger(file);
  assert.deepEqual(ledger.setCurrency("g", "₹"), { created: true, version: 1 });
  assert.deepEqual(ledger.addPerson("g", { id: "asha", name: "Asha" }), { added: true, version: 2 });
  assert.deepEqual(ledger.addPerson("g", { id: "asha", name: "Someone else" }), { added: false, version: 2 });
  ledger.addPerson("g", { id: "ben", name: "Ben" });
  assert.deepEqual(ledger.addExpense("g", expense()), { added: true, version: 4 });
  assert.deepEqual(ledger.addExpense("g", expense({ amountPaise: 99 })), { added: false, version: 4 });
  const group = ledger.readGroup("g");
  assert.deepEqual(group.people.map(function(p){ return p.name; }), ["Asha", "Ben"]);
  assert.deepEqual(group.expenses.map(function(e){ return e.amountPaise; }), [30000]);
  assert.equal(ledger.query("SELECT COUNT(*) AS n FROM expense_split")[0].n, 2);
});

test("a deleted row stays deleted: sending its add again doesn't bring it back", function(){
  ledger = openLedger(file);
  ledger.setCurrency("g", "₹");
  ledger.addPerson("g", { id: "asha", name: "Asha" });
  ledger.addPerson("g", { id: "ben", name: "Ben" });
  ledger.addExpense("g", expense());
  assert.equal(ledger.personInUse("g", "ben"), true);
  assert.deepEqual(ledger.deleteExpense("g", "e1"), { deleted: true, version: 5 });
  assert.deepEqual(ledger.deleteExpense("g", "e1"), { deleted: false, version: 5 });
  assert.equal(ledger.personInUse("g", "ben"), false);
  assert.deepEqual(ledger.addExpense("g", expense()), { added: false, version: 5 });
  assert.equal(ledger.expenseExists("g", "e1"), true);
  assert.deepEqual(ledger.deletePerson("g", "ben"), { deleted: true, version: 6 });
  assert.deepEqual(ledger.addPerson("g", { id: "ben", name: "Ben" }), { added: false, version: 6 });
  const group = ledger.readGroup("g");
  assert.deepEqual(group.people, [{ id: "asha", name: "Asha" }]);
  assert.deepEqual(group.expenses, []);
  assert.deepEqual(ledger.personIds("g"), new Set(["asha"]));
});

test("a code or a name holding ' or ; is stored as text, never run", function(){
  ledger = openLedger(file);
  const code = "x'; DROP TABLE groups; --";
  const name = "O'Brien; DROP TABLE people; --";
  const desc = "Chai at Raju's; 2 cups'); DELETE FROM expenses; --";
  ledger.setCurrency(code, "'");
  ledger.addPerson(code, { id: "p'1", name: name });
  ledger.addExpense(code, expense({ id: "e';1", desc: desc, paidBy: "p'1", split: ["p'1"] }));
  assert.equal(ledger.personInUse(code, "p'1"), true);
  const group = ledger.readGroup(code);
  assert.equal(group.currency, "'");
  assert.deepEqual(group.people, [{ id: "p'1", name: name }]);
  assert.equal(group.expenses[0].desc, desc);
  assert.equal(group.expenses[0].id, "e';1");
  assert.equal(ledger.groupVersion(code), 3);
  assert.equal(ledger.groupVersion("x"), null);
  assert.equal(tables(ledger).length, 5);
});

test("the data folder is Railway's volume when one is attached, otherwise data/ (git-ignored)", function(){
  assert.equal(dataDir({ RAILWAY_VOLUME_MOUNT_PATH: "/data" }), "/data");
  assert.equal(dataDir({}), fileURLToPath(new URL("../data/", import.meta.url)));
  assert.match(readFileSync(join(REPO_ROOT, ".gitignore"), "utf8"), /^\/data\/$/m);
});

test("if the database can't be opened, the page is still served, and /healthz and the API answer 503 (N-5)", async function(){
  // A folder where a file is expected, and a file that isn't a database.
  const blocker = join(dir, "blocker");
  writeFileSync(blocker, "not a folder");
  const junk = join(dir, "junk.db");
  writeFileSync(junk, "this is not a SQLite database, just text that is long enough ".repeat(40));
  for(const dbFile of [join(blocker, DB_FILE_NAME), junk]){
    const t = await startTestServer({ dbFile: dbFile });
    try{
      assert.equal((await raw(t.base, "/")).status, 200);
      // Railway's health check then fails, so it keeps the last good deploy (the T-08 review's N-5).
      const hz = await raw(t.base, "/healthz");
      assert.equal(hz.status, 503);
      assert.deepEqual(JSON.parse(hz.body.toString("utf8")), { status: "unavailable", database: "unavailable", storage: "local" });
      const res = await api(t.base, "GET", "/api/group", { code: "goa-trip-2026" });
      assert.equal(res.status, 503);
      assert.deepEqual(res.body, { error: "unavailable" });
      const put = await api(t.base, "PUT", "/api/group", { code: "goa-trip-2026", body: { currency: "₹" } });
      assert.equal(put.status, 503);
      // The log says why, without the group code.
      assert.ok(t.logs.some(function(l){ return /database is unavailable \((unable to open|file is not a database|EEXIST|ENOTDIR)/.test(l); }), t.logs.join("\n"));
      t.logs.forEach(function(l){ assert.doesNotMatch(l, /goa-trip-2026/); });
    }finally{
      await t.close();
    }
  }
});
