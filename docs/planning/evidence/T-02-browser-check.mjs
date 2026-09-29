// T-02 browser check (review evidence, not part of the app or of `npm test`).
// Loads the page in headless Edge/Chrome with the Firebase CDN modules replaced by fakes (fixed
// test data; writes are recorded in the page, never sent) and Firestore hosts blocked, so no real
// data is read or written. It exercises SF-004 (paise display, flagged expenses, the amount
// field), SF-005 (bad links) and SF-006 (new groups, joining), and prints what the page showed.
//   1. python -m http.server 8765 --bind 127.0.0.1    (in the folder to test)
//   2. node T-02-browser-check.mjs http://127.0.0.1:8765 <empty scratch profile dir>
// Set BROWSER to a Chrome or Edge executable if Edge isn't at the default Windows path.
import { spawn } from "node:child_process";

const [baseUrl, profileDir] = process.argv.slice(2);
const EDGE = process.env.BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333 + Math.floor(Math.random() * 500);

const FAKE_APP = `export function initializeApp(){ return {}; }`;
const FAKE_FS = `
const FIX = {
  "smoke-one": { groupDoc: true,
    people: [["a","Asha"],["b","Ben"],["c","Chitra"]],
    expenses: [["e1", { date: "2026-09-28T06:30:00.000Z", desc: "Dinner", amount: 300, paidBy: "a", split: ["a","b","c"] }]] },
  "smoke-odd": { groupDoc: false,
    people: [["a","Asha"],["b","Ben"],["c","Chitra"]],
    expenses: [["e1", { date: "2026-09-28T06:30:00.000Z", desc: "Snacks", amount: 100, paidBy: "a", split: ["a","b","c"] }]] },
  "smoke-gone": { groupDoc: false,
    people: [["a","Asha"],["b","Ben"]],
    expenses: [
      ["e1", { date: "2026-09-28T06:30:00.000Z", desc: "Hotel", amount: 300, paidBy: "a", split: ["a","b","c"] }],
      ["e2", { date: "2026-09-27T06:30:00.000Z", desc: "Fuel", amount: 60, paidBy: "c", split: ["a","b"] }]
    ] },
  "smoke-bad": { groupDoc: false,
    people: [["a","Asha"],["b","Ben"]],
    expenses: [
      ["e1", { date: "2026-09-28T06:30:00.000Z", desc: "Huge 1", amount: 1e308, paidBy: "a", split: ["a","b"] }],
      ["e2", { date: "2026-09-28T06:31:00.000Z", desc: "Huge 2", amount: 1e308, paidBy: "a", split: ["a","b"] }],
      ["e3", { date: "2026-09-28T06:32:00.000Z", desc: "Nobody", amount: 50, paidBy: "a", split: [] }],
      ["e4", { date: "2026-09-28T06:33:00.000Z", desc: "No split field", amount: 50, paidBy: "a" }],
      ["e5", { date: "2026-09-28T06:34:00.000Z", desc: "Tea", amount: 30, paidBy: "constructor", split: ["a","b"] }]
    ] }
};
const W = (globalThis.__writes = globalThis.__writes || []);
export function initializeFirestore(){ return {}; }
export function persistentLocalCache(){ return {}; }
export function persistentMultipleTabManager(){ return {}; }
export function collection(db, ...p){ return { path: p }; }
export function doc(a, ...p){ return { path: a.path ? a.path.concat(p) : p }; }
export function query(ref){ return ref; }
export function limit(){ return null; }
function record(op){
  return function(ref, data, opts){
    W.push({ op: op, path: ref.path.join("/"), data: data === undefined ? null : data, opts: opts || null });
    return Promise.resolve({ id: "new" });
  };
}
export const addDoc = record("add"), updateDoc = record("update"), deleteDoc = record("delete"), setDoc = record("set");
export function getDocFromServer(ref){
  const fx = FIX[ref.path[1]];
  return Promise.resolve({ exists: function(){ return !!(fx && fx.groupDoc); } });
}
export function getDocsFromServer(ref){
  const fx = FIX[ref.path[1]];
  return Promise.resolve({ empty: !fx || fx[ref.path[2]].length === 0 });
}
export function onSnapshot(ref, next){
  const [, gid, sub] = ref.path;
  const fx = FIX[gid] || { people: [], expenses: [] };
  setTimeout(function(){
    if(!sub) next({ data: function(){ return { currency: "₹" }; } });
    else {
      const rows = sub === "people" ? fx.people.map(function(r){ return [r[0], { name: r[1] }]; }) : fx.expenses;
      next({ docs: rows.map(function(r){ return { id: r[0], data: function(){ return r[1]; } }; }) });
    }
  }, 0);
  return function(){};
}`;

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--lang=en-US", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir}`, "about:blank"
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === "page");
  } catch {}
}
if (!target) { edge.kill(); throw new Error("Edge did not start"); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map();
const errors = [];
const dialogs = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === "Fetch.requestPaused") {
    const url = msg.params.request.url;
    const body = url.includes("firebase-app.js") ? FAKE_APP : url.includes("firebase-firestore.js") ? FAKE_FS : null;
    if (body === null) { send("Fetch.continueRequest", { requestId: msg.params.requestId }); return; }
    send("Fetch.fulfillRequest", {
      requestId: msg.params.requestId, responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "text/javascript" }, { name: "Access-Control-Allow-Origin", value: "*" }],
      body: Buffer.from(body).toString("base64")
    });
  }
  if (msg.method === "Page.javascriptDialogOpening") {
    dialogs.push(msg.params.message);
    send("Page.handleJavaScriptDialog", { accept: true });
  }
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push(msg.params.entry.text + " " + (msg.params.entry.url || ""));
});
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((r) => pending.set(id, r));
}
async function evaluate(expression) {
  const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails));
  return res.result.result.value;
}
async function go(path) { await send("Page.navigate", { url: baseUrl + path }); await sleep(1200); }
const text = (sel) => `(document.querySelector(${JSON.stringify(sel)})?.innerText || "").replace(/\\s+/g, " ").trim()`;
const shown = (sel) => `(function(){ const e = document.querySelector(${JSON.stringify(sel)}); return !!e && getComputedStyle(e).display !== "none"; })()`;
const screen = () => evaluate(`({
  join: ${shown("#join-screen")}, app: ${shown("#app-shell")},
  alert: ${text("#join-alert")}, joinError: ${text("#join-error")}, newGroupError: ${text("#new-group-error")},
  group: ${text("#group-name")}, url: location.search, saved: localStorage.getItem("splitsheet-group")
})`);
const ledger = () => evaluate(`({
  ledger: [...document.querySelectorAll("#ledger-list .ledger-row")].map(function(d){ return d.innerText.replace(/\\s+/g, " ").trim(); }),
  balances: [...document.querySelectorAll("#balances-list > div")].map(function(d){ return d.innerText.replace(/\\s+/g, " ").trim(); })
})`);

