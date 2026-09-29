// T-02 review probe (the reviewer's own browser checks; evidence only, not part of the app or of
// `npm test`). P1 traces hostile data to the screen, P2 bad links with a saved group, P3 the race
// between "Join" and "Start a new group" (finding F-3), P4 the service-worker upgrade from
// production (8898b50, cache v2) to v4 on a no-cache server, including with the server down.
// Firebase CDN modules are fakes and Firestore hosts are blocked: nothing is read or written.
//   1. git archive 8898b50 | tar -x -C <baselineDir>
//   2. node T-02-review-probe.mjs <repoDir> <baselineDir> <empty scratch dir for browser profiles>
// It serves both folders itself (an in-process server whose root switches at "deploy").
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [repoDir, baseDir, scratch] = process.argv.slice(2);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- switchable no-cache static server ----------
let root = repoDir;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let p = decodeURIComponent(u.pathname);
  if (p === "/") p = "/index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---------- fake Firebase ----------
const FAKE_APP = `export function initializeApp(){ return {}; }`;
const FAKE_FS = `
const ODD = { groupDoc: true,
  people: [["a","Asha"],["B","Ben"],["c","Chitra"]],
  expenses: [
    ["e1", { date: "2026-09-28T06:30:00.000Z", desc: "Hotel", amount: 100.01, paidBy: "a", split: ["c","B","a","gone"] }],
    ["e2", { date: "2026-09-28T06:31:00.000Z", desc: "Toffee", amount: 0.05, paidBy: "B", split: ["a","c"] }],
    ["e3", { date: "2026-09-28T06:32:00.000Z", desc: "Chai", amount: 7, paidBy: "gone", split: ["B","c","a"] }],
    ["e6", { date: "2026-09-28T06:35:00.000Z", desc: "Own ticket", amount: 25, paidBy: "B", split: ["B"] }]
  ] };
const BAD = [
    ["e4", { date: "2026-09-28T06:33:00.000Z", desc: "String amount", amount: "12", paidBy: "a", split: ["a","B"] }],
    ["e5", { date: "2026-09-28T06:34:00.000Z", desc: "Negative", amount: -5, paidBy: "a", split: ["a"] }]
];
function fixture(gid){
  if(gid === "rv-odd") return { groupDoc: true, people: ODD.people, expenses: ODD.expenses.concat(BAD) };
  if(gid && gid.indexOf("rv-") === 0) return ODD;
  return null;
}
const W = (globalThis.__writes = globalThis.__writes || []);
const S = (globalThis.__subs = globalThis.__subs || []);
export function initializeFirestore(){ return {}; }
export function persistentLocalCache(){ return {}; }
export function persistentMultipleTabManager(){ return {}; }
export function collection(db, ...p){ return { path: p }; }
export function doc(a, ...p){ return { path: a.path ? a.path.concat(p) : p }; }
export function query(ref){ return ref; }
export function limit(){ return null; }
function record(op){
  return function(ref, data, opts){ W.push({ op: op, path: ref.path.join("/"), data: data === undefined ? null : data }); return Promise.resolve({ id: "new" }); };
}
export const addDoc = record("add"), updateDoc = record("update"), deleteDoc = record("delete"), setDoc = record("set");
function delay(){ return new Promise(function(r){ setTimeout(r, globalThis.__rvDelay || 0); }); }
export function getDocFromServer(ref){
  return delay().then(function(){ const fx = fixture(ref.path[1]); return { exists: function(){ return !!(fx && fx.groupDoc); } }; });
}
export function getDocsFromServer(ref){
  return delay().then(function(){ const fx = fixture(ref.path[1]); return { empty: !fx || fx[ref.path[2]].length === 0 }; });
}
export function onSnapshot(ref, next){
  S.push(ref.path.join("/"));
  const [, gid, sub] = ref.path;
  const fx = fixture(gid) || { people: [], expenses: [] };
  setTimeout(function(){
    if(!sub) next({ data: function(){ return { currency: "₹" }; } });
    else {
      const rows = sub === "people" ? fx.people.map(function(r){ return [r[0], { name: r[1] }]; }) : fx.expenses;
      next({ docs: rows.map(function(r){ return { id: r[0], data: function(){ return r[1]; } }; }) });
    }
  }, 0);
  return function(){};
}`;

