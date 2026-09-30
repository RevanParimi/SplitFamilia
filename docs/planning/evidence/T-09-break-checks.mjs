// T-09 break checks: each one breaks the code in one small way, runs the tests that should notice,
// and restores the file byte for byte (checked by SHA-256). A check passes when at least one test
// fails. Run from the repo root: `node docs/planning/evidence/T-09-break-checks.mjs`.
// It edits files in place for a few seconds each; run it with no other session editing.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const BREAKS = [
  // SF-035: the page on its own server
  { id: "C1", story: "SF-035", what: "the worker handles (and caches) /api/", file: "service-worker.js",
    from: "  if (url.pathname === API_PREFIX.slice(0, -1) || url.pathname.startsWith(API_PREFIX)) return;\n", to: "",
    tests: ["tests/service-worker.test.js"] },
  { id: "C2", story: "SF-035", what: "the worker fetches the page with its ?g=", file: "service-worker.js",
    from: "fetch(isPage ? PAGE : e.request)", to: "fetch(e.request)", tests: ["tests/service-worker.test.js"] },
  { id: "C3", story: "SF-035", what: "the client puts the group code in the URL", file: "ledger-client.js",
    from: "const res = await doFetch((options.baseUrl || \"\") + path, init);",
    to: "const res = await doFetch((options.baseUrl || \"\") + path + \"?code=\" + code, init);", tests: ["tests/page-client.test.js"] },
  { id: "C4", story: "SF-035", what: "F-6: a refusal's words ignore what was being saved", file: "sync-status.js",
    from: "    if(own(FIELD_TEXT, field + \":\" + kind)) return FIELD_TEXT[field + \":\" + kind];\n", to: "",
    tests: ["tests/sync-status.test.js", "tests/page-client.test.js"] },
  { id: "C5", story: "SF-038", what: "a gstatic URL back in index.html (the card's break check)", file: "index.html",
    from: "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />",
    to: "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" /><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />",
    tests: ["tests/wiring.test.js"] },
  // SF-036: the outbox
  { id: "C6", story: "SF-036", what: "a 429 drops the change instead of waiting", file: "outbox.js",
    from: "status !== 408 && status !== 429) return \"refused\";", to: "status !== 408) return \"refused\";", tests: ["tests/outbox.test.js"] },
  { id: "C7", story: "SF-036", what: "F-5: deletes aren't counted", file: "outbox.js",
    from: "waiting.filter(function(c){ return c.code === code; }).length;",
    to: "waiting.filter(function(c){ return c.code === code && !/-delete$/.test(c.kind); }).length;", tests: ["tests/outbox.test.js"] },
  { id: "C8", story: "SF-036", what: "a change that must wait is skipped, so later ones overtake it", file: "outbox.js",
    from: "      if(result === \"retry\") return { state: \"wait\", retryAfter: res.retryAfter || 0 };", to: "      if(result === \"retry\") continue;",
    tests: ["tests/outbox.test.js"] },
  { id: "C9", story: "SF-036", what: "rows not on the server aren't marked waiting", file: "outbox.js",
    from: "view = applyChange(view, c, { waiting: true });", to: "view = applyChange(view, c, {});", tests: ["tests/outbox.test.js"] },
  { id: "C10", story: "SF-036", what: "balances read paise as rupees", file: "outbox.js",
    from: "amount: e.amountPaise / 100", to: "amount: e.amountPaise", tests: ["tests/outbox.test.js", "tests/page-client.test.js"] },
  { id: "C11", story: "SF-036", what: "two tabs may send at once (no lock)", file: "outbox.js",
    from: "result = await lock(sendAll);", to: "result = await sendAll();", tests: ["tests/outbox.test.js"] },
  // SF-037: the move
  { id: "C12", story: "SF-037", what: "the balance check lets one paisa through (the card's break check)", file: "scripts/move-from-firestore.mjs",
    from: "if((a.get(id) || 0) !== (b.get(id) || 0)) return false;", to: "if(Math.abs((a.get(id) || 0) - (b.get(id) || 0)) > 1) return false;",
    tests: ["tests/move-from-firestore.test.js"] },
  { id: "C13", story: "SF-037", what: "the import takes any token", file: "server/api.js",
    from: "    if(!isImportToken(req.headers[\"authorization\"], importToken)) return fail(req, res, 404, \"not-found\");\n", to: "",
    tests: ["tests/move-from-firestore.test.js"] },
  { id: "C14", story: "SF-037", what: "expenses the page doesn't count today aren't flagged", file: "scripts/move-from-firestore.mjs",
    from: "    const problem = expenseProblem(e);", to: "    const problem = null;", tests: ["tests/move-from-firestore.test.js"] },
  // SF-038 (D-18, N-5, the moved notice)
  { id: "C15", story: "SF-038", what: "D-18: no cap on a group's split entries", file: "server/api.js",
    from: "      if(ledger.splitEntryCount(code) + body.split.length > maxSplitEntries) return fail(req, res, 409, \"failed-precondition\", \"group-full\");\n",
    to: "", tests: ["tests/server-api.test.js"] },
  { id: "C16", story: "SF-038", what: "D-18: every read builds the answer again", file: "server/api.js",
    from: "      if(kept.version === version){", to: "      if(false && kept.version === version){", tests: ["tests/server-api.test.js"] },
  { id: "C17", story: "SF-038", what: "D-18: gzip even when the browser refuses it", file: "server/api.js",
    from: "const zipped = acceptsGzip(req.headers[\"accept-encoding\"]) ? await answer.gzip : null;", to: "const zipped = await answer.gzip;",
    tests: ["tests/server-api.test.js"] },
  { id: "C18", story: "SF-038", what: "N-5: /healthz 200 with the database unavailable", file: "server/server.js",
    from: "res.writeHead(ledger ? 200 : 503, Object.assign({", to: "res.writeHead(200, Object.assign({", tests: ["tests/server-db.test.js"] },
  { id: "C19", story: "SF-038", what: "the old address never shows the notice", file: "group-code.js",
    from: "  if(!/(^|\\.)github\\.io$/i.test(url.hostname)) return null;", to: "  return null;", tests: ["tests/group-code.test.js"] },
  { id: "C20", story: "SF-038", what: "a shipped file mentions Firebase again", file: "money.js",
    from: "// Balance maths for the ledger, in whole paise.", to: "// Balance maths for the ledger (once on Firebase), in whole paise.",
    tests: ["tests/wiring.test.js"] },
  // The first T-08 review's R3 and R7, whose text T-09 changed (readJson's limit is now a
  // parameter, and a group's read has its own sender): the same breaks, written for today's code.
  { id: "C21", story: "SF-033", what: "R3 again: count only Content-Length, not the bytes that arrive", file: "server/api.js",
    from: "      if(size > maxBytes){", to: "      if(false){", tests: ["tests/server-api.test.js"] },
  { id: "C22", story: "SF-033", what: "R7 again: changes and refusals answer without no-store", file: "server/api.js",
    from: "    // Group data is never kept by a browser's or a proxy's HTTP cache.\n    \"Cache-Control\": \"no-store\"",
    to: "    // Group data is never kept by a browser's or a proxy's HTTP cache.\n    \"Cache-Control\": \"no-cache\"", tests: ["tests/server-api.test.js"] }
];

const sha = function(buf){ return createHash("sha256").update(buf).digest("hex"); };
const results = [];
for(const b of BREAKS){
  const original = readFileSync(b.file);
  const text = original.toString("utf8");
  const count = text.split(b.from).length - 1;
  if(count !== 1) throw new Error(b.id + ": expected the text once in " + b.file + ", found " + count);
  let out;
  try{
    writeFileSync(b.file, text.replace(b.from, b.to));
    out = spawnSync(process.execPath, ["--test", "--test-timeout=20000"].concat(b.tests), { encoding: "utf8", timeout: 120000 });
  }finally{
    writeFileSync(b.file, original);
  }
  if(sha(readFileSync(b.file)) !== sha(original)) throw new Error(b.id + ": " + b.file + " was not restored");
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
