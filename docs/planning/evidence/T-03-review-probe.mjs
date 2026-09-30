// T-03 review probe (evidence only, not part of the app or of `npm test`). The real page and the
// real Firebase SDK in headless Edge, against the Firestore emulator running the repo's own
// firestore.rules. Run it inside the emulator, from the repo:
//   npx firebase emulators:exec --only firestore --project demo-splitfamilia \
//     "node docs/planning/evidence/T-03-review-probe.mjs <repoDir> <empty scratch dir>"
// Nothing here can reach the family's data: the served page is rewritten to the project
// "demo-splitfamilia" and connected to the emulator (the run stops if either rewrite fails), and
// every firestore.googleapis.com request is blocked and counted (expected: none).
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [repoArg, scratch] = process.argv.slice(2);
const repoDir = path.resolve(repoArg);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const EMU = process.env.FIRESTORE_EMULATOR_HOST;
if (!EMU) throw new Error("run inside `firebase emulators:exec` (FIRESTORE_EMULATOR_HOST is not set)");
const [EMU_HOST, EMU_PORT] = EMU.split(":");
const PROJECT = "demo-splitfamilia";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REAL_FIRESTORE = ["*firestore.googleapis.com*"];
const EMU_BLOCK = [`*${EMU_HOST}:${EMU_PORT}*`];