await send("Network.enable");
await send("Network.setBlockedURLs", { urls: ["*firestore.googleapis.com*", "*firebaseinstallations.googleapis.com*", "*identitytoolkit*"] });
await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await send("Fetch.enable", { patterns: [{ urlPattern: "*gstatic.com/firebasejs/*" }] });

const out = {};

// SF-004: balances in paise, removed people, flagged expenses.
for (const gid of ["smoke-one", "smoke-odd", "smoke-gone", "smoke-bad"]) {
  await go(`/index.html?g=${gid}`);
  out[gid] = await ledger();
}

// SF-004: the amount field. Typed with real key input, so a number field's badInput is real.
async function tryAmount(typed) {
  await evaluate(`(function(){ document.getElementById("exp-desc").value = "Check"; const a = document.getElementById("exp-amount"); a.value = ""; a.focus(); return true; })()`);
  if (typed) await send("Input.insertText", { text: typed });
  const before = dialogs.length;
  await evaluate(`(function(){ setTimeout(function(){ document.getElementById("add-expense-btn").click(); }, 0); return true; })()`);
  await sleep(300);
  const writes = await evaluate(`JSON.stringify((globalThis.__writes || []).filter(function(w){ return w.op === "add"; }).map(function(w){ return w.data.amount; }))`);
  return { typed, dialog: dialogs.slice(before).join(" | ") || null, storedAmounts: writes };
}
await go(`/index.html?g=smoke-one`);
out.amountField = [];
for (const typed of ["", "1e", "0", "-5", "10.555", "20000000", "1e308", "99.5", "0.29"]) out.amountField.push(await tryAmount(typed));

