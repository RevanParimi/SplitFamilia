// PC-007 against the live site after T-09's push B. Prints no group code, name or amount: only
// counts, booleans and fingerprints. Codes come from data/move-codes.txt (git-ignored).
//   node docs/planning/evidence/T-09-pc007-check.mjs <push B commit> <empty scratch dir> <test group number>
// The test group (an empty one) gets one person and one ₹1.00 expense, both deleted again.
import { request } from "node:https";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [commit, scratch, testArg] = process.argv.slice(2);
const HOST = "splitfamilia.up.railway.app";
const HOME = "https://" + HOST + "/";
const PAGES = "https://revanparimi.github.io/SplitFamilia/";
const repo = process.cwd();
const { computeBalances, simplifyDebts } = await import(pathToFileURL(repo + "/money.js").href);
const { fingerprint } = await import(pathToFileURL(repo + "/scripts/move-from-firestore.mjs").href);
const codes = fs.readFileSync(repo + "/data/move-codes.txt", "utf8").split(/\s+/).filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => console.log(s);
const committed = (file) => execFileSync("git", ["show", commit + ":" + file]);

function send(method, host, p, headers, body){
  return new Promise(function(resolve, reject){
    const req = request({ host: host, path: p, method: method, headers: headers || {} }, function(res){
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("timeout")));
    req.end(body);
  });
}
async function readGroup(code){
  const r = await send("GET", HOST, "/api/group", { "X-Group-Code": code });
  return r.status === 200 ? JSON.parse(r.body.toString("utf8")) : null;
}
const balancesOf = (g) => computeBalances(g.people, g.expenses.map((e) => Object.assign({}, e, { amount: e.amountPaise / 100 })));

say("PC-007 against " + HOME + " and commit " + commit + ", " + new Date().toISOString());

// Step 1. Wait for the new page (the worker names splitsheet-v6), then check the files.
for (let i = 0; i < 60; i++) {
  if ((await send("GET", HOST, "/service-worker.js")).body.toString("utf8").includes('"splitsheet-v6"')) break;
  await sleep(5000);
}
const hz = await send("GET", HOST, "/healthz");
say("1. /healthz → " + hz.status + " " + hz.body.toString("utf8"));
for (const [p, file] of [["/", "index.html"], ["/money.js?v=6", "money.js"], ["/group-code.js?v=6", "group-code.js"], ["/sync-status.js?v=6", "sync-status.js"],
  ["/ledger-rules.js?v=6", "ledger-rules.js"], ["/ledger-client.js?v=6", "ledger-client.js"], ["/outbox.js?v=6", "outbox.js"],
  ["/service-worker.js", "service-worker.js"], ["/manifest.json", "manifest.json"]]) {
  const r = await send("GET", HOST, p);
  say("1. " + p + " → " + r.status + " | byte-identical to " + commit + ": " + r.body.equals(committed(file)) + " | " + r.headers["cache-control"] + " | " + r.headers["x-content-type-options"]);
}
say("1. the worker's cache: " + (/const CACHE = "([^"]+)"/.exec((await send("GET", HOST, "/service-worker.js")).body.toString("utf8")) || [])[1]);
const imp = await send("POST", HOST, "/api/import", { "Content-Type": "application/json", "Content-Length": 2 }, "{}");
say("1. POST /api/import with no token → " + imp.status);

// Step 2. Each group's balances, as the page computes them.
const groups = [];
for (let i = 0; i < codes.length; i++) {
  const g = await readGroup(codes[i]);
  groups.push(g);
  say("2. group " + (i + 1) + ": " + (g ? g.people.length + " people, " + g.expenses.length + " expenses, fingerprint " + fingerprint(balancesOf(g)) : "not found"));
}

