// T-09 browser check (evidence only, not part of `npm test`): the real page on the real server,
// both local (127.0.0.1, a temporary database), in headless Edge over CDP. SF-035 and SF-036:
// the page works through its own API, live updates, offline changes waiting in the outbox, and
// an offline reopen from the phone's copy. Nothing here reaches any real group or database.
//   node T-09-browser-check.mjs <repoDir> <empty scratch dir>
// Prints one JSON object; the expected values are worked out by hand in the T-09 receipt.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repoArg, scratch] = process.argv.slice(2);
const repoDir = path.resolve(repoArg);
const { createApp } = await import(pathToFileURL(path.join(repoDir, "server", "server.js")).href);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the server under test (restartable on the same port and database) ----------
fs.mkdirSync(scratch, { recursive: true });
const dbFile = path.join(scratch, "check.db");
const served = [];
let app = null;
let serverPort = 0;
async function startServer(){
  app = createApp({ root: repoDir, dbFile, log: () => {} });
  app.server.on("request", (req, res) => res.on("finish", () => served.push(`${req.method} ${req.url} → ${res.statusCode}${/github.io/.test(req.headers.host || "") ? " (as GitHub Pages)" : ""}`)));
  await new Promise((r) => app.server.listen(serverPort, "127.0.0.1", r));
  serverPort = app.server.address().port;
}
async function stopServer(){ if(app){ await app.close(); app = null; } }
await startServer();
const BASE = `http://127.0.0.1:${serverPort}`;

