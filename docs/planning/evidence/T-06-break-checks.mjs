// T-06 break checks (evidence only): each check makes one wrong edit, runs the tests that should
// catch it, expects them to FAIL, and puts the file back byte for byte. Edits last a few seconds
// each: don't run this while a browser check or a build uses the same files.
//   node docs/planning/evidence/T-06-break-checks.mjs   (from the repository root)
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const PRIVACY = ["tests/privacy.test.js"];
const WIRING = ["tests/wiring.test.js"];
const BOTH = PRIVACY.concat(WIRING);
const SERVER = ["tests/server-api.test.js"];
const CHECKS = [
  { id: "K1", story: "SF-018", what: "privacy.html says something the policy doesn't (60 days of logs, not 30)", tests: PRIVACY, edits: [
    { file: "privacy.html", from: "Railway keeps these logs for 30 days", to: "Railway keeps these logs for 60 days" }] },
  { id: "K2", story: "SF-017", what: "the policy text changes in PRIVACY_POLICY.md only", tests: PRIVACY, edits: [
    { file: "docs/google-play/PRIVACY_POLICY.md", from: "- Every connection uses HTTPS.\n", to: "- Every connection uses HTTPS, and nothing is stored.\n" }] },
  { id: "K3", story: "SF-017", what: "a section of the policy is dropped from privacy.html", tests: PRIVACY, edits: [
    { file: "privacy.html", from: "<h2>16. Changes to this policy</h2>", to: "<h3>16. Changes to this policy</h3>" }] },
  { id: "K4", story: "SF-018", what: "privacy.html loads the app's web fonts from Google", tests: PRIVACY, edits: [
    { file: "privacy.html", from: "<link rel=\"icon\" href=\"icon-192.png\" />", to: "<link rel=\"icon\" href=\"icon-192.png\" />\n<link href=\"https://fonts.googleapis.com/css2?family=Inter\" rel=\"stylesheet\" />" }] },
  { id: "K5", story: "SF-018", what: "privacy.html runs a script", tests: PRIVACY, edits: [
    { file: "privacy.html", from: "</main>", to: "</main>\n<script>document.title = 'x';</script>" }] },
  { id: "K6", story: "SF-018", what: "the group menu loses its privacy link", tests: PRIVACY, edits: [
    { file: "index.html", from: "      <p class=\"menu-note\"><a class=\"policy-link\" href=\"privacy.html\">Privacy policy</a></p>\n", to: "" }] },
  { id: "K7", story: "SF-018", what: "the welcome screen's privacy link is hidden inside the app (web-only)", tests: PRIVACY, edits: [
    { file: "index.html", from: "on any phone.<br /><a class=\"policy-link\" href=\"privacy.html\">Privacy policy</a>", to: "on any phone.<span class=\"web-only\"><br /><a class=\"policy-link\" href=\"privacy.html\">Privacy policy</a></span>" }] },
  { id: "K8", story: "SF-018", what: "privacy.html is dropped from the worker's SHELL (no offline copy)", tests: BOTH, edits: [
    { file: "service-worker.js", from: "  \"./privacy.html\",\n", to: "" }] },
  { id: "K9", story: "SF-018", what: "privacy.html is not copied into the Docker image (a 404 on Railway)", tests: BOTH, edits: [
    { file: "Dockerfile", from: "COPY index.html privacy.html manifest.json", to: "COPY index.html manifest.json" }] },
  { id: "K10", story: "SF-018", what: ".dockerignore keeps privacy.html out of the build", tests: BOTH, edits: [
    { file: ".dockerignore", from: "!privacy.html\n", to: "" }] },
  { id: "K11", story: "SF-018", what: "a change to privacy.html alone wouldn't redeploy (no watch pattern)", tests: BOTH, edits: [
    { file: "railway.json", from: "      \"/privacy.html\",\n", to: "" }] },
  { id: "K12", story: "SF-018", what: "a watch pattern so wide that docs and tests redeploy the site", tests: WIRING, edits: [
    { file: "railway.json", from: "      \"/index.html\",\n", to: "      \"/**\",\n      \"/index.html\",\n" }] },
  { id: "K13", story: "SF-018", what: "the server stops serving privacy.html", tests: ["tests/server-static.test.js"].concat(BOTH), edits: [
    { file: "server/static.js", from: "  \"/privacy.html\": \"text/html; charset=utf-8\",\n", to: "" }] },
  // The rework (the T-06 review's F-16): the server forgets IP addresses as the policy says.
  { id: "K14", story: "SF-017 F-16", what: "the limiters' sweep forgets nothing", tests: SERVER, edits: [
    { file: "server/api.js", from: "      hits.forEach(function(_, address){ recent(address); });\n", to: "" }] },
  { id: "K15", story: "SF-017 F-16", what: "the server's timer never sweeps the limiters", tests: SERVER, edits: [
    { file: "server/server.js", from: "    limiter.sweep();\n    writes.sweep();\n", to: "" }] },
  { id: "K16", story: "SF-017 F-16", what: "close() leaves the sweep timer running", tests: SERVER, edits: [
    { file: "server/server.js", from: "        clearInterval(sweeper);\n", to: "" }] },
  { id: "K17", story: "SF-017 F-16", what: "the sweep timer keeps the process running (no unref)", tests: SERVER, edits: [
    { file: "server/server.js", from: "  sweeper.unref();\n", to: "" }] },
  { id: "K18", story: "SF-017 F-16", what: "the policy promises 10 minutes again, in both files alike", tests: PRIVACY, edits: [
    { file: "docs/google-play/PRIVACY_POLICY.md", from: "for at most 11 minutes after the last request", to: "for at most 10 minutes after the last request" },
    { file: "docs/google-play/PRIVACY_POLICY.md", from: "for at most 11 minutes after the last request", to: "for at most 10 minutes after the last request" },
    { file: "privacy.html", from: "for at most 11 minutes after the last request", to: "for at most 10 minutes after the last request" },
    { file: "privacy.html", from: "for at most 11 minutes after the last request", to: "for at most 10 minutes after the last request" }] },
  { id: "K19", story: "SF-017 F-16", what: "the change window grows to 15 minutes and the policy isn't updated", tests: PRIVACY, edits: [
    { file: "server/api.js", from: "export const WRITE_WINDOW_MS = 10 * 60 * 1000;", to: "export const WRITE_WINDOW_MS = 15 * 60 * 1000;" }] },
  { id: "K20", story: "SF-017 F-16", what: "the declarations give Play Console a different time from the policy", tests: PRIVACY, edits: [
    { file: "docs/google-play/PLAY_CONSOLE_DECLARATIONS.md", from: "at most 11 minutes after its last request", to: "at most 10 minutes after its last request" }] }
];

const results = [];
for (const c of CHECKS) {
  const originals = new Map();
  let applied = true;
  try {
    for (const e of c.edits) {
      if (!originals.has(e.file)) originals.set(e.file, fs.readFileSync(e.file));
      const text = fs.readFileSync(e.file, "utf8");
      if (!text.includes(e.from)) { applied = false; break; }
      fs.writeFileSync(e.file, text.replace(e.from, e.to));
    }
    if (!applied) { results.push(c.id + " NOT APPLIED (the text to change wasn't found): " + c.what); continue; }
    const run = spawnSync(process.execPath, ["--test"].concat(c.tests), { encoding: "utf8" });
    const failed = (/ℹ fail (\d+)/.exec(run.stdout) || [])[1];
    results.push(c.id + " " + (run.status !== 0 ? "CAUGHT" : "MISSED") + " (" + c.story + ", " + (failed || "?") + " failing): " + c.what);
  } finally {
    for (const [file, bytes] of originals) fs.writeFileSync(file, bytes);
  }
}
console.log(results.join("\n"));
const caught = results.filter((r) => / CAUGHT /.test(r)).length;
console.log(caught + "/" + CHECKS.length + " caught");
process.exit(caught === CHECKS.length ? 0 : 1);
