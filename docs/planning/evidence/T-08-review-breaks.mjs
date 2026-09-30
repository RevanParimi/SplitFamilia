// T-08 fresh-session review: the reviewer's own break checks, beyond the implementer's B1-B14.
// Each edits one file for a few seconds, runs the tests that should notice, and restores the file
// byte for byte (SHA-256 checked). Run from the repo, with no other session editing:
// node docs/planning/evidence/T-08-review-breaks.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const sha = function(buf){ return createHash("sha256").update(buf).digest("hex"); };

const BREAKS = [
  { id: "R1", what: "no dot-segment check (the URL parser tidies /%2e%2e/ to /)", file: "server/server.js",
    from: "if(hasDotSegment(req.url)) return", to: "if(false && hasDotSegment(req.url)) return",
    tests: ["tests/server-static.test.js"] },
  { id: "R2", what: "trust X-Real-IP everywhere, not only behind Railway", file: "server/api.js",
    from: "if(trustProxy && typeof real", to: "if(typeof real", tests: ["tests/server-api.test.js"] },
  { id: "R3", what: "count only Content-Length, not the bytes that arrive", file: "server/api.js",
    from: "if(size > MAX_BODY_BYTES){", to: "if(false){", tests: ["tests/server-api.test.js"] },
  { id: "R4", what: "a closed stream stays in the hub", file: "server/live.js",
    from: "res.on(\"close\", function(){ remove(code, res, address); });", to: "", tests: ["tests/server-live.test.js"] },
  { id: "R5", what: "a person only in a split (not the payer) can be deleted", file: "server/db.js",
    from: "(e.paid_by = ? OR EXISTS", to: "(e.paid_by = ? OR 0 AND EXISTS", tests: ["tests/server-api.test.js"] },
  { id: "R6", what: "the client keeps retrying an unknown code", file: "ledger-client.js",
    from: "res.status === 404 ? \"not-found\" : null", to: "null", tests: ["tests/server-live.test.js"] },
  { id: "R7", what: "the API answers without Cache-Control: no-store", file: "server/api.js",
    from: "\"Cache-Control\": \"no-store\"", to: "\"Cache-Control\": \"no-cache\"", tests: ["tests/server-api.test.js", "tests/server-static.test.js"] },
  { id: "R8", what: "reading a group drops the first person of every split", file: "server/db.js",
    from: "\"SELECT s.expense_id, s.person_id FROM expense_split s JOIN expenses e ON e.group_code = s.group_code AND e.id = s.expense_id \" +\n      \"WHERE s.group_code = ? AND e.deleted_at IS NULL",
    to: "\"SELECT s.expense_id, s.person_id FROM expense_split s JOIN expenses e ON e.group_code = s.group_code AND e.id = s.expense_id \" +\n      \"WHERE s.group_code = ? AND s.position > 0",
    tests: ["tests/server-db.test.js", "tests/server-api.test.js"] }
];

let allCaught = true;
for(const b of BREAKS){
  const original = readFileSync(b.file);
  const text = original.toString("utf8");
  if(!text.includes(b.from)){ console.log("SKIP " + b.id + ": pattern not found in " + b.file); allCaught = false; continue; }
  try{
    writeFileSync(b.file, text.replace(b.from, b.to));
    const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "--test-timeout=20000"].concat(b.tests), { encoding: "utf8", timeout: 120000 });
    const failing = (run.stdout.match(/^# fail (\d+)/m) || [])[1];
    const passing = (run.stdout.match(/^# pass (\d+)/m) || [])[1];
    const names = run.stdout.split("\n").filter(function(l){ return /^not ok \d+ - /.test(l); }).map(function(l){ return l.replace(/^not ok \d+ - /, ""); });
    const caught = run.status !== 0 && Number(failing) > 0;
    if(!caught) allCaught = false;
    console.log((caught ? "CAUGHT " : "MISSED ") + b.id + " " + b.what + ": " + failing + " failing, " + passing + " passing");
    names.forEach(function(n){ console.log("    x " + n); });
  }finally{
    writeFileSync(b.file, original);
    if(sha(readFileSync(b.file)) !== sha(original)) throw new Error("restore failed for " + b.file);
  }
}
console.log(allCaught ? "All " + BREAKS.length + " reviewer breaks caught; every file restored byte for byte." : "Not every break was caught (see above); every file restored byte for byte.");
