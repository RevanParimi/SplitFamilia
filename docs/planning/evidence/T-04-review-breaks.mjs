// T-04 review: the reviewer's own break checks (R1-R16), on top of the implementation's C1-C24.
// Each breaks the code in one small way, runs the tests that should notice, and restores every
// file byte for byte (checked by SHA-256). A break is "caught" when at least one test fails.
// Run from the repo root: `node docs/planning/evidence/T-04-review-breaks.mjs`. It edits files in
// place for a few seconds each; run it with no other session editing and no server serving them.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const API = ["tests/server-api.test.js"], DB = ["tests/server-db.test.js"], OUTBOX = ["tests/outbox.test.js"], PAGE = ["tests/page-client.test.js"];
const RULES = ["tests/ledger-rules.test.js"], RECENT = ["tests/recent-groups.test.js"], CODES = ["tests/group-code.test.js"];
const STATUS = ["tests/sync-status.test.js"];

const BREAKS = [
  // SF-022: editing an expense
  { id: "R1", story: "SF-022", what: "an edit doesn't move the group's version, so other phones never hear of it", tests: API.concat(DB, PAGE), edits: [
    { file: "server/db.js", from: "        insertExpense(code, expense);\n        return { replaced: true, version: q.bump.get(code).version };",
      to: "        insertExpense(code, expense);\n        return { replaced: true, version: groupVersion(code) };" }] },
  { id: "R2", story: "SF-022", what: "a resent edit is refused once its new expense was itself edited or deleted (resend checks 'live', not 'exists')", tests: API.concat(PAGE), edits: [
    { file: "server/api.js", from: "      if(ledger.expenseExists(code, body.id)) return sendJson(res, 200, { version: version });\n      // Another phone deleted",
      to: "      if(ledger.expenseLive(code, body.id)) return sendJson(res, 200, { version: version });\n      // Another phone deleted" }] },
  { id: "R3", story: "SF-022", what: "an edit skips the people check (a payer or split member not in the group is stored)", tests: API, edits: [
    { file: "server/api.js", from: "      const problem = checkExpense(body, ledger.personIds(code));\n      if(problem) return fail(req, res, 400, \"invalid-argument\", problem);\n      const edit",
      to: "      const problem = checkExpense(body);\n      if(problem) return fail(req, res, 400, \"invalid-argument\", problem);\n      const edit" }] },
  { id: "R4", story: "SF-022", what: "on the phone, an edit of an expense that's no longer there still shows (the server will refuse it)", tests: OUTBOX.concat(PAGE), edits: [
    { file: "outbox.js", from: "      if(!has(out.expenses, change.id) && has(out.expenses, change.replaces)){", to: "      if(!has(out.expenses, change.id)){" }] },
  { id: "R5", story: "SF-022", what: "an edit's split entries don't count towards the 20,000-entry limit", tests: API, edits: [
    { file: "server/api.js", from: "\"gone\");\n      if(ledger.expenseCount(code) >= maxExpenses) return fail(req, res, 409, \"failed-precondition\", \"group-full\");\n      if(ledger.splitEntryCount(code) + body.split.length > maxSplitEntries) return fail(req, res, 409, \"failed-precondition\", \"group-full\");\n",
      to: "\"gone\");\n      if(ledger.expenseCount(code) >= maxExpenses) return fail(req, res, 409, \"failed-precondition\", \"group-full\");\n" }] },
  { id: "R6", story: "SF-022", what: "a full group's refused edit has no words of its own", tests: STATUS, edits: [
    { file: "sync-status.js", from: "  \"group-full:expense-edit\": \"This group is full: it can't take more expenses.\",\n", to: "" }] },
  // SF-023: settle-ups
  { id: "R7", story: "SF-023", what: "the database column takes any kind (no CHECK; only the API guards it)", tests: DB.concat(API), edits: [
    { file: "server/db.js", from: "ADD COLUMN kind TEXT CHECK (kind IS NULL OR kind = 'settlement');", to: "ADD COLUMN kind TEXT;" }] },
  { id: "R8", story: "SF-023", what: "a settle-up may carry extra, unknown fields", tests: RULES.concat(API), edits: [
    { file: "ledger-rules.js", from: "  if(!hasExactly(body, withKind ? EXPENSE_KEYS.concat(\"kind\") : EXPENSE_KEYS)) return \"fields\";",
      to: "  if(!withKind && !hasExactly(body, EXPENSE_KEYS)) return \"fields\";" }] },
  // SF-029: recent groups
  { id: "R9", story: "SF-029", what: "reopening a group started here forgets 'Invite your group'", tests: RECENT, edits: [
    { file: "recent-groups.js", from: "  const invite = startedHere === true || Boolean(old && old.invite === true);", to: "  const invite = startedHere === true;" }] },
  { id: "R10", story: "SF-029", what: "a stored list with the same code twice shows it twice", tests: RECENT, edits: [
    { file: "recent-groups.js", from: "!isValid(e.code) || seen.has(e.code)) return;", to: "!isValid(e.code)) return;" }] },
  { id: "R11", story: "SF-029", what: "'Opened yesterday' becomes 'on <date>'", tests: RECENT, edits: [
    { file: "recent-groups.js", from: "  if(openedAt >= yesterday) return \"yesterday\";\n", to: "" }] },
  { id: "R12", story: "SF-029", what: "the phone's IndexedDB copy isn't deleted by 'Remove from this device' (expected: npm test misses it; browser row B8 covers it)", tests: OUTBOX.concat(PAGE), edits: [
    { file: "outbox.js", from: "      deleteCopy: function(code){ return run(\"copies\", \"readwrite\", function(s){ s.delete(code); }); }",
      to: "      deleteCopy: function(code){ return Promise.resolve(); }" }] },
  // SF-028: dates, names and pasted links
  { id: "R13", story: "SF-028", what: "ledger dates never show the year", tests: RECENT, edits: [
    { file: "recent-groups.js", from: "  return d.getFullYear() === new Date(now).getFullYear() ? text : text + \" \" + d.getFullYear();", to: "  return text;" }] },
  { id: "R14", story: "SF-028", what: "N-1: a link pasted inside brackets or quotes is refused", tests: CODES, edits: [
    { file: "group-code.js", from: ".replace(/^[\\s<(\\[{\"'“‘]+/, \"\")", to: "" }] },
  { id: "R15", story: "SF-028", what: "the group's name isn't capitalised", tests: CODES, edits: [
    { file: "group-code.js", from: "  return text.charAt(0).toUpperCase() + text.slice(1);", to: "  return text;" }] },
  { id: "R16", story: "SF-022", what: "the phone sends a settle-up's edit without its mark (it turns into an ordinary expense)", tests: PAGE.concat(OUTBOX), edits: [
    { file: "ledger-client.js", from: "case \"expense-edit\": return { method: \"PUT\", path: \"/api/expenses/\" + encodeURIComponent(change.replaces), body: expenseBody(change) };",
      to: "case \"expense-edit\": return { method: \"PUT\", path: \"/api/expenses/\" + encodeURIComponent(change.replaces), body: expenseBody(Object.assign({}, change, { settlement: false })) };" }] }
];

