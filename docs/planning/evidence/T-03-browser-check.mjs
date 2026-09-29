// T-03 browser check (evidence only, not part of the app or of `npm test`). Headless Edge over
// CDP, with the page and its service worker both attached, against an in-process no-cache server.
//   node T-03-browser-check.mjs <repoDir> <empty scratch dir for browser profiles>
// Nothing here can reach the family's data:
// - Run F uses fake Firebase modules (served for the page and for the service worker).
// - Run R uses the real Firebase SDK from gstatic, but the server rewrites the page's project to
//   "demo-t03-probe" and every Firestore host is blocked and failed, so writes stay queued in
//   the browser; the run reports any request that reached a Firestore host (expected: none).
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const [repoArg, scratch] = process.argv.slice(2);
const repoDir = path.resolve(repoArg);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIRESTORE_HOSTS = ["*firestore.googleapis.com*", "*firebaseinstallations.googleapis.com*", "*identitytoolkit*", "*securetoken*"];

// ---------- no-cache static server (the Caddyfile's headers) ----------
let rewriteProject = false;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let p = decodeURIComponent(u.pathname);
  if (p === "/") p = "/index.html";
  const file = path.join(repoDir, p);
  if (!file.startsWith(repoDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
  let body = fs.readFileSync(file);
  if (rewriteProject && p === "/index.html") {
    body = Buffer.from(body.toString("utf8")
      .replace(/apiKey: "[^"]+"/, 'apiKey: "demo-key"')
      .replace(/projectId: "[^"]+"/, 'projectId: "demo-t03-probe"'));
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
  res.end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;

// ---------- fake Firebase (run F) ----------
const FAKE_APP = `export function initializeApp(){ return {}; }`;
const FAKE_FS = `
const W = (globalThis.__writes = globalThis.__writes || []);
const S = (globalThis.__subs = globalThis.__subs || []);
const ODD = { people: [["a","Asha"],["b","Ben"]],
  expenses: [["e1", { date: "2026-09-28T06:30:00.000Z", desc: "Hotel", amount: 300, paidBy: "a", split: ["a","b"] }]] };
function fixture(gid){
  if(gid === "rv-denied") return "denied";
  if(gid && gid.indexOf("rv-") === 0) return ODD;
  return null;
}
export function initializeFirestore(){ return {}; }
export function persistentLocalCache(){ return {}; }
export function persistentMultipleTabManager(){ return {}; }
export function collection(db, ...p){ return { path: p }; }
export function doc(a, ...p){ return { path: a.path ? a.path.concat(p) : p }; }
export function query(ref){ return ref; }
export function limit(){ return null; }
function write(op){
  return function(ref, data){
    W.push({ op: op, path: ref.path.join("/"), data: data === undefined ? null : data });
    if(ref.path[1] === "rv-readonly") return Promise.reject({ code: "permission-denied", message: "Missing or insufficient permissions. rv-readonly" });
    return Promise.resolve({ id: "new" });
  };
}
export const addDoc = write("add"), deleteDoc = write("delete"), setDoc = write("set");
function delay(){ return new Promise(function(r){ setTimeout(r, globalThis.__rvDelay || 0); }); }
export function getDocFromServer(ref){
  return delay().then(function(){ const fx = fixture(ref.path[1]); return { exists: function(){ return !!fx; } }; });
}
export function getDocsFromServer(ref){
  return delay().then(function(){ const fx = fixture(ref.path[1]); return { empty: !fx || fx === "denied" || fx[ref.path[2]].length === 0 }; });
}
export function onSnapshot(ref, opts, next, error){
  S.push(ref.path.join("/"));
  const [, gid, sub] = ref.path;
  const fx = fixture(gid);
  setTimeout(function(){
    if(fx === "denied"){ error({ code: "permission-denied", message: "Missing or insufficient permissions. groups/" + gid }); return; }
    const f = fx || { people: [], expenses: [] };
    const meta = { fromCache: false, hasPendingWrites: false };
    if(!sub) next({ metadata: meta, data: function(){ return { currency: "₹" }; }, exists: function(){ return true; } });
    else {
      const rows = sub === "people" ? f.people.map(function(r){ return [r[0], { name: r[1] }]; }) : f.expenses;
      next({ metadata: meta, docs: rows.map(function(r){ return { id: r[0], data: function(){ return r[1]; }, metadata: { hasPendingWrites: false } }; }) });
    }
  }, 0);
  return function(){};
}`;

// Every browser started, so a failed step can still close them all.
const launched = [];

// ---------- CDP: one browser connection, flat sessions for the page and its service worker ----------
async function launch(profile, opts) {
  fs.mkdirSync(profile, { recursive: true });
  const port = 9900 + Math.floor(Math.random() * 400);
  spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--lang=en-US",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let ver;
  for (let i = 0; i < 60 && !ver; i++) {
    await sleep(200);
    try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch {}
  }
  if (!ver) throw new Error("Edge did not start");
  launched.push(port);
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let nextId = 1;
  const pending = new Map();
  const b = { errors: [], dialogs: [], consoleLines: [], firestoreHits: [], firestoreBlocked: 0, sessions: new Map(), page: null,
    blocked: FIRESTORE_HOSTS.slice(), offline: false, holdSdk: false, held: [] };
  b.releaseSdk = () => { b.holdSdk = false; b.held.splice(0).forEach((f) => f()); };
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
    const patterns = [{ urlPattern: "*firestore.googleapis.com*" }];
    if (opts.fakes) patterns.push({ urlPattern: "*gstatic.com/firebasejs/*" });
    await send("Fetch.enable", { patterns }, sessionId);
    await send("Runtime.enable", {}, sessionId);
    if (type === "page") { await send("Log.enable", {}, sessionId); await send("Page.enable", {}, sessionId); }
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
    if (msg.method === "Fetch.requestPaused") {
      const url = msg.params.request.url;
      if (/firestore\.googleapis\.com/.test(url)) { b.firestoreHits.push("paused " + url.slice(0, 60)); send("Fetch.failRequest", { requestId: msg.params.requestId, errorReason: "BlockedByClient" }, sid); return; }
      const body = url.includes("firebase-app.js") ? FAKE_APP : url.includes("firebase-firestore.js") ? FAKE_FS : null;
      if (body === null) { send("Fetch.continueRequest", { requestId: msg.params.requestId }, sid); return; }
      const fulfill = () => send("Fetch.fulfillRequest", { requestId: msg.params.requestId, responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "text/javascript" }, { name: "Access-Control-Allow-Origin", value: "*" }],
        body: Buffer.from(body).toString("base64") }, sid);
      if (b.holdSdk && body === FAKE_FS) b.held.push(fulfill); else fulfill();
      return;
    }
    if (msg.method === "Network.responseReceived" && /firestore\.googleapis\.com/.test(msg.params.response.url)) b.firestoreHits.push("response " + msg.params.response.url.slice(0, 60));
    if (msg.method === "Network.requestWillBeSent" && /firestore\.googleapis\.com/.test(msg.params.request.url)) b.firestoreBlocked++;
    if (msg.method === "Page.javascriptDialogOpening") { b.dialogs.push(msg.params.message); send("Page.handleJavaScriptDialog", { accept: true }, sid); }
    if (msg.method === "Runtime.exceptionThrown") b.errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === "Runtime.consoleAPICalled") b.consoleLines.push(msg.params.type + ": " + msg.params.args.map((a) => a.value !== undefined ? String(a.value) : (a.description || "")).join(" "));
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") b.errors.push("log: " + msg.params.entry.text.slice(0, 160));
  });
  await send("Target.setDiscoverTargets", { discover: true });
  await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  const { result } = await send("Target.createTarget", { url: "about:blank" });
  for (let i = 0; i < 50 && !b.page; i++) {
    await sleep(100);
    for (const [sid, type] of b.sessions) if (type === "page") b.page = sid;
  }
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
  b.go = async (p, wait = 1500, extra = {}) => { await send("Page.navigate", Object.assign({ url: BASE + p }, extra), b.page); await sleep(wait); };
  b.allSessions = async (method, params) => { for (const sid of b.sessions.keys()) await send(method, params, sid); };
  b.setBlocked = async (urls) => { b.blocked = urls; await b.allSessions("Network.setBlockedURLs", { urls }); };
  b.setOffline = async (offline) => {
    b.offline = offline;
    await b.allSessions("Network.emulateNetworkConditions", { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  };
  b.close = async () => {
    await send("Browser.close");
    for (let i = 0; i < 50; i++) { await sleep(200); try { await fetch(`http://127.0.0.1:${port}/json/version`); } catch { break; } }
    await sleep(800);
    ws.close();
  };
  return b;
}

const txt = (sel) => `(document.querySelector(${JSON.stringify(sel)})?.innerText || "").replace(/\\s+/g, " ").trim()`;
const shown = (sel) => `(function(){ const e = document.querySelector(${JSON.stringify(sel)}); if(!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== "none" && !e.hidden && r.width > 0; })()`;
const SCREEN = `({ boot: ${shown("#boot")}, bootText: ${txt("#boot")}, join: ${shown("#join-screen")}, app: ${shown("#app-shell")},
  group: ${txt("#group-name")}, status: ${txt("#group-status")}, notice: ${shown("#notice")} ? ${txt("#notice-text")} : null,
  saved: localStorage.getItem("splitsheet-group"), subs: (globalThis.__subs || []).slice() })`;
const LEDGER = `({ people: [...document.querySelectorAll("#people-list .chip span")].map(function(s){ return s.textContent; }),
  ledger: [...document.querySelectorAll("#ledger-list .ledger-row")].map(function(d){ return d.innerText.replace(/\\s+/g, " ").trim(); }),
  balances: [...document.querySelectorAll("#balances-list > div")].map(function(d){ return d.innerText.replace(/\\s+/g, " ").trim(); }) })`;
const WEB_BITS = `({ inApp: document.documentElement.classList.contains("in-app"), referrer: document.referrer,
  iosTip: ${shown("#ios-tip")}, installBtn: ${shown("#install-btn")}, joinNote: ${txt(".join-note")}, footer: ${txt("footer")} })`;
const CACHES = `(async function(){ const out = {}; for (const k of await caches.keys()) { const c = await caches.open(k);
  out[k] = (await c.keys()).map(function(r){ const u = new URL(r.url); return (u.origin === location.origin ? "" : u.host) + u.pathname + u.search; }).sort(); } return out; })()`;
const CTRL = `(navigator.serviceWorker.controller ? "controlled" : "not controlled")`;
const submit = (form, fields) => `(function(){ ${Object.entries(fields).map(([id, v]) => `document.getElementById(${JSON.stringify(id)}).value = ${JSON.stringify(v)};`).join(" ")}
  document.getElementById(${JSON.stringify(form)}).requestSubmit(); return true; })()`;

const out = {};
process.on("uncaughtException", async (e) => {
  console.error(e);
  for (const port of launched) {
    try {
      const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      const ws = new WebSocket(ver.webSocketDebuggerUrl);
      await new Promise((r) => ws.addEventListener("open", r, { once: true }));
      ws.send(JSON.stringify({ id: 1, method: "Browser.close" }));
    } catch {}
  }
  await sleep(1500);
  process.exit(1);
});

// ---------- Run F: fake Firebase ----------
{
  const b = await launch(path.join(scratch, "prof-f"), { fakes: true });

  // F1 (F-3, as in the T-02 review's P3): "Start group" while a "Join" check is waiting.
  await b.go("/index.html", 1200);
  out.F0_firstOpen = await b.eval(SCREEN);
  await b.eval(`(function(){ globalThis.__rvDelay = 2000; document.getElementById("join-code").value = "rv-odd";
    document.getElementById("join-btn").click(); return true; })()`);
  await sleep(200);
  const midway = await b.eval(`({ btn: document.getElementById("join-btn").textContent, joinDisabled: document.getElementById("join-btn").disabled,
    startDisabled: document.querySelector("#new-group-form button").disabled })`);
  await b.eval(`(function(){ document.getElementById("new-group-name").value = "Race trip"; document.querySelector("#new-group-form button").click(); return true; })()`);
  await sleep(300);
  const afterStartClick = await b.eval(SCREEN);
  await sleep(2500);
  const afterCheck = await b.eval(SCREEN);
  let before = await b.eval(`(globalThis.__writes || []).length`);
  await b.eval(submit("add-person-form", { "person-name": "Dev" }));
  await sleep(300);
  await b.eval(submit("add-expense-form", { "exp-desc": "Race check", "exp-amount": "10" }));
  await sleep(400);
  out.F1_race_buttonClick = { midway, afterStartClick, afterCheck, writes: await b.eval(`(globalThis.__writes || []).slice(${before})`) };

  // F2 (F-3, forced): the new-group form is submitted anyway (requestSubmit ignores the disabled
  // button), so the guard in openGroup() itself must hold.
  await b.eval(`localStorage.clear(), true`);
  await b.go("/index.html", 1200);
  await b.eval(`(function(){ globalThis.__rvDelay = 2000; document.getElementById("join-code").value = "rv-odd";
    document.getElementById("join-btn").click(); return true; })()`);
  await sleep(200);
  await b.eval(submit("new-group-form", { "new-group-name": "Race trip" }));
  await sleep(300);
  const forcedStart = await b.eval(SCREEN);
  await sleep(2500);
  const forcedAfterCheck = await b.eval(SCREEN);
  before = await b.eval(`(globalThis.__writes || []).length`);
  await b.eval(submit("add-person-form", { "person-name": "Dev" }));
  await sleep(300);
  out.F2_race_forced = { forcedStart, forcedAfterCheck, writes: await b.eval(`(globalThis.__writes || []).slice(${before})`) };

  // F3: a listener refused by the rules shows the plain message; the raw one appears nowhere.
  b.consoleLines.length = 0;
  await b.go("/index.html?g=rv-denied", 1200);
  out.F3_permissionDenied = { screen: await b.eval(SCREEN), rawOnPage: await b.eval(`document.body.innerText.includes("Missing")`),
    console: b.consoleLines.slice() };

  // F4: a write refused by the server; the typed name is never logged.
  b.consoleLines.length = 0;
  await b.go("/index.html?g=rv-readonly", 1200);
  await b.eval(submit("add-person-form", { "person-name": "Secret Name" }));
  await sleep(400);
  out.F4_writeRefused = { screen: await b.eval(SCREEN), console: b.consoleLines.slice(), dialogs: b.dialogs.slice() };

  // F5: unexpected errors → one friendly message; the error's text is never logged.
  b.consoleLines.length = 0;
  await b.go("/index.html?g=rv-odd", 1200);
  const cleanBefore = await b.eval(SCREEN);
  await b.eval(`(function(){ setTimeout(function(){ throw new Error("secret-text-1"); }, 0);
    Promise.reject(new Error("secret-text-2")); return true; })()`);
  await sleep(400);
  out.F5_unexpected = { cleanBefore, after: await b.eval(SCREEN), console: b.consoleLines.slice() };

  // F6: a normal browser tab shows the install button (once the browser offers it) and the iPhone tip.
  await b.go("/index.html?g=rv-odd", 1200);
  await b.eval(`(function(){ const e = new Event("beforeinstallprompt", { cancelable: true }); e.prompt = function(){};
    e.userChoice = Promise.resolve({ outcome: "dismissed" }); window.dispatchEvent(e); return true; })()`);
  await sleep(200);
  const tabApp = await b.eval(WEB_BITS);
  await b.eval(`localStorage.clear(), true`);
  await b.go("/index.html", 1000);
  out.F6_browserTab = { app: tabApp, join: await b.eval(WEB_BITS) };

  // F7: the installed app (display-mode: standalone) hides both. This Edge ignores CDP's
  // display-mode emulation, so matchMedia is answered "standalone" by a script that runs before
  // the page's own (it tests the page's check, not a real install).
  const media = await b.send("Emulation.setEmulatedMedia", { features: [{ name: "display-mode", value: "standalone" }] }, b.page);
  const emulatedMatches = await b.eval(`matchMedia("(display-mode: standalone)").matches`);
  await b.send("Emulation.setEmulatedMedia", { features: [] }, b.page);
  const standalone = await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `(function(){ const real = window.matchMedia.bind(window);
    window.matchMedia = function(q){ return q.indexOf("display-mode") !== -1 && q.indexOf("standalone") !== -1 ?{ matches: true, media: q, addEventListener(){}, removeEventListener(){} } : real(q); }; })();` }, b.page);
  await b.go("/index.html?g=rv-odd", 1200);
  await b.eval(`(function(){ const e = new Event("beforeinstallprompt", { cancelable: true }); e.prompt = function(){};
    e.userChoice = Promise.resolve({ outcome: "dismissed" }); window.dispatchEvent(e); return true; })()`);
  await sleep(200);
  const standaloneApp = await b.eval(WEB_BITS);
  await b.eval(`localStorage.clear(), true`);
  await b.go("/index.html", 1000);
  out.F7_standalone = { cdpEmulationMatches: emulatedMatches, emulationError: media.error || null, app: standaloneApp, join: await b.eval(WEB_BITS) };
  await b.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: standalone.result.identifier }, b.page);

  // F8: opened by the Android app. CDP drops an android-app:// referrer, so the first document in
  // this tab is given one by a script that runs before the page's own; later documents see the
  // real referrer. Then "Switch group" loads a new document: the tab must stay "in app".
  await b.go("/index.html", 800);
  await b.eval(`sessionStorage.clear(), true`);
  const twa = await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `(function(){
    if(sessionStorage.getItem("__probeReferrerUsed")) return;
    sessionStorage.setItem("__probeReferrerUsed", "1");
    Object.defineProperty(Document.prototype, "referrer", { configurable: true, get: function(){ return "android-app://com.splitfamilia.app/"; } });
  })();` }, b.page);
  await b.go("/index.html?g=rv-odd", 1200);
  await b.eval(`(function(){ const e = new Event("beforeinstallprompt", { cancelable: true }); e.prompt = function(){};
    e.userChoice = Promise.resolve({ outcome: "dismissed" }); window.dispatchEvent(e); return true; })()`);
  await sleep(200);
  const twaFirst = await b.eval(WEB_BITS);
  await b.eval(`document.getElementById("switch-group-btn").click(), true`);
  await sleep(1200);
  const twaJoin = await b.eval(WEB_BITS);
  await b.eval(submit("join-form", { "join-code": "rv-odd" }));
  await sleep(800);
  out.F8_androidApp = { first: twaFirst, afterSwitchGroup: twaJoin, afterJoiningAgain: await b.eval(WEB_BITS) };
  await b.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: twa.result.identifier }, b.page);
  out.errorsF = b.errors.slice();
  out.firestoreHitsF = b.firestoreHits.slice();
  await b.close();
}