// ---------- a no-cache server; index.html pointed at the emulator ----------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };
function pageForEmulator(html) {
  const steps = [
    [/apiKey: "[^"]+"/, 'apiKey: "demo-key"'],
    [/projectId: "[^"]+"/, `projectId: "${PROJECT}"`],
    [/getDocFromServer, getDocsFromServer, query, limit\r?\n/, "getDocFromServer, getDocsFromServer, query, limit, connectFirestoreEmulator\n"],
    [/(localCache: persistentLocalCache\(\{ tabManager: persistentMultipleTabManager\(\) \}\)\r?\n\s*\}\);)/,
      `$1 connectFirestoreEmulator(db, "${EMU_HOST}", ${EMU_PORT});`]
  ];
  for (const [re, to] of steps) {
    if (!re.test(html)) throw new Error("rewrite failed: " + re);
    html = html.replace(re, to);
  }
  return html;
}
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  const file = path.join(repoDir, p);
  if (!file.startsWith(repoDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
  let body = fs.readFileSync(file);
  if (p === "/index.html") body = Buffer.from(pageForEmulator(body.toString("utf8")));
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---------- the emulator's stored data, read as the owner (past the rules) ----------
function fromValue(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  return v;
}
async function stored(gid, sub) {
  const r = await fetch(`http://${EMU}/v1/projects/${PROJECT}/databases/(default)/documents/groups/${gid}/${sub}?pageSize=300`,
    { headers: { Authorization: "Bearer owner" } });
  const j = await r.json();
  return (j.documents || []).map((d) => {
    const o = { id: d.name.split("/").pop() };
    for (const [k, v] of Object.entries(d.fields || {})) o[k] = fromValue(v);
    return o;
  });
}

// ---------- CDP (the page and its service worker, flat sessions) ----------
const STATUS_LOG = `(function(){ window.__statusLog = [];
  document.addEventListener("DOMContentLoaded", function(){
    const el = document.getElementById("group-status"); if(!el) return;
    const rec = function(){ const l = window.__statusLog, t = el.textContent;
      if(!l.length || l[l.length - 1].t !== t) l.push({ t: t, ms: Math.round(performance.now()) }); };
    rec(); new MutationObserver(rec).observe(el, { childList: true, characterData: true, subtree: true });
  }); })();`;
let edgePort = null;
async function launch(profile) {
  fs.mkdirSync(profile, { recursive: true });
  const port = 9900 + Math.floor(Math.random() * 400);
  spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--lang=en-IN",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let ver;
  for (let i = 0; i < 60 && !ver; i++) { await sleep(200); try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch {} }
  if (!ver) throw new Error("Edge did not start");
  edgePort = port;
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let nextId = 1;
  const pending = new Map();
  const b = { errors: [], dialogs: [], consoleLines: [], realFirestoreTried: 0, sessions: new Map(), page: null, blocked: REAL_FIRESTORE.slice(), offline: false };
  const send = (method, params = {}, sessionId) => {
    const id = nextId++;
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((r) => pending.set(id, r));
  };
  b.send = send;
  async function setupSession(sessionId, type) {
    b.sessions.set(sessionId, type);
    await send("Network.enable", {}, sessionId);
    await send("Network.setBlockedURLs", { urls: b.blocked }, sessionId);
    if (b.offline) await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
    await send("Runtime.enable", {}, sessionId);
    if (type === "page") {
      await send("Page.enable", {}, sessionId);
      await send("Page.addScriptToEvaluateOnNewDocument", { source: STATUS_LOG }, sessionId);
    }
    await send("Runtime.runIfWaitingForDebugger", {}, sessionId);
  }
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    const sid = msg.sessionId;
    if (msg.method === "Target.attachedToTarget") {
      const { sessionId, targetInfo } = msg.params;
      if (targetInfo.type === "page" || targetInfo.type === "service_worker") setupSession(sessionId, targetInfo.type);
      else send("Runtime.runIfWaitingForDebugger", {}, sessionId);
      return;
    }
    if (msg.method === "Network.requestWillBeSent" && /firestore\.googleapis\.com/.test(msg.params.request.url)) b.realFirestoreTried++;
    if (msg.method === "Page.javascriptDialogOpening") { b.dialogs.push(msg.params.message); send("Page.handleJavaScriptDialog", { accept: true }, sid); }
    if (msg.method === "Runtime.exceptionThrown") b.errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === "Runtime.consoleAPICalled") b.consoleLines.push(msg.params.type + ": " + msg.params.args.map((a) => a.value !== undefined ? String(a.value) : (a.description || "")).join(" "));
  });
  await send("Target.setDiscoverTargets", { discover: true });
  await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  const { result } = await send("Target.createTarget", { url: "about:blank" });
  for (let i = 0; i < 50 && !b.page; i++) { await sleep(100); for (const [sid, type] of b.sessions) if (type === "page") b.page = sid; }
  if (!b.page) {
    const att = await send("Target.attachToTarget", { targetId: result.targetId, flatten: true });
    await setupSession(att.result.sessionId, "page");
    b.page = att.result.sessionId;
  }
  b.eval = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, b.page);
    if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 400));
    return res.result.result.value;
  };
  b.go = async (p, wait = 1500) => { await send("Page.navigate", { url: BASE + p }, b.page); await sleep(wait); };
  b.allSessions = async (method, params) => { for (const sid of b.sessions.keys()) await send(method, params, sid); };
  b.setBlocked = async (urls) => { b.blocked = urls; await b.allSessions("Network.setBlockedURLs", { urls }); };
  b.setOffline = async (offline) => {
    b.offline = offline;
    await b.allSessions("Network.emulateNetworkConditions", { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  };
  b.waitFor = async (expr, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await b.eval(expr)) return Date.now() - t; await sleep(150); } return null; };
  b.close = async () => {
    await send("Browser.close");
    for (let i = 0; i < 50; i++) { await sleep(200); try { await fetch(`http://127.0.0.1:${port}/json/version`); } catch { break; } }
    await sleep(800);
    ws.close();
  };
  return b;
}

const txt = (sel) => `(document.querySelector(${JSON.stringify(sel)})?.innerText || "").replace(/\\s+/g, " ").trim()`;
const SCREEN = `({ status: ${txt("#group-status")}, notice: document.getElementById("notice").hidden ? null : ${txt("#notice-text")},
  people: [...document.querySelectorAll("#people-list .chip span")].map(function(s){ return s.textContent; }),
  ledger: [...document.querySelectorAll("#ledger-list .ledger-row")].map(function(d){ return d.innerText.replace(/\\s+/g, " ").trim(); }),
  balances: [...document.querySelectorAll("#balances-list > div")].map(function(d){ return d.innerText.replace(/\\s+/g, " ").trim(); }) })`;
const STATUS = `document.getElementById("group-status").textContent`;
const LIVE = `${STATUS} === "· live"`;
const IDS = `Object.fromEntries([...document.querySelectorAll("#exp-paidby option")].map(function(o){ return [o.textContent, o.value]; }))`;
const addPerson = (name) => `(function(){ document.getElementById("person-name").value = ${JSON.stringify(name)};
  document.getElementById("add-person-form").requestSubmit(); return true; })()`;
