// T-06 evidence (not part of `npm test`): runs PRIVACY_POLICY.md section C's Node REPL lines,
// exactly as the doc gives them, against a database the real server made, while that server
// runs (as on Railway). Two groups with people, expenses, an edit, a settle-up, a deleted expense
// and a removed person; the first is deleted. Local only: 127.0.0.1 and a temporary database.
//   node T-06-deletion-check.mjs <repoDir> <scratch dir, emptied first>
// Expected (worked out in the T-06 receipt, SF-017): before, both groups 200; the REPL's first
// count() shows { groups: 1, people: 4, expenses: 5, splits: 9 }; the delete answers changes: 1;
// the second count() is all zeros; after, the deleted group 404 and the other still 200 with
// the same rows.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repoArg, scratch] = process.argv.slice(2);
const repo = path.resolve(repoArg);
fs.rmSync(scratch, { recursive: true, force: true });
fs.mkdirSync(scratch, { recursive: true });
const { createApp } = await import(pathToFileURL(path.join(repo, "server", "server.js")).href);
const app = createApp({ root: repo, dbFile: path.join(scratch, "splitfamilia.db"), log: () => {} });
await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + app.server.address().port;
const call = (code) => async (method, p, body) => (await fetch(base + p, { method, headers: { "X-Group-Code": code, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).status;
const out = {};

const DEL = "delete-me-trip-a9a9ijkeit";
const KEEP = "keep-me-trip-a9a9ijkeit";
for (const code of [DEL, KEEP]) {
  const c = call(code);
  await c("PUT", "/api/group", { currency: "₹" });
  for (const [id, name] of [["p-a", "Asha"], ["p-b", "Ben"], ["p-c", "Chitra"], ["p-d", "Dev"]]) await c("POST", "/api/people", { id, name });
  await c("POST", "/api/expenses", { id: "e1", date: "2026-10-01T10:00:00.000Z", desc: "Dinner", amountPaise: 30000, paidBy: "p-a", split: ["p-a", "p-b", "p-c"] });
  await c("POST", "/api/expenses", { id: "e2", date: "2026-10-01T11:00:00.000Z", desc: "Taxi", amountPaise: 900, paidBy: "p-b", split: ["p-a", "p-b"] });
  await c("PUT", "/api/expenses/e2", { id: "e2b", date: "2026-10-01T11:00:00.000Z", desc: "Taxi", amountPaise: 1200, paidBy: "p-b", split: ["p-a", "p-b"] });
  await c("POST", "/api/expenses", { id: "s1", date: "2026-10-01T12:00:00.000Z", desc: "Payment", amountPaise: 10000, paidBy: "p-b", split: ["p-a"], kind: "settlement" });
  await c("POST", "/api/expenses", { id: "e3", date: "2026-10-01T13:00:00.000Z", desc: "Snacks", amountPaise: 500, paidBy: "p-c", split: ["p-c"] });
  await c("DELETE", "/api/expenses/e3");
  await c("DELETE", "/api/people/p-d");
}
out.before = { del: await call(DEL)("GET", "/api/group"), keep: await call(KEEP)("GET", "/api/group") };

// The REPL lines, exactly as section C gives them (with the code filled in).
const md = fs.readFileSync(path.join(repo, "docs", "google-play", "PRIVACY_POLICY.md"), "utf8");
const blocks = [...md.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1].split("\n").map((l) => l.replace(/^ {3}/, "")).filter((l) => l.trim() !== ""));
out.blockCount = blocks.length;
const lines = blocks.flat().map((l) => l.replace("<GROUP_CODE>", DEL));
const repl = spawn(process.execPath, ["-i"], { cwd: scratch, env: Object.assign({}, process.env, { RAILWAY_VOLUME_MOUNT_PATH: scratch, NODE_DISABLE_COLORS: "1" }) });
let text = "";
repl.stdout.on("data", (d) => { text += d; });
repl.stderr.on("data", (d) => { text += d; });
const exited = new Promise((r) => repl.on("exit", r));
for (const l of lines) { repl.stdin.write(l + "\n"); await new Promise((r) => setTimeout(r, 300)); }
const timer = setTimeout(() => { out.replTimedOut = true; repl.kill(); }, 10000);
await exited;
clearTimeout(timer);
out.repl = text.split(/\r?\n/).filter((l) => l.trim() !== "" && l.trim() !== ">" && l.trim() !== "undefined").map((l) => l.replace(/^> /, ""));
out.after = { del: await call(DEL)("GET", "/api/group"), keep: await call(KEEP)("GET", "/api/group") };
out.keepRows = app.ledger.query("SELECT (SELECT count(*) FROM people WHERE group_code = ?) AS people, (SELECT count(*) FROM expenses WHERE group_code = ?) AS expenses, (SELECT count(*) FROM expense_split WHERE group_code = ?) AS splits", [KEEP, KEEP, KEEP]);
out.delRows = app.ledger.query("SELECT (SELECT count(*) FROM people WHERE group_code = ?) AS people, (SELECT count(*) FROM expenses WHERE group_code = ?) AS expenses, (SELECT count(*) FROM expense_split WHERE group_code = ?) AS splits", [DEL, DEL, DEL]);
await app.close();
console.log(JSON.stringify(out, null, 1));
