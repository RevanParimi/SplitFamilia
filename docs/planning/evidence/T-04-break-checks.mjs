// T-04 break checks: each one breaks the code in one small way (one or more edits), runs the tests
// that should notice, and restores every file byte for byte (checked by SHA-256). A check passes
// when at least one test fails. Run from the repo root: `node docs/planning/evidence/T-04-break-checks.mjs`.
// It edits files in place for a few seconds each; run it with no other session editing.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const API = ["tests/server-api.test.js"], DB = ["tests/server-db.test.js"], OUTBOX = ["tests/outbox.test.js"], PAGE = ["tests/page-client.test.js"];
const RULES = ["tests/ledger-rules.test.js"], RECENT = ["tests/recent-groups.test.js"], CODES = ["tests/group-code.test.js"];
const WIRING = ["tests/wiring.test.js", "tests/service-worker.test.js"], STATUS = ["tests/sync-status.test.js"];

const BREAKS = [
  // SF-022: editing an expense
  { id: "C1", story: "SF-022", what: "an edit adds the new expense but leaves the old one counted", tests: API.concat(DB, PAGE), edits: [
    { file: "server/db.js", from: "q.deleteExpense.run(now(), code, oldId).changes !== 1", to: "q.expenseLive.get(code, oldId) === undefined" }] },
  { id: "C2", story: "SF-022", what: "an edit of an expense already deleted or edited is applied (counted twice)", tests: API.concat(DB, PAGE), edits: [
    { file: "server/api.js", from: "      if(!ledger.expenseLive(code, r.id)) return fail(req, res, 409, \"failed-precondition\", \"gone\");\n", to: "" },
    { file: "server/db.js", from: "q.deleteExpense.run(now(), code, oldId).changes !== 1", to: "(q.deleteExpense.run(now(), code, oldId), false)" }] },
  { id: "C3", story: "SF-022", what: "an edit sent again (its answer lost) is refused instead of succeeding", tests: API, edits: [
    { file: "server/api.js", from: "      if(ledger.expenseExists(code, body.id)) return sendJson(res, 200, { version: version });\n      // Another phone", to: "      // Another phone" }] },
  { id: "C4", story: "SF-022", what: "edits don't count towards the 5,000-expense limit", tests: API, edits: [
    { file: "server/api.js", from: "      if(ledger.expenseCount(code) >= maxExpenses) return fail(req, res, 409, \"failed-precondition\", \"group-full\");\n      if(ledger.splitEntryCount(code) + body.split.length > maxSplitEntries) return fail(req, res, 409, \"failed-precondition\", \"group-full\");\n      const problem = checkExpense(body, ledger.personIds(code));\n      if(problem) return fail(req, res, 400, \"invalid-argument\", problem);\n      const edit",
      to: "      const problem = checkExpense(body, ledger.personIds(code));\n      if(problem) return fail(req, res, 400, \"invalid-argument\", problem);\n      const edit" }] },
  { id: "C5", story: "SF-022", what: "an edit may keep the old ID", tests: API, edits: [
    { file: "server/api.js", from: "      if(body.id === r.id) return fail(req, res, 400, \"invalid-argument\", \"id\");\n", to: "" }] },
  { id: "C6", story: "SF-022", what: "on the phone, an edit leaves the old expense in the view (counted twice offline)", tests: OUTBOX, edits: [
    { file: "outbox.js", from: "        out.expenses = out.expenses.filter(function(e){ return e.id !== change.replaces; });\n", to: "" }] },
  { id: "C7", story: "SF-022", what: "an edit is sent as a new expense (POST), not to the old one's path", tests: PAGE, edits: [
    { file: "ledger-client.js", from: "case \"expense-edit\": return { method: \"PUT\", path: \"/api/expenses/\" + encodeURIComponent(change.replaces), body: expenseBody(change) };",
      to: "case \"expense-edit\": return { method: \"POST\", path: \"/api/expenses\", body: expenseBody(change) };" }] },
  { id: "C8", story: "SF-022", what: "an edit another phone beat says nothing useful", tests: STATUS.concat(PAGE), edits: [
    { file: "sync-status.js", from: "  \"gone\": \"Someone else changed or deleted it first, so this edit wasn't saved.\"\n", to: "  \"gone-x\": \"\"\n" }] },
  // SF-023: settle-ups
  { id: "C9", story: "SF-023", what: "a settle-up may be split among several people or paid to the payer", tests: RULES.concat(API), edits: [
    { file: "ledger-rules.js", from: "  if(withKind && (split.length !== 1 || split[0] === body.paidBy)) return \"split\";\n", to: "" }] },
  { id: "C10", story: "SF-023", what: "any kind is accepted", tests: RULES.concat(API), edits: [
    { file: "ledger-rules.js", from: "  if(withKind && body.kind !== SETTLEMENT) return \"kind\";\n", to: "" }] },
  { id: "C11", story: "SF-023", what: "the server forgets the settle-up mark when it reads", tests: API.concat(DB, PAGE), edits: [
    { file: "server/db.js", from: "          if(e.kind !== null) row.kind = e.kind;\n", to: "" }] },
  { id: "C12", story: "SF-023", what: "the server doesn't store the settle-up mark", tests: API.concat(DB, PAGE), edits: [
    { file: "server/db.js", from: "e.paidBy, e.kind || null, now()", to: "e.paidBy, null, now()" }] },
  { id: "C13", story: "SF-023", what: "the phone doesn't send the settle-up mark", tests: PAGE, edits: [
    { file: "ledger-client.js", from: "  if(change.settlement === true) body.kind = \"settlement\";\n", to: "" }] },
  { id: "C14", story: "SF-023", what: "the phone's view doesn't mark a waiting settle-up", tests: OUTBOX, edits: [
    { file: "outbox.js", from: "    if(change.settlement === true) row.kind = \"settlement\";\n", to: "" }] },
  // SF-029: recent groups
  { id: "C15", story: "SF-029", what: "opening a group already in the list adds a duplicate", tests: RECENT, edits: [
    { file: "recent-groups.js", from: "concat(list.filter(function(e){ return e.code !== code; }))", to: "concat(list)" }] },
  { id: "C16", story: "SF-029", what: "the list isn't capped at 20", tests: RECENT, edits: [
    { file: "recent-groups.js", from: "return e.code !== code; })).slice(0, MAX_RECENT);", to: "return e.code !== code; }));" }] },
  { id: "C17", story: "SF-029", what: "invalid stored codes are kept", tests: RECENT, edits: [
    { file: "recent-groups.js", from: "if(e === null || typeof e !== \"object\" || !isValid(e.code) || seen.has(e.code)) return;", to: "if(e === null || typeof e !== \"object\" || seen.has(e.code)) return;" }] },
  { id: "C18", story: "SF-029", what: "removing one group removes the rest too", tests: RECENT, edits: [
    { file: "recent-groups.js", from: "  return list.filter(function(e){ return e.code !== code; });\n}\n\n// Does the guide", to: "  return [];\n}\n\n// Does the guide" }] },
  { id: "C19", story: "SF-029", what: "the new module isn't cached for offline", tests: WIRING, edits: [
    { file: "service-worker.js", from: "  \"./recent-groups.js?v=7\",\n", to: "" }] },
  // SF-028: the polished UI
  { id: "C20", story: "SF-028", what: "an alert() comes back for a form check", tests: WIRING, edits: [
    { file: "index.html", from: "      if(!name) return false;\n", to: "      if(!name){ alert(\"Add a name.\"); return false; }\n" }] },
  { id: "C21", story: "SF-028", what: "N-1: a link pasted with a full stop after it is refused again", tests: CODES, edits: [
    { file: "group-code.js", from: ".replace(/[\\s>)\\]}\"'”’.,;:!?]+$/, \"\")", to: "" }] },
  { id: "C22", story: "SF-028", what: "the group's name keeps its random part", tests: CODES, edits: [
    { file: "group-code.js", from: "  if(parts.length > 1 && random) parts.pop();\n", to: "" }] },
  { id: "C23", story: "SF-028", what: "the description field's limit drifts from the server's", tests: WIRING, edits: [
    { file: "index.html", from: "id=\"exp-desc\" placeholder=\"Dinner, tickets, groceries…\" maxlength=\"200\"", to: "id=\"exp-desc\" placeholder=\"Dinner, tickets, groceries…\" maxlength=\"250\"" }] },
  { id: "C24", story: "SF-028", what: "the cache is bumped but the page still imports ?v=7", tests: WIRING, edits: [
    { file: "service-worker.js", from: "const CACHE = \"splitsheet-v7\";", to: "const CACHE = \"splitsheet-v8\";" }] }
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
console.log(missed.length === 0 ? "All " + results.length + " breaks caught; every file restored byte for byte." : missed.length + " break(s) missed.");
process.exitCode = missed.length === 0 ? 0 : 1;