// ---------- CDP ----------
async function launch(profile) {
  fs.mkdirSync(profile, { recursive: true });
  const port = 9900 + Math.floor(Math.random() * 400);
  spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--lang=en-US",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
  }
  if (!target) throw new Error("Edge did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let nextId = 1;
  const pending = new Map();
  const b = { errors: [], dialogs: [], port, ws };
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === "Fetch.requestPaused") {
      const url = msg.params.request.url;
      const body = url.includes("firebase-app.js") ? FAKE_APP : url.includes("firebase-firestore.js") ? FAKE_FS : null;
      if (body === null) { b.send("Fetch.continueRequest", { requestId: msg.params.requestId }); return; }
      b.send("Fetch.fulfillRequest", { requestId: msg.params.requestId, responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "text/javascript" }, { name: "Access-Control-Allow-Origin", value: "*" }],
        body: Buffer.from(body).toString("base64") });
    }
    if (msg.method === "Page.javascriptDialogOpening") { b.dialogs.push(msg.params.message); b.send("Page.handleJavaScriptDialog", { accept: true }); }
    if (msg.method === "Runtime.exceptionThrown") b.errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") b.errors.push(msg.params.entry.text + " " + (msg.params.entry.url || ""));
  });
  b.send = (method, params = {}) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => pending.set(id, r)); };
  b.eval = async (expression) => {
    const res = await b.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 400));
    return res.result.result.value;
  };
  b.go = async (p, wait = 1200) => { await b.send("Page.navigate", { url: BASE + p }); await sleep(wait); };
  await b.send("Network.enable");
  await b.send("Network.setBlockedURLs", { urls: ["*firestore.googleapis.com*", "*firebaseinstallations.googleapis.com*", "*identitytoolkit*"] });
  await b.send("Runtime.enable"); await b.send("Log.enable"); await b.send("Page.enable");
  await b.send("Fetch.enable", { patterns: [{ urlPattern: "*gstatic.com/firebasejs/*" }] });
  b.close = async () => {
    const bw = new WebSocket((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl);
    await new Promise((r) => bw.addEventListener("open", r, { once: true }));
    bw.send(JSON.stringify({ id: 1, method: "Browser.close" }));
    for (let i = 0; i < 50; i++) { await sleep(200); try { await fetch(`http://127.0.0.1:${port}/json/version`); } catch { break; } }
    await sleep(1000);
    ws.close();
  };
  return b;
}
const txt = (sel) => `(document.querySelector(${JSON.stringify(sel)})?.innerText || "").replace(/\\s+/g, " ").trim()`;
const shown = (sel) => `(function(){ const e = document.querySelector(${JSON.stringify(sel)}); return !!e && getComputedStyle(e).display !== "none"; })()`;
const SCREEN = `({ join: ${shown("#join-screen")}, app: ${shown("#app-shell")}, alert: ${txt("#join-alert")}, joinError: ${txt("#join-error")},
  group: ${txt("#group-name")}, url: location.search, saved: localStorage.getItem("splitsheet-group"), subs: (globalThis.__subs || []).slice() })`;
const LEDGER = `({ ledger: [...document.querySelectorAll("#ledger-list .ledger-row")].map(function(d){ return d.innerText.replace(/\\s+/g, " ").trim(); }),
  balances: [...document.querySelectorAll("#balances-list > div")].map(function(d){ return d.innerText.replace(/\\s+/g, " ").trim(); }) })`;
const CACHES = `(async function(){ const out = {}; for (const k of await caches.keys()) { const c = await caches.open(k);
  out[k] = [...new Set((await c.keys()).map(function(r){ const u = new URL(r.url); return u.pathname + (u.pathname.endsWith(".js") ? u.search : ""); }))].sort(); } return out; })()`;
const CTRL = `(navigator.serviceWorker.controller ? "controlled" : "not controlled")`;

const out = {};