// Steps 3 and 4 in headless Edge: a fresh profile, new targets never paused (evidence O-2).
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9300 + Math.floor(Math.random() * 400);
spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--lang=en-US",
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(scratch, "profile")}`, "about:blank"], { stdio: "ignore" });
let ver;
for (let i = 0; i < 60 && !ver; i++) { await sleep(200); try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch {} }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map();
const errors = [], dialogs = [];
const cdp = (method, params = {}, sessionId) => {
  const id = nextId++;
  ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  return new Promise((r) => {
    const t = setTimeout(() => { pending.delete(id); r({ timeout: true, result: { result: {} } }); }, 20000);
    pending.set(id, (m) => { clearTimeout(t); r(m); });
  });
};
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Page.javascriptDialogOpening") { dialogs.push(m.params.message); cdp("Page.handleJavaScriptDialog", { accept: true }, m.sessionId); }
});
const { result: { targetId } } = await cdp("Target.createTarget", { url: "about:blank" });
const { result: { sessionId: tab } } = await cdp("Target.attachToTarget", { targetId, flatten: true });
await cdp("Runtime.enable", {}, tab);
await cdp("Page.enable", {}, tab);
const evaluate = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, tab)).result.result.value;
const go = async (url, wait) => { await cdp("Page.navigate", { url }, tab); await sleep(wait || 3000); };
const status = () => evaluate(`(document.getElementById("group-status") || {}).textContent || null`);
async function waitStatus(re, ms){
  const until = Date.now() + ms; let s = "";
  while (Date.now() < until) { s = await status(); if (re.test(s || "")) return s; await sleep(300); }
  return "TIMED OUT at: " + s;
}
const digits = (t) => Number(String(t).replace(/[^\d]/g, ""));

try {
  // Step 3a. Each group with people opens on the new address, live, with the server's balances.
  for (let i = 0; i < codes.length; i++) {
    const g = groups[i];
    if (!g || g.people.length === 0) continue;
    await go(HOME + "?g=" + codes[i], 3000);
    const live = await waitStatus(/^· live$/, 20000);
    const shown = await evaluate(`({
      people: document.querySelectorAll("#people-list .chip").length,
      rows: document.querySelectorAll("#ledger-list .ledger-row").length,
      balances: [...document.querySelectorAll("#balances-list .balance-row")].map(function(r){ return [r.children[0].textContent, r.children[1].textContent]; })
    })`);
    const name = (id) => (g.people.find((p) => p.id === id) || { name: "Removed person" }).name;
    const expected = simplifyDebts(balancesOf(g)).map((t) => [name(t.from) + " owes " + name(t.to), t.amount]);
    const same = shown.balances.length === expected.length && shown.balances.every((b, k) => b[0] === expected[k][0] && digits(b[1]) === expected[k][1]);
    say("3. group " + (i + 1) + ": status " + live + " | people shown " + shown.people + " of " + g.people.length +
      " | ledger rows " + shown.rows + " of " + g.expenses.length + " | balance rows " + shown.balances.length + ", equal to the server's: " + same);
  }

  // Step 3b. A test expense added and deleted, in the empty test group.
  const t = Number(testArg) - 1;
  if (codes[t] && groups[t] && groups[t].people.length === 0 && groups[t].expenses.length === 0) {
    await go(HOME + "?g=" + codes[t], 3000);
    say("3. test group " + (t + 1) + ": opened, " + (await waitStatus(/^· live$/, 20000)));
    await evaluate(`(function(){ document.getElementById("person-name").value = "PC-007 check"; document.getElementById("add-person-form").requestSubmit(); return true; })()`);
    await sleep(1500);
    await evaluate(`(function(){ document.getElementById("exp-desc").value = "PC-007 test"; document.getElementById("exp-amount").value = "1.00";
      document.getElementById("add-expense-form").requestSubmit(); return true; })()`);
    const afterAdd = await waitStatus(/^· live$/, 20000);
    const g1 = await readGroup(codes[t]);
    say("3. test expense added: bar " + afterAdd + " | server: " + g1.people.length + " person, " + g1.expenses.length + " expense of " + (g1.expenses[0] || {}).amountPaise + " paise");
    await evaluate(`(function(){ document.querySelector("#ledger-list .ledger-del").click(); return true; })()`);
    await sleep(1500);
    await evaluate(`(function(){ document.querySelector("#people-list .chip button").click(); return true; })()`);
    const afterDelete = await waitStatus(/^· live$/, 20000);
    const g2 = await readGroup(codes[t]);
    say("3. test expense and person deleted: bar " + afterDelete + " | server: " + g2.people.length + " people, " + g2.expenses.length + " expenses");
  }

  // Step 4. GitHub Pages: wait until it publishes this commit's page, then open an invite link there.
  let published = false;
  for (let i = 0; i < 60 && !published; i++) {
    const r = await send("GET", "revanparimi.github.io", "/SplitFamilia/index.html?nocache=" + Date.now());
    published = r.status === 200 && r.body.equals(committed("index.html"));
    if (!published) await sleep(10000);
  }
  say("4. GitHub Pages serves this commit's index.html: " + published);
  const familyIndex = groups.findIndex((g) => g && g.expenses.length > 0);
  await go(PAGES + "?g=" + codes[familyIndex], 5000);
  const moved = await evaluate(`({
    moved: getComputedStyle(document.getElementById("moved-screen")).display !== "none",
    app: getComputedStyle(document.getElementById("app-shell")).display !== "none",
    text: document.querySelector("#moved-screen .sub").textContent,
    link: document.getElementById("moved-link").href
  })`);
  say("4. " + PAGES + "?g=<group " + (familyIndex + 1) + "> → \"" + moved.text + "\" shown: " + moved.moved + " | app shown: " + moved.app +
    " | the button opens the same group on the new address: " + (moved.link === HOME + "?g=" + codes[familyIndex]));
} finally {
  say("page errors: " + errors.length + " | dialogs: " + dialogs.length);
  await cdp("Browser.close");
  await sleep(1000);
  ws.close();
}