// SF-005: invalid links and saved codes.
await evaluate(`localStorage.clear(), true`);
await go(`/index.html?g=goa/trip`);
out.badLink = await screen();
await send("Page.reload");
await sleep(1200);
out.badLinkAfterReload = await screen();
await go(`/index.html?g=GOA`);
out.upperCaseLink = await screen();
await evaluate(`localStorage.setItem("splitsheet-group", "bad/value"), true`);
await go(`/index.html`);
out.badSavedCode = await screen();
await go(`/index.html?g=goa-trip-2026`);
out.validOldLink = await screen();

// SF-006: start a new group, copy its link, open it with nothing saved.
await evaluate(`localStorage.clear(), true`);
await go(`/index.html`);
out.joinScreenText = await evaluate(text("#join-screen"));
await evaluate(`(function(){ document.querySelector("#new-group-form button").click(); return true; })()`);
out.newGroupEmptyName = await screen();
await evaluate(`(function(){ document.getElementById("new-group-name").value = "Goa trip"; document.querySelector("#new-group-form button").click(); return true; })()`);
await sleep(500);
out.newGroup = await screen();
out.newGroupWrites = await evaluate(`JSON.stringify(globalThis.__writes || [])`);
out.copiedLink = await evaluate(`new Promise(function(resolve){
  navigator.clipboard.writeText = function(t){ resolve(t); return Promise.resolve(); };
  document.getElementById("copy-link-btn").click();
})`);
await evaluate(`localStorage.clear(), true`);
await send("Page.navigate", { url: out.copiedLink });
await sleep(1200);
out.openCopiedLinkFresh = await screen();

// SF-006: join with a link, a bare old name, a made-up code, bad input and while offline.
async function join(input) {
  await evaluate(`localStorage.clear(), true`);
  await go(`/index.html`);
  await evaluate(`(function(){ document.getElementById("join-code").value = ${JSON.stringify(input)}; document.getElementById("join-btn").click(); return true; })()`);
  await sleep(600);
  return Object.assign({ input }, await screen());
}
out.join = [];
for (const input of ["https://example.invalid/index.html?g=smoke-one", "Smoke Odd", "made-up-code-2222222222", "https://example.invalid/?x=1", "", "smoke-gone"]) {
  out.join.push(await join(input));
}
await evaluate(`localStorage.clear(), true`);
await go(`/index.html`);
await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await sleep(300);
await evaluate(`(function(){ document.getElementById("join-code").value = "smoke-one"; document.getElementById("join-btn").click(); return true; })()`);
await sleep(600);
out.joinOffline = Object.assign({ onLine: await evaluate("navigator.onLine") }, await screen());
await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

// The service worker's cache holds the new module.
await go(`/index.html?g=smoke-one`);
await sleep(1500);
out.serviceWorker = await evaluate(`navigator.serviceWorker.ready.then(async function(){
  const shell = {};
  for (const k of await caches.keys()) {
    const c = await caches.open(k);
    shell[k] = (await c.keys()).map(function(r){ return new URL(r.url).pathname; }).sort();
  }
  return shell;
})`);
out.pageErrors = errors;
console.log(JSON.stringify(out, null, 2));

// Close the whole browser (not just the launcher), so the profile is free for the next run.
const browserWs = new WebSocket((await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl);
await new Promise((r) => browserWs.addEventListener("open", r, { once: true }));
browserWs.send(JSON.stringify({ id: 1, method: "Browser.close" }));
for (let i = 0; i < 50; i++) {
  await sleep(200);
  try { await fetch(`http://127.0.0.1:${PORT}/json/version`); } catch { break; }
}
await sleep(1500);
ws.close();
