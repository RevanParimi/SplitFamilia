// T-08 break checks: each one breaks the code in one small way, runs the tests that should notice,
// and restores the file byte for byte (checked by SHA-256). A check passes when at least one test
// fails. Run from the repo root: `node docs/planning/evidence/T-08-break-checks.mjs`.
// It edits files in place for a few seconds each; run it on a clean working tree only.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const BREAKS = [
  { id: "B1", story: "SF-031", what: "drop X-Content-Type-Options: nosniff", file: "server/static.js",
    from: "  \"X-Content-Type-Options\": \"nosniff\",\n", to: "", tests: ["tests/server-static.test.js"] },
  { id: "B2", story: "SF-031", what: "serve package.json too", file: "server/static.js",
    from: "  \"/manifest.json\": \"application/json\",", to: "  \"/manifest.json\": \"application/json\",\n  \"/package.json\": \"application/json\",",
    tests: ["tests/server-static.test.js", "tests/wiring.test.js"] },
  { id: "B3", story: "SF-031", what: "leave server/live.js out of the image", file: "Dockerfile",
    from: " server/api.js server/live.js /app/server/", to: " server/api.js /app/server/", tests: ["tests/wiring.test.js"] },
  { id: "B4", story: "SF-032", what: "build one query by string concatenation", file: "server/db.js",
    from: "    const row = q.group.get(code);\n    return row ? row.version : null;",
    to: "    const row = db.prepare(\"SELECT currency, version FROM groups WHERE code = '\" + code + \"'\").get();\n    return row ? row.version : null;",
    tests: ["tests/server-db.test.js"] },
  { id: "B5", story: "SF-032", what: "really delete an expense (no record), so a replay brings it back", file: "server/db.js",
    from: "\"UPDATE expenses SET deleted_at = ? WHERE group_code = ? AND id = ? AND deleted_at IS NULL\"",
    to: "\"DELETE FROM expenses WHERE ? IS NOT NULL AND group_code = ? AND id = ? AND deleted_at IS NULL\"",
    tests: ["tests/server-db.test.js", "tests/server-api.test.js"] },
  { id: "B6", story: "SF-033", what: "F-7: skip the code check on DELETE", file: "server/api.js",
    from: "    if(!isValidGroupId(code)) return", to: "    if(req.method !== \"DELETE\" && !isValidGroupId(code)) return",
    tests: ["tests/server-api.test.js"] },
  { id: "B7", story: "SF-033", what: "F-6: allow a split of 101", file: "ledger-rules.js",
    from: "export const MAX_SPLIT = 100;", to: "export const MAX_SPLIT = 101;",
    tests: ["tests/ledger-rules.test.js", "tests/server-api.test.js", "tests/wiring.test.js"] },
  { id: "B8", story: "SF-033", what: "let a person used in an expense be deleted", file: "server/api.js",
    from: "      if(ledger.personInUse(code, r.id)) return", to: "      if(false && ledger.personInUse(code, r.id)) return",
    tests: ["tests/server-api.test.js"] },
  { id: "B14", story: "SF-033", what: "no cap on people per group", file: "server/api.js",
    from: "      if(ledger.personIds(code).size >= MAX_PEOPLE) return", to: "      if(false && ledger.personIds(code).size >= MAX_PEOPLE) return",
    tests: ["tests/server-api.test.js"] },
  { id: "B9", story: "SF-033", what: "allow one more unknown code (the 31st gets 404)", file: "server/api.js",
    from: "      return list !== null && list.length >= limit;", to: "      return list !== null && list.length > limit;",
    tests: ["tests/server-api.test.js"] },
  { id: "B10", story: "SF-033", what: "log the group code with a refusal", file: "server/api.js",
    from: "    if(status !== 429) log(\"SplitFamilia api: \" + req.method + \" \" + status + \" \" + code);",
    to: "    if(status !== 429) log(\"SplitFamilia api: \" + req.method + \" \" + status + \" \" + code + \" \" + req.headers[GROUP_HEADER]);",
    tests: ["tests/server-api.test.js"] },
  { id: "B11", story: "SF-034", what: "don't tell other pages about a change", file: "server/api.js",
    from: "    hub.publish(code, version);", to: "    // hub.publish(code, version);", tests: ["tests/server-live.test.js"] },
  { id: "B12", story: "SF-034", what: "cap the reconnect delay at 60 s", file: "ledger-client.js",
    from: "return Math.min(1000 * Math.pow(2, failures), 30000);", to: "return Math.min(1000 * Math.pow(2, failures), 60000);",
    tests: ["tests/server-live.test.js"] },
  { id: "B13", story: "SF-034", what: "keep the old watch when a new one starts (two connections per page)", file: "ledger-client.js",
    from: "  if(active) active.stop();\n", to: "", tests: ["tests/server-live.test.js"] },
  // The rework after the T-08 review (F-8, D-17, N-4).
  { id: "B15", story: "SF-033", what: "F-8: check the guess limit only before the body is read", file: "server/api.js",
    from: "    if(limiter.blocked(address)) return tooMany(req, res, limiter, address);\n    if(req.method !== \"GET\"){",
    to: "    if(req.method !== \"GET\"){", tests: ["tests/server-api.test.js"] },
  { id: "B16", story: "SF-033", what: "D-17: no limit on changes per address", file: "server/api.js",
    from: "      if(writes.blocked(address)) return tooMany(req, res, writes, address);\n", to: "",
    tests: ["tests/server-api.test.js"] },
  // Since T-04 (SF-022) the edit route has the same cap line, so B17 is anchored on the line
  // before it in the add route (the T-06 rework, 2026-10-02).
  { id: "B17", story: "SF-033", what: "D-17: no cap on expenses per group", file: "server/api.js",
    from: "{ version: version });\n      if(ledger.expenseCount(code) >= maxExpenses) return", to: "{ version: version });\n      if(false && ledger.expenseCount(code) >= maxExpenses) return",
    tests: ["tests/server-api.test.js"] },
  { id: "B18", story: "SF-034", what: "D-17: no cap on streams per address", file: "server/live.js",
    from: "return total >= maxStreams || (perAddress.get(address) || 0) >= maxPerAddress;", to: "return total >= maxStreams;",
    tests: ["tests/server-live.test.js"] },
  { id: "B19", story: "SF-034", what: "D-17: an address's closed streams still count against it", file: "server/live.js",
    from: "    if(held > 0) perAddress.set(address, held);\n    else perAddress.delete(address);\n", to: "",
    tests: ["tests/server-live.test.js"] },
  { id: "B20", story: "SF-033", what: "N-4: take a date that rolls over (2026-02-30)", file: "ledger-rules.js",
    from: " && new Date(ms).toISOString().slice(0, 19) === value.slice(0, 19)", to: "",
    tests: ["tests/ledger-rules.test.js"] }
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
    // A break can leave something running (say, a watch that keeps reconnecting), so each run
    // has a time limit.
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
  results.push({ id: b.id, story: b.story, what: b.what, caught: caught, pass: pass, fail: fail, first_failing: [...new Set(failed)].slice(0, 3) });
  console.log((caught ? "CAUGHT " : "MISSED ") + b.id + " (" + b.story + ") " + b.what + ": " + fail + " failing, " + pass + " passing");
  [...new Set(failed)].slice(0, 3).forEach(function(n){ console.log("    ✖ " + n); });
}
const missed = results.filter(function(r){ return !r.caught; });
console.log(missed.length === 0 ? "All " + results.length + " breaks caught; every file restored byte for byte." : missed.length + " break(s) missed.");
process.exitCode = missed.length === 0 ? 0 : 1;
