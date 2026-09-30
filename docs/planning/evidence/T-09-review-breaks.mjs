// T-09 review: the reviewer's own break checks, for what the implementer's C1-C22 don't cover.
// Each one breaks the code in one small way, runs the tests that should notice, and restores the
// file byte for byte (checked by SHA-256). A check is caught when at least one test fails.
// Run from the repo root, with no other session editing: node docs/planning/evidence/T-09-review-breaks.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const BREAKS = [
  { id: "RB1", what: "the 'moved' check takes any host ending in github.io (notgithub.io too)", file: "group-code.js",
    from: "/(^|\\.)github\\.io$/i", to: "/github\\.io$/i", tests: ["tests/group-code.test.js"] },
  { id: "RB2", what: "a group's shared answer is served whatever the version (stale after a change)", file: "server/api.js",
    from: "if(kept.version === version){", to: "if(true){", tests: ["tests/server-api.test.js", "tests/page-client.test.js"] },
  { id: "RB3", what: "the bar says 'live' while changes wait", file: "sync-status.js",
    from: "  if(state.pending > 0) return changes(state.pending) + \" waiting to sync\";\n", to: "", tests: ["tests/sync-status.test.js"] },
  { id: "RB4", what: "any non-empty IMPORT_TOKEN turns the import on (no 24-character minimum)", file: "server/api.js",
    from: "options.importToken.length >= MIN_IMPORT_TOKEN_LENGTH", to: "options.importToken.length > 0",
    tests: ["tests/move-from-firestore.test.js", "tests/server-api.test.js"] },
  { id: "RB5", what: "the import takes two people with the same ID", file: "server/api.js",
    from: "  if(!unique(body.people)) return \"people\";\n", to: "", tests: ["tests/move-from-firestore.test.js", "tests/server-api.test.js"] },
  { id: "RB6", what: "the read-back check ignores a missing expense when the balances still agree", file: "scripts/move-from-firestore.mjs",
    from: " && g.expenses.length === plan.payload.expenses.length", to: "", tests: ["tests/move-from-firestore.test.js"] },
  { id: "RB7", what: "the import's people cap forgets the people already in the group", file: "server/api.js",
    from: "const people = (exists ? ledger.personIds(code).size : 0) + newPeople;", to: "const people = newPeople;",
    tests: ["tests/move-from-firestore.test.js", "tests/server-api.test.js"] }
];

const sha = function(buf){ return createHash("sha256").update(buf).digest("hex"); };
const results = [];
for (const b of BREAKS) {
  const original = readFileSync(b.file);
  const text = original.toString("utf8");
  if (text.split(b.from).length !== 2) throw new Error(b.id + ": the text to break isn't found exactly once in " + b.file);
  let run;
  try {
    writeFileSync(b.file, text.replace(b.from, b.to));
    run = spawnSync(process.execPath, ["--test", "--test-timeout=20000", ...b.tests], { encoding: "utf8", timeout: 120000 });
  } finally {
    writeFileSync(b.file, original);
  }
  if (sha(readFileSync(b.file)) !== sha(original)) throw new Error(b.id + ": " + b.file + " was not restored");
  const output = run.stdout + run.stderr;
  const failing = Number((/ℹ fail (\d+)/.exec(output) || [])[1]);
  const passing = Number((/ℹ pass (\d+)/.exec(output) || [])[1]);
  const names = output.split("\n").filter((l) => l.startsWith("✖ ") && !l.startsWith("✖ failing tests")).map((l) => l.slice(2).replace(/ \([\d.]+ms\)$/, ""));
  const caught = failing > 0;
  results.push({ id: b.id, caught });
  console.log((caught ? "CAUGHT " : "MISSED ") + b.id + " " + b.what + ": " + failing + " failing, " + passing + " passing");
  [...new Set(names)].slice(0, 3).forEach((n) => console.log("    ✖ " + n));
}
const missed = results.filter((r) => !r.caught);
console.log(missed.length === 0 ? "All " + results.length + " caught; every file restored byte for byte."
  : missed.length + " of " + results.length + " missed: " + missed.map((r) => r.id).join(", ") + ". Every file restored byte for byte.");
