// T-08 browser check (evidence only, not part of `npm test`): the real, unchanged page served by the
// new Node server (SF-031), in headless Edge over CDP. It checks that the service worker installs
// from this server, caches the app, and starts it with no connection, as it did from Caddy.
//   node T-08-browser-check.mjs <repoDir> <empty scratch dir for the browser profile>
// Nothing here can reach the family's data: no group is opened, and every Firestore host is
// blocked (the run counts any request to one; expected: none). The two Firebase SDK files come
// from gstatic, as on the live site.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repoArg, scratch] = process.argv.slice(2);
const repoDir = path.resolve(repoArg);
const { createApp } = await import(pathToFileURL(path.join(repoDir, "server", "server.js")).href);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BLOCKED = ["*firestore.googleapis.com*", "*firebaseinstallations.googleapis.com*", "*identitytoolkit*", "*securetoken*"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the server under test, with a record of what it answered ----------
fs.mkdirSync(scratch, { recursive: true });
const app = createApp({ root: repoDir, dbFile: path.join(scratch, "check.db"), log: () => {} });
const served = [];
app.server.on("request", (req, res) => {
  res.on("finish", () => served.push(`${req.method} ${req.url} → ${res.statusCode}`));
});
await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${app.server.address().port}`;

// ---------- headless Edge ----------
const port = 9900 + Math.floor(Math.random() * 400);
spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--lang=en-US",
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(scratch, "profile")}`, "about:blank"], { stdio: "ignore" });
let ver;
for (let i = 0; i < 60 && !ver; i++) { await sleep(200); try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch {} }
if (!ver) throw new Error("Edge did not start");
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map();
const sessions = new Map();
const errors = [], firestore = [];
let offline = false;
const send = (method, params = {}, sessionId) => {
  const id = nextId++;
  ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  return new Promise((r) => pending.set(id, r));
};
async function setup(sessionId, type) {
  sessions.set(sessionId, type);
  await send("Network.enable", {}, sessionId);
  await send("Network.setBlockedURLs", { urls: BLOCKED }, sessionId);
  if (offline) await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
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
  if (msg.method === "Network.requestWillBeSent" && /firestore\.googleapis\.com/.test(msg.params.request.url)) firestore.push(msg.params.request.url.slice(0, 60));
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  // Blocking Firestore makes the browser log a failed request; those are expected, not errors.
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error" && !/ERR_BLOCKED_BY_CLIENT|ERR_INTERNET_DISCONNECTED/.test(msg.params.entry.text)) errors.push("log: " + msg.params.entry.text.slice(0, 160));
});
await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
await send("Target.createTarget", { url: "about:blank" });
let page = null;
for (let i = 0; i < 50 && !page; i++) { await sleep(100); for (const [sid, type] of sessions) if (type === "page") page = sid; }
const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, page);
  if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 300));
  return res.result.result.value;
};
const go = async (p, wait = 2000) => { await send("Page.navigate", { url: BASE + p }, page); await sleep(wait); };
const shown = (sel) => `(function(){ const e = document.querySelector(${JSON.stringify(sel)}); if(!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== "none" && !e.hidden && r.width > 0; })()`;
const SCREEN = `({ title: document.title, boot: ${shown("#boot")}, join: ${shown("#join-screen")}, app: ${shown("#app-shell")},
  controlled: Boolean(navigator.serviceWorker.controller) })`;
const CACHES = `(async function(){ const out = {}; for (const k of await caches.keys()) { const c = await caches.open(k);
  out[k] = (await c.keys()).map(function(r){ const u = new URL(r.url); return (u.origin === location.origin ? "" : u.host) + u.pathname + u.search; }).sort(); } return out; })()`;

const out = {};
let serverStopped = false;
try {
  // 1. First visit: the start screen, and the worker installs and caches the app.
  await go("/", 3000);
  out.first = await evaluate(SCREEN);
  for (let i = 0; i < 30; i++) { if (Object.keys(await evaluate(CACHES)).length) break; await sleep(200); }
  await sleep(1500);
  out.caches = await evaluate(CACHES);
  // 2. Second visit: the worker controls the page; the server revalidates with 304s.
  const before = served.length;
  await go("/", 2500);
  out.second = await evaluate(SCREEN);
  out.secondVisitRequests = served.slice(before);
  // 3. No connection at all, and the server stopped: the app still starts, from the worker's copy.
  // (DevTools' offline mode doesn't cover the browser's own check for a new worker, so the server
  // is stopped too: then nothing at all can come from it.)
  await app.close();
  serverStopped = true;
  offline = true;
  for (const sid of sessions.keys()) await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sid);
  await go("/?g=", 2500);
  out.offlineWithServerStopped = await evaluate(SCREEN);
} finally {
  out.firstVisitRequests = served.slice(0, 20);
  out.errors = errors;
  out.firestoreRequests = firestore;
  await send("Browser.close");
  await sleep(1500);
  ws.close();
  if (!serverStopped) await app.close();
}
console.log(JSON.stringify(out, null, 2));
