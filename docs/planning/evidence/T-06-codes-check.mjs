// T-06 / SF-021 evidence (not part of `npm test`): do any of the family's real group codes appear in
// git, in any commit or in the tree? The codes come from the git-ignored data/move-report-*.txt
// (the T-09 move's reports). Nothing here prints a code: only counts and, for a hit, the top folder
// it is in (with --show, run locally, the file too; never commit that output).
// Run from the repository root:  node docs/planning/evidence/T-06-codes-check.mjs [--show]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { isValidGroupId } from "../../../group-code.js";

const reports = fs.existsSync("data") ? fs.readdirSync("data").filter((f) => /^move-report-.*\.txt$/.test(f)) : [];
const codes = new Set();
for (const f of reports) {
  const text = fs.readFileSync("data/" + f, "utf8");
  // A code is a word of letters, digits and hyphens that group-code.js accepts and that has a
  // hyphen (every code the app has made has one); the report's own words are excluded below.
  for (const m of text.matchAll(/[a-z0-9][a-z0-9-]*-[a-z0-9-]*[a-z0-9]/g)) if (isValidGroupId(m[0])) codes.add(m[0]);
}
// Words that are part of the report's own wording or file names, not codes.
const COMMON = /^(move-report|every-balance|read-only|up-to-date|t-09|sf-0\d\d|\d{4}-\d\d-\d\d.*)$/;
const candidates = [...codes].filter((c) => !COMMON.test(c));
const show = process.argv.includes("--show");
console.log("reports: " + reports.length + "; code-like words: " + codes.size + "; candidates after excluding report wording: " + candidates.length
 );

const revs = execFileSync("git", ["rev-list", "--all"], { encoding: "utf8" }).trim().split("\n");
let hits = 0;
for (const c of candidates) {
  for (const where of [["--untracked"], revs]) {
    let out = "";
    try { out = execFileSync("git", ["grep", "-lF", "-e", c].concat(where), { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { out = ""; }
    const files = out.trim() ? out.trim().split("\n").map((l) => l.replace(/^[0-9a-f]{40}:/, "")) : [];
    const unique = [...new Set(files)].filter((f) => !f.startsWith("data/"));
    if (unique.length) { hits++; console.log("HIT: a candidate, in " + (where[0] === "--untracked" ? "the tree" : "history") + ": " + (show ? unique.join(", ") : [...new Set(unique.map((f) => f.split("/")[0] + "/"))].join(", "))); }
  }
}
console.log(hits === 0 ? "no candidate appears in any tracked file, untracked file or commit" : hits + " hit(s): see above (codes not printed)");