// ---------- headless Edge ----------
const port = 9900 + Math.floor(Math.random() * 400);
// A made-up GitHub Pages name that Edge sends to the local server, for SF-038's "moved" notice.
const PAGES_HOST = "pages-check.github.io";
spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--lang=en-US",
  `--host-resolver-rules=MAP ${PAGES_HOST} 127.0.0.1`,
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(scratch, "profile")}`, "about:blank"], { stdio: "ignore" });
let ver;
for (let i = 0; i < 60 && !ver; i++) { await sleep(200); try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch {} }
if (!ver) throw new Error("Edge did not start");
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map();
const sessions = new Map();
const errors = [], hosts = new Set(), dialogs = [];
let offline = false;
const send = (method, params = {}, sessionId) => {
  const id = nextId++;
  ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  return new Promise((r) => pending.set(id, r));
};
const conditions = () => ({ offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
async function setup(sessionId, type) {
  sessions.set(sessionId, type);
  await send("Network.enable", {}, sessionId);
  if (offline) await send("Network.emulateNetworkConditions", conditions(), sessionId);
  await send("Runtime.enable", {}, sessionId);
  if (type === "page") { await send("Log.enable", {}, sessionId); await send("Page.enable", {}, sessionId); }
  await send("Runtime.runIfWaitingForDebugger", {}, sessionId);
}
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === "Target.attachedToTarget") {
    const { sessionId, targetInfo } = msg.params;
    if (targetInfo.type === "page" || targetInfo.type === "service_worker") setup(sessionId, targetInfo.type);
    else send("Runtime.runIfWaitingForDebugger", {}, sessionId);
    return;
  }
  if (msg.method === "Network.requestWillBeSent") {
    const u = new URL(msg.params.request.url);
    if (u.protocol.startsWith("http") && u.host !== `127.0.0.1:${serverPort}` && u.hostname !== PAGES_HOST) hosts.add(u.host);
  }
  if (msg.method === "Page.javascriptDialogOpening") {
    dialogs.push(msg.params.message);
    send("Page.handleJavaScriptDialog", { accept: true }, msg.sessionId);
  }
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  // Offline and a stopped server make the browser log failed requests; those are expected.
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error"
    && !/ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE|ERR_NETWORK_CHANGED|net::ERR_FAILED|Failed to load resource/.test(msg.params.entry.text)) {
    errors.push("log: " + msg.params.entry.text.slice(0, 160));
  }
});
await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
await send("Target.createTarget", { url: "about:blank" });
let page = null;
for (let i = 0; i < 50 && !page; i++) { await sleep(100); for (const [sid, type] of sessions) if (type === "page") page = sid; }
async function setOffline(value){
  offline = value;
  for (const sid of sessions.keys()) await send("Network.emulateNetworkConditions", conditions(), sid);
}
const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, page);
  if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 300));
  return res.result.result.value;
};
const go = async (p, wait = 2000) => { await send("Page.navigate", { url: BASE + p }, page); await sleep(wait); };
const status = () => evaluate(`document.getElementById("group-status").textContent`);
async function waitStatus(re, ms){
  const until = Date.now() + ms;
  let s = "";
  while (Date.now() < until) { s = await status(); if (re.test(s)) return s; await sleep(200); }
  return "TIMED OUT at: " + s;
}
const shown = (sel) => `(function(){ const e = document.querySelector(${JSON.stringify(sel)}); if(!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== "none" && !e.hidden && r.width > 0; })()`;
const SCREEN = `({ boot: ${shown("#boot")}, join: ${shown("#join-screen")}, app: ${shown("#app-shell")}, controlled: Boolean(navigator.serviceWorker.controller) })`;
const LEDGER = `({
  people: [...document.querySelectorAll("#people-list .chip span")].map(function(e){ return e.textContent; }),
  waitingPeople: document.querySelectorAll("#people-list .chip.waiting").length,
  rows: [...document.querySelectorAll("#ledger-list .ledger-row")].map(function(r){
    return r.querySelector(".ledger-desc").textContent + " " + r.querySelector(".ledger-amt").textContent + (r.querySelector(".ledger-sync") ? " (waiting)" : "");
  }),
  balances: [...document.querySelectorAll("#balances-list .balance-row, #balances-list .settled")].map(function(r){ return r.textContent; }),
  notice: document.getElementById("notice").hidden ? null : document.getElementById("notice-text").textContent
})`;
const CACHES = `(async function(){ const out = {}; for (const k of await caches.keys()) { const c = await caches.open(k);
  out[k] = (await c.keys()).map(function(r){ const u = new URL(r.url); return u.pathname + u.search; }).sort(); } return out; })()`;
// Form actions, as a person would do them.
const addPerson = (name) => evaluate(`(function(){ document.getElementById("person-name").value = ${JSON.stringify(name)};
  document.getElementById("add-person-form").requestSubmit(); return true; })()`);
const addExpense = (desc, amount, payer, split) => evaluate(`(function(){
  const names = function(sel){ return [...document.querySelectorAll(sel)]; };
  document.getElementById("exp-desc").value = ${JSON.stringify(desc)};
  document.getElementById("exp-amount").value = ${JSON.stringify(amount)};
  const sel = document.getElementById("exp-paidby");
  sel.value = [...sel.options].find(function(o){ return o.textContent === ${JSON.stringify(payer)}; }).value;
  names("#split-boxes label").forEach(function(l){ l.querySelector("input").checked = ${JSON.stringify(split)}.includes(l.textContent); });
  document.getElementById("add-expense-form").requestSubmit(); return true; })()`);
const deleteExpense = (desc) => evaluate(`(function(){
  const row = [...document.querySelectorAll("#ledger-list .ledger-row")].find(function(r){ return r.querySelector(".ledger-desc").textContent === ${JSON.stringify(desc)}; });
  row.querySelector(".ledger-del").click(); return true; })()`);
const serverRows = (code) => app.ledger.query(
  "SELECT id, description, amount_paise AS paise, deleted_at IS NOT NULL AS deleted FROM expenses WHERE group_code = ? ORDER BY rowid", [code]);

const out = {};
try {
  // B1. First visit: the start screen; the worker installs and caches the app (v6, no SDK).
  await go("/", 3000);
  out.B1_first = await evaluate(SCREEN);
  for (let i = 0; i < 30; i++) { if (Object.keys(await evaluate(CACHES)).length) break; await sleep(200); }
  await sleep(1500);
  out.B1_caches = await evaluate(CACHES);

  // B2. Start a new group: the page opens it at once, creates it on the server, and goes live.
  await evaluate(`(function(){ document.getElementById("new-group-name").value = "Goa trip"; document.getElementById("new-group-form").requestSubmit(); return true; })()`);
  await sleep(300);
  const code = await evaluate(`new URL(location.href).searchParams.get("g")`);
  out.B2_start = { codeShape: /^goa-trip-[a-z2-9]{10}$/.test(code), status: await waitStatus(/^· live$/, 8000),
    serverGroup: app.ledger.readGroup(code) && { currency: app.ledger.readGroup(code).currency, version: app.ledger.readGroup(code).version } };

  // B3. E1: Asha, Ben, Chitra; ₹100.00 by Asha split three ways, then ₹0.05 by Ben split three ways.
  for (const n of ["Asha", "Ben", "Chitra"]) { await addPerson(n); await sleep(250); }
  await addExpense("Hotel", "100.00", "Asha", ["Asha", "Ben", "Chitra"]);
  await sleep(400);
  await addExpense("Chai", "0.05", "Ben", ["Asha", "Ben", "Chitra"]);
  out.B3_E1 = { status: await waitStatus(/^· live$/, 8000) };
  await sleep(500);
  Object.assign(out.B3_E1, await evaluate(LEDGER), { server: serverRows(code),
    // Who gets a leftover paisa: the first IDs in code-unit order (money.js splitShares).
    namesInIdOrder: app.ledger.readGroup(code).people.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map((p) => p.name) });

  // B4. E2/E3: offline, delete "Chai" and add "Taxi" ₹250.00 by Ben split Asha and Ben.
  await setOffline(true);
  await sleep(500);
  await deleteExpense("Chai");
  await sleep(200);
  await addExpense("Taxi", "250.00", "Ben", ["Asha", "Ben"]);
  await sleep(1500);
  out.B4_offline = Object.assign({ status: await status() }, await evaluate(LEDGER), { serverBefore: serverRows(code) });
  await setOffline(false);
  out.B4_online = { status: await waitStatus(/^· live$/, 20000) };
  await sleep(500);
  Object.assign(out.B4_online, await evaluate(LEDGER), { server: serverRows(code) });

  // B5. E6: online, but the server can't be reached: never "live" while a change waits.
  await stopServer();
  await sleep(1500);
  await addPerson("Dev");
  const seen = new Set();
  for (let i = 0; i < 25; i++) { seen.add(await status()); await sleep(200); }
  out.B5_unreachable = { statusesSeen: [...seen], ledger: await evaluate(LEDGER) };
  await startServer();
  out.B5_back = { status: await waitStatus(/^· live$/, 70000) };
  await sleep(300);
  Object.assign(out.B5_back, { people: (await evaluate(LEDGER)).people, serverPeople: app.ledger.readGroup(code).people.map((p) => p.name) });

  // B6. Reopen with no connection and the server stopped: the group comes from the phone's copy.
  await stopServer();
  await setOffline(true);
  await go("/?g=" + code, 3000);
  out.B6_offlineReopen = Object.assign({ screen: await evaluate(SCREEN), status: await status() }, await evaluate(LEDGER));
  await setOffline(false);
  await startServer();
  await go("/?g=" + code, 3000);
  out.B6_backOnline = { status: await waitStatus(/^· live$/, 20000) };

  // B7. Join: a fresh start screen; an unknown code, then the group's own code.
  await evaluate(`(function(){ localStorage.removeItem("splitsheet-group"); return true; })()`);
  await go("/", 2000);
  await evaluate(`(function(){ document.getElementById("join-code").value = "no-such-trip"; document.getElementById("join-form").requestSubmit(); return true; })()`);
  await sleep(1500);
  const unknown = await evaluate(`document.getElementById("join-error").textContent`);
  await evaluate(`(function(){ document.getElementById("join-code").value = ${JSON.stringify(BASE + "/?g=" + code)}; document.getElementById("join-form").requestSubmit(); return true; })()`);
  out.B7_join = { unknown, status: await waitStatus(/^· live$/, 8000), people: (await evaluate(LEDGER)).people };

  // B8. SF-038: the same page on a GitHub Pages address shows only "moved", with a link to the
  // same group on the Railway address, and asks its own server for nothing but the page.
  const before = served.length;
  await send("Page.navigate", { url: `http://${PAGES_HOST}:${serverPort}/?g=${code}` }, page);
  await sleep(2500);
  out.B8_moved = await evaluate(`({ moved: ${shown("#moved-screen")}, join: ${shown("#join-screen")}, app: ${shown("#app-shell")},
    link: document.getElementById("moved-link").href, text: document.querySelector("#moved-screen .sub").textContent })`);
  out.B8_moved.linkKeepsGroup = out.B8_moved.link === "https://splitfamilia.up.railway.app/?g=" + code;
  out.B8_moved.requests = served.slice(before).filter((r) => r.includes("GitHub Pages")).map((r) => r.replace(code, "<code>"));
} finally {
  out.dialogs = dialogs;
  out.errors = errors;
  out.otherHosts = [...hosts].sort();
  out.requestsWithCodeInUrl = served.filter((s) => /\?g=/.test(s));
  out.apiRequestsSample = served.filter((s) => s.includes("/api/")).slice(0, 8);
  await send("Browser.close");
  await sleep(1500);
  ws.close();
  await stopServer();
}
console.log(JSON.stringify(out, null, 2));
