// T-06 second review: independent break checks for F-16 (evidence only, not part of `npm test`;
// 2026-10-02 IST), beyond the rework's K14-K20. Don't run it while a browser check or a build uses
// the same files.
//   node docs/planning/evidence/T-06-review2-breaks.mjs <repoDir>   (about 30 s)
// Each break edits one or two files for a few seconds, runs the focused tests, then restores the
// files byte for byte (checked by SHA-256).
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const repo = process.argv[2];
const sha = function(b){ return createHash("sha256").update(b).digest("hex"); };
const TESTS = ["tests/server-api.test.js", "tests/privacy.test.js", "tests/server-live.test.js"];

const breaks = [
  { id: "X1", what: "the timer sweeps only the guess limiter, not the change limiter",
    edits: [["server/server.js", "    limiter.sweep();\n    writes.sweep();\n", "    limiter.sweep();\n"]] },
  { id: "X2", what: "SWEEP_MS becomes 90 s (window + 1.5 min > the policy's 11 minutes)",
    edits: [["server/api.js", "export const SWEEP_MS = 30 * 1000;", "export const SWEEP_MS = 90 * 1000;"]] },
  { id: "X3", what: "the sweep forgets every address, even ones still inside the window (weakens the guessing limit)",
    edits: [["server/api.js", "hits.forEach(function(_, address){ recent(address); });", "hits.clear();"]] },
  { id: "X4", what: "createApp ignores the sweepMs option (always 30 s)",
    edits: [["server/server.js", "}, options.sweepMs || SWEEP_MS);", "}, SWEEP_MS);"]] },
  { id: "X5", what: "the live hub keeps an address (at 0) after its last stream closes",
    edits: [["server/live.js", "else perAddress.delete(address);", "else perAddress.set(address, 0);"]] },
  { id: "X6", what: "section 5 drops the live-connection clause (both files alike); section 10 keeps it",
    edits: [
      ["docs/google-play/PRIVACY_POLICY.md", "It keeps the address while a live connection from the app is open (the app keeps one open while a group is open, for live updates), and for at most 11 minutes after the last request from that address.", "It keeps the address for at most 11 minutes after the last request from that address."],
      ["privacy.html", "It keeps the address while a live connection from the app is open (the app keeps one open while a group is open, for live updates), and for at most 11 minutes after the last request from that address.", "It keeps the address for at most 11 minutes after the last request from that address."]
    ] }
];

const results = [];
for(const b of breaks){
  const originals = new Map();
  let applied = true;
  for(const [file, from, to] of b.edits){
    const path = join(repo, file);
    const buf = originals.has(path) ? null : readFileSync(path);
    if(buf) originals.set(path, buf);
    const text = readFileSync(path, "utf8");
    const count = text.split(from).length - 1;
    if(count !== 1){ applied = false; results.push(b.id + " NOT APPLIED: " + file + " has the text " + count + " times"); break; }
    writeFileSync(path, text.replace(from, to));
  }
  let line;
  try{
    if(applied){
      const run = spawnSync(process.execPath, ["--test", ...TESTS], { cwd: repo, encoding: "utf8", timeout: 300000 });
      const fail = /ℹ fail (\d+)/.exec(run.stdout);
      const failing = fail ? Number(fail[1]) : -1;
      const names = (run.stdout.match(/^✖ .*$/gm) || []).slice(0, 4).map(function(s){ return s.slice(0, 140); });
      line = b.id + (failing > 0 ? " CAUGHT (" + failing + " failing)" : " NOT CAUGHT") + ": " + b.what + (names.length ? "\n    " + names.join("\n    ") : "");
    }
  }finally{
    for(const [path, buf] of originals){
      writeFileSync(path, buf);
      if(sha(readFileSync(path)) !== sha(buf)) throw new Error("restore failed: " + path);
    }
  }
  if(line) results.push(line);
}
console.log(results.join("\n"));