// Adds an expense paid by `payer` (an ID), split among `split` (IDs), through the page's own form.
const addExpense = (desc, amount, payer, split) => `(function(){
  document.getElementById("exp-desc").value = ${JSON.stringify(desc)};
  document.getElementById("exp-amount").value = ${JSON.stringify(amount)};
  document.getElementById("exp-paidby").value = ${JSON.stringify(payer)};
  const want = ${JSON.stringify(split)};
  document.querySelectorAll("#split-boxes input").forEach(function(c){ c.checked = want.indexOf(c.value) !== -1; });
  document.getElementById("add-expense-form").requestSubmit(); return true; })()`;
const deleteRow = (desc) => `(function(){ const row = [...document.querySelectorAll("#ledger-list .ledger-row")]
  .find(function(r){ return r.querySelector(".ledger-desc").textContent === ${JSON.stringify(desc)}; });
  row.querySelector(".ledger-del").click(); return true; })()`;

const out = { emulator: EMU, project: PROJECT };
const b = await launch(path.join(scratch, "prof-review"));
try {
  // E1: online. Start a group, add three people, ₹100.00 split three ways and ₹0.05 split three ways.
  await b.go("/index.html", 2500);
  await b.eval(`(function(){ document.getElementById("new-group-name").value = "Review trip";
    document.getElementById("new-group-form").requestSubmit(); return true; })()`);
  const liveAfterStartMs = await b.waitFor(LIVE, 20000);
  const gid = await b.eval(`localStorage.getItem("splitsheet-group")`);
  for (const n of ["Asha", "Ben", "Chitra"]) { await b.eval(addPerson(n)); await sleep(400); }
  await b.waitFor(`document.querySelectorAll("#people-list .chip").length === 3`, 5000);
  const ids = await b.eval(IDS);
  const all = [ids.Asha, ids.Ben, ids.Chitra];
  await b.eval(addExpense("Dinner", "100", ids.Asha, all)); await sleep(500);
  await b.eval(addExpense("Tea", "0.05", ids.Chitra, all)); await sleep(500);
  const liveAfterWritesMs = await b.waitFor(LIVE, 20000);
  out.E1_online = { gid, ids, liveAfterStartMs, liveAfterWritesMs, screen: await b.eval(SCREEN),
    storedPeople: await stored(gid, "people"), storedExpenses: await stored(gid, "expenses"),
    groupDoc: await (await fetch(`http://${EMU}/v1/projects/${PROJECT}/databases/(default)/documents/groups/${gid}`, { headers: { Authorization: "Bearer owner" } })).json().then((d) => d.fields) };

  // E2: offline (the page, the worker, and the emulator itself blocked). Delete Tea, then add Taxi.
  await b.setOffline(true);
  await b.setBlocked(REAL_FIRESTORE.concat(EMU_BLOCK));
  await sleep(2000);
  const offlineIdle = await b.eval(SCREEN);
  await b.eval(deleteRow("Tea")); await sleep(1200);
  const afterOfflineDelete = await b.eval(SCREEN);
  await b.eval(addExpense("Taxi", "50", ids.Ben, [ids.Ben, ids.Chitra])); await sleep(1200);
  const afterOfflineAdd = await b.eval(SCREEN);
  out.E2_offline = { onLine: await b.eval(`navigator.onLine`), offlineIdle, afterOfflineDelete, afterOfflineAdd,
    storedWhileOffline: (await stored(gid, "expenses")).map((e) => e.desc) };

  // E3: back online. The marks must clear and the bar must reach "live" once the server has both changes.
  await b.setBlocked(REAL_FIRESTORE);
  await b.setOffline(false);
  const liveAgainMs = await b.waitFor(LIVE, 30000);
  out.E3_backOnline = { liveAgainMs, screen: await b.eval(SCREEN), storedExpenses: await stored(gid, "expenses"),
    statusLogSinceFirstOpen: await b.eval(`window.__statusLog`) };

  // E6: the browser says online, but the server can't be reached (the emulator blocked for new
  // requests only). Delete Taxi, watch the bar for 20 s; then add Snacks and watch 5 s more.
  await b.setBlocked(REAL_FIRESTORE.concat(EMU_BLOCK));
  await sleep(1000);
  const e6 = { before: await b.eval(STATUS), afterDelete: [], afterAdd: [] };
  await b.eval(deleteRow("Taxi"));
  for (let t = 0; t < 20000; t += 1000) { await sleep(1000); e6.afterDelete.push(await b.eval(STATUS)); }
  e6.storedDuringDelete = (await stored(gid, "expenses")).map((e) => e.desc);
  e6.ledgerDuringDelete = (await b.eval(SCREEN)).ledger;
  await b.eval(addExpense("Snacks", "10", ids.Asha, [ids.Asha]));
  for (let t = 0; t < 5000; t += 1000) { await sleep(1000); e6.afterAdd.push(await b.eval(STATUS)); }
  await b.setBlocked(REAL_FIRESTORE);
  e6.liveAgainMs = await b.waitFor(LIVE, 60000);
  e6.storedAfter = (await stored(gid, "expenses")).map((e) => e.desc);
  e6.screenAfter = await b.eval(SCREEN);
  out.E6_onlineButUnreachable = e6;

  // E4a: a write the rules refuse, from the real page: a 61-character name with the input's
  // maxlength removed (as an old page without it would send).
  b.consoleLines.length = 0;
  await b.eval(`document.getElementById("person-name").removeAttribute("maxlength"), true`);
  await b.eval(addPerson("x".repeat(61)));
  await b.waitFor(`!document.getElementById("notice").hidden`, 8000);
  await sleep(500);
  out.E4a_nameTooLong = { screen: await b.eval(SCREEN), storedPeople: (await stored(gid, "people")).length,
    console: b.consoleLines.filter((l) => l.startsWith("error")).map((l) => l.slice(0, 200)),
    typedTextInConsole: b.consoleLines.some((l) => l.includes("x".repeat(61))) };
  await b.eval(`document.getElementById("notice-close").click(), true`);
  await b.eval(`document.getElementById("person-name").setAttribute("maxlength", "60"), true`);

  // E4b: the page lets you split among everyone, but the rules take at most 50. 48 more people
  // (51 in all), then one expense split among all 51.
  for (let i = 1; i <= 48; i++) { await b.eval(addPerson("P" + String(i).padStart(2, "0"))); await sleep(60); }
  await b.waitFor(`document.querySelectorAll("#people-list .chip").length === 51`, 15000);
  await b.waitFor(LIVE, 15000);
  const everyone = Object.values(await b.eval(IDS));
  b.consoleLines.length = 0;
  await b.eval(addExpense("Group photo", "51", ids.Asha, everyone));
  await sleep(300);
  const justAfter = await b.eval(SCREEN);
  await b.waitFor(`!document.getElementById("notice").hidden`, 8000);
  await sleep(800);
  const later = await b.eval(SCREEN);
  out.E4b_split51 = { people: everyone.length, splitSize: everyone.length, justAfterLedger: justAfter.ledger.map((r) => r.slice(0, 40)),
    later: { status: later.status, notice: later.notice, ledger: later.ledger.map((r) => r.slice(0, 40)) },
    storedExpenses: (await stored(gid, "expenses")).map((e) => e.desc),
    console: b.consoleLines.filter((l) => l.startsWith("error")).map((l) => l.slice(0, 200)) };

  // E5: a fresh open of the invite link (controlled by the worker): connecting… → live.
  await b.go("/index.html?g=" + gid, 500);
  const liveOnReopenMs = await b.waitFor(LIVE, 20000);
  out.E5_reopen = { liveOnReopenMs, statusLog: await b.eval(`window.__statusLog`),
    controlled: await b.eval(`!!navigator.serviceWorker.controller`),
    cache: await b.eval(`(async function(){ const out = {}; for (const k of await caches.keys()) { const c = await caches.open(k);
      out[k] = (await c.keys()).map(function(r){ const u = new URL(r.url); return (u.origin === location.origin ? "" : u.host) + u.pathname + u.search; }).sort(); } return out; })()`) };

  out.errors = b.errors.slice();
  out.dialogs = b.dialogs.slice();
  out.realFirestoreRequestsTried = b.realFirestoreTried;
} finally {
  await b.close();
  server.close();
}
console.log(JSON.stringify(out, null, 2));