const sha = function(buf){ return createHash("sha256").update(buf).digest("hex"); };
const results = [];
for(const b of BREAKS){
  const originals = new Map();
  let out;
  try{
    for(const e of b.edits){
      if(!originals.has(e.file)) originals.set(e.file, readFileSync(e.file));
      const text = readFileSync(e.file, "utf8");
      const count = text.split(e.from).length - 1;
      if(count !== 1) throw new Error(b.id + ": expected the text once in " + e.file + ", found " + count);
      writeFileSync(e.file, text.replace(e.from, e.to));
    }
    out = spawnSync(process.execPath, ["--test", "--test-timeout=30000"].concat([...new Set(b.tests)]), { encoding: "utf8", timeout: 180000 });
  }finally{
    for(const [file, original] of originals) writeFileSync(file, original);
  }
  for(const [file, original] of originals){
    if(sha(readFileSync(file)) !== sha(original)) throw new Error(b.id + ": " + file + " was not restored");
  }
  const output = out.stdout + out.stderr;
  const fail = Number((/ℹ fail (\d+)/.exec(output) || [])[1]);
  const pass = Number((/ℹ pass (\d+)/.exec(output) || [])[1]);
  const failed = output.split("\n").filter(function(l){ return l.startsWith("✖ ") && !l.startsWith("✖ failing tests"); }).map(function(l){ return l.slice(2).replace(/ \([\d.]+ms\)$/, ""); });
  const caught = fail > 0;
  results.push({ id: b.id, story: b.story, what: b.what, caught: caught, pass: pass, fail: fail });
  console.log((caught ? "CAUGHT " : "MISSED ") + b.id + " (" + b.story + ") " + b.what + ": " + fail + " failing, " + pass + " passing");
  [...new Set(failed)].slice(0, 3).forEach(function(n){ console.log("    ✖ " + n); });
}
const missed = results.filter(function(r){ return !r.caught; });
console.log(missed.length === 0 ? "All " + results.length + " breaks caught; every file restored byte for byte." : missed.length + " of " + results.length + " break(s) missed; every file restored byte for byte.");