{
  // F9: a slow start. The Firestore SDK is held back past the 10-second watchdog, then released:
  // the message must appear, then clear once the app starts.
  const b = await launch(path.join(scratch, "prof-f9"), { fakes: true });
  b.holdSdk = true;
  await b.go("/index.html", 11500);
  const whileHeld = await b.eval(SCREEN);
  b.releaseSdk();
  await sleep(1500);
  out.F9_slowStart = { whileHeld, afterRelease: await b.eval(SCREEN) };
  await b.close();
}

// ---------- Run R: the real SDK, Firestore blocked, project rewritten to demo-t03-probe ----------
rewriteProject = true;
const GROUP = "t03-probe-" + crypto.randomBytes(5).toString("hex");
{
  const b = await launch(path.join(scratch, "prof-r"), { fakes: false });
  // R1: first open online; the service worker installs and takes control.
  await b.go("/index.html?g=" + GROUP, 4000);
  await b.go("/index.html?g=" + GROUP, 3000);
  const r1 = { ctrl: await b.eval(CTRL), screen: await b.eval(SCREEN) };
  await b.eval(submit("add-person-form", { "person-name": "Asha" }));
  await sleep(500);
  await b.eval(submit("add-person-form", { "person-name": "Ben" }));
  await sleep(800);
  await b.eval(`(function(){ document.querySelectorAll("#split-boxes input").forEach(function(c){ c.checked = true; }); return true; })()`);
  await b.eval(submit("add-expense-form", { "exp-desc": "Chai", "exp-amount": "90" }));
  await sleep(1500);
  r1.afterAdding = { screen: await b.eval(SCREEN), ledger: await b.eval(LEDGER) };
  r1.caches = await b.eval(CACHES);
  out.R1_online_firestoreBlocked = r1;

  // R2: no network at all (page and worker offline, the site's server stopped), then reopen.
  await b.setOffline(true);
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await b.go("/index.html?g=" + GROUP, 5000);
  out.R2_offlineReopen = { ctrl: await b.eval(CTRL), onLine: await b.eval(`navigator.onLine`), screen: await b.eval(SCREEN), ledger: await b.eval(LEDGER) };
  // A second invite link, never opened before, also opens offline from the one cached page.
  await b.go("/index.html?g=t03-probe-other", 4000);
  out.R2b_newLinkOffline = { screen: await b.eval(SCREEN) };
  out.R2c_cachesAfter = await b.eval(CACHES);
  // Back online (server up again): the online event updates the status.
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  await b.go("/index.html?g=" + GROUP, 4000);
  await b.setOffline(false);
  await sleep(1500);
  out.R3_backOnline = { onLine: await b.eval(`navigator.onLine`), screen: await b.eval(SCREEN), ledger: await b.eval(LEDGER) };
  out.errorsR = b.errors.slice();
  out.firestoreHitsR = b.firestoreHits.slice();
  out.firestoreRequestsTriedAndBlockedR = b.firestoreBlocked;
  await b.close();
}
{
  // R4: the Firebase SDK can't be fetched (gstatic blocked, nothing cached) → the start-up panel;
  // Retry once it can → the app starts.
  const b = await launch(path.join(scratch, "prof-r4"), { fakes: false });
  await b.setBlocked(FIRESTORE_HOSTS.concat(["*www.gstatic.com*"]));
  const t0 = Date.now();
  await b.go("/index.html", 2500);
  const blocked = await b.eval(SCREEN);
  blocked.ms = Date.now() - t0;
  blocked.nativeSubmitProbe = await b.eval(`(function(){ const f = document.getElementById("join-form"); const e = new Event("submit", { cancelable: true, bubbles: true }); f.dispatchEvent(e); return e.defaultPrevented; })()`);
  await b.setBlocked(FIRESTORE_HOSTS);
  await b.eval(`document.getElementById("boot-retry").click(), true`);
  await sleep(4000);
  out.R4_sdkBlocked = { blocked, afterRetry: await b.eval(SCREEN) };
  out.errorsR4 = b.errors.slice();
  out.firestoreHitsR4 = b.firestoreHits.slice();
  await b.close();
}
server.close();
out.probeGroupPrefix = "t03-probe-";
console.log(JSON.stringify(out, null, 2));