// ---------- P1-P3 on the reviewed files ----------
{
  root = repoDir;
  const b = await launch(path.join(scratch, "prof-rv-a"));
  // P1: hostile data trace to the screen.
  await b.go("/index.html?g=rv-odd");
  out.P1_oddSplitRemovedPerson = await b.eval(LEDGER);

  // P2: bad links while a valid group is saved; then a plain open.
  const p2 = {};
  for (const q of ["goa/trip", "", "a--b", "%2E%2E", "__x__", "x-", "a".repeat(81), "Goa-trip"]) {
    await b.eval(`localStorage.setItem("splitsheet-group", "rv-odd"), true`);
    await b.go("/index.html?g=" + q, 800);
    const s = await b.eval(SCREEN);
    p2[q.length > 20 ? "81 chars" : JSON.stringify(q)] = { join: s.join, alert: s.alert, saved: s.saved, subs: s.subs };
  }
  await b.go("/index.html", 800);
  p2.plainOpenAfter = await b.eval(SCREEN);
  await b.eval(`localStorage.setItem("splitsheet-group", "Goa Trip"), true`);
  await b.go("/index.html", 800);
  p2.savedInvalidNoLink = await b.eval(SCREEN);
  await b.eval(`localStorage.setItem("splitsheet-group", "bad/one"), true`);
  await b.go("/index.html?g=goa/trip", 800);
  p2.savedInvalidAndBadLink = await b.eval(SCREEN);
  out.P2_links = p2;

  // P3: start a new group while a "Join" check is still waiting for the server.
  await b.eval(`localStorage.clear(), true`);
  await b.go("/index.html", 800);
  await b.eval(`(function(){ globalThis.__rvDelay = 2000;
    document.getElementById("join-code").value = "rv-odd"; document.getElementById("join-btn").click();
    return true; })()`);
  await sleep(200);
  const midway = await b.eval(`({ btn: document.getElementById("join-btn").textContent, disabled: document.getElementById("join-btn").disabled,
    startDisabled: document.querySelector("#new-group-form button").disabled })`);
  await b.eval(`(function(){ document.getElementById("new-group-name").value = "Race trip"; document.querySelector("#new-group-form button").click(); return true; })()`);
  await sleep(300);
  const afterStart = await b.eval(SCREEN);
  await sleep(2500);
  const afterCheck = await b.eval(SCREEN);
  const beforeWrites = await b.eval(`(globalThis.__writes || []).length`);
  await b.eval(`(function(){ document.getElementById("person-name").value = "Dev"; document.getElementById("add-person-form").requestSubmit(); return true; })()`);
  await sleep(300);
  await b.eval(`(function(){ document.getElementById("exp-desc").value = "Race check"; document.getElementById("exp-amount").value = "10";
    document.getElementById("add-expense-form").requestSubmit(); return true; })()`);
  await sleep(500);
  const writes = await b.eval(`(globalThis.__writes || []).slice(${beforeWrites})`);
  out.P3_race = { midway, afterStart, afterCheck, writesAfterOneAddPersonAndOneAddExpense: writes, dialogs: b.dialogs.slice() };
  out.errorsA = b.errors.slice();
  await b.close();
}

// ---------- P4: service-worker upgrade from production (8898b50, v2) to v4 ----------
{
  root = baseDir;
  const b = await launch(path.join(scratch, "prof-rv-b"));
  await b.go("/index.html?g=rv-up", 2500);
  await b.go("/index.html?g=rv-up", 1500); // now controlled by the v2 worker
  const p4 = { v2: { ctrl: await b.eval(CTRL), caches: await b.eval(CACHES), screen: await b.eval(LEDGER) } };
  root = repoDir; // deploy
  await b.go("/index.html?g=rv-up", 3000);
  p4.firstOpenAfterDeploy = { ctrl: await b.eval(CTRL), screen: await b.eval(LEDGER), errors: b.errors.slice() };
  await b.go("/index.html?g=rv-up", 1500);
  p4.secondOpen = { ctrl: await b.eval(CTRL), caches: await b.eval(CACHES), screen: await b.eval(LEDGER),
    swScript: await b.eval(`navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL`) };
  // Site unreachable: the start URL must still open from the v4 cache.
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await b.go("/index.html", 1500);
  p4.serverDown = { screen: await b.eval(LEDGER), group: await b.eval(txt("#group-name")),
    fetchFails: await b.eval(`fetch("/manifest.json?nocache=" + Date.now()).then(function(){ return false; }, function(){ return true; })`) };
  p4.errors = b.errors.slice();
  out.P4_upgrade_revisited = p4;
  await b.close();
  await new Promise((r) => server.listen(new URL(BASE).port, "127.0.0.1", r));
}
{
  // P4b: right after the deploy, the v2 worker is asked for an invite link it never cached.
  root = baseDir;
  const b = await launch(path.join(scratch, "prof-rv-c"));
  await b.go("/index.html?g=rv-one", 2500);
  await b.go("/index.html?g=rv-one", 1500);
  const before = { ctrl: await b.eval(CTRL), caches: await b.eval(CACHES) };
  root = repoDir;
  await b.go("/index.html?g=rv-two", 3000);
  const first = { ctrl: await b.eval(CTRL), screen: await b.eval(LEDGER) };
  await b.go("/index.html?g=rv-two", 1500);
  out.P4b_uncachedLinkAfterDeploy = { before, first, second: { screen: await b.eval(LEDGER), caches: await b.eval(CACHES) }, errors: b.errors.slice() };
  await b.close();
}
server.close();
console.log(JSON.stringify(out, null, 2));
