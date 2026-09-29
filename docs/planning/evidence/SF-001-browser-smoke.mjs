// SF-001 browser smoke check (review evidence, not part of the app or of `npm test`).
// Loads the page in headless Edge/Chrome with the Firebase CDN modules replaced by fakes
// (fixed test data) and Firestore hosts blocked, so no real data is read or written. It prints
// what the People, Ledger and Balances sections show, the service-worker caches and any page
// errors.
//   1. python -m http.server 8765 --bind 127.0.0.1    (in the folder to test)
//   2. node SF-001-browser-smoke.mjs http://127.0.0.1:8765 <empty scratch profile dir>
// Set BROWSER to a Chrome or Edge executable if Edge isn't at the default Windows path.
import { spawn } from "node:child_process";

const [baseUrl, profileDir] = process.argv.slice(2);
const EDGE = process.env.BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333 + Math.floor(Math.random() * 500);

const FAKE_APP = `export function initializeApp(){ return {}; }`;
const FAKE_FS = `
const FIX = {
  "smoke-one": {
    people: [["a","Asha"],["b","Ben"],["c","Chitra"]],
    expenses: [["e1", { date: "2026-09-28T06:30:00.000Z", desc: "Dinner", amount: 300, paidBy: "a", split: ["a","b","c"] }]]
  },
  "smoke-two": {
    people: [["a","Asha"],["b","Ben"],["c","Chitra"]],
    expenses: [
      ["e1", { date: "2026-09-27T06:30:00.000Z", desc: "Taxi", amount: 90, paidBy: "a", split: ["a","b","c"] }],
      ["e2", { date: "2026-09-28T06:30:00.000Z", desc: "Tea", amount: 30, paidBy: "b", split: ["b","c"] }]
    ]
  },
  "smoke-odd": {
    people: [["a","Asha"],["b","Ben"],["c","Chitra"]],
    expenses: [["e1", { date: "2026-09-28T06:30:00.000Z", desc: "Snacks", amount: 100, paidBy: "a", split: ["a","b","c"] }]]
  },
  "smoke-gone": {
    people: [["a","Asha"],["b","Ben"]],
    expenses: [
      ["e1", { date: "2026-09-28T06:30:00.000Z", desc: "Hotel", amount: 300, paidBy: "a", split: ["a","b","c"] }],
      ["e2", { date: "2026-09-27T06:30:00.000Z", desc: "Fuel", amount: 60, paidBy: "c", split: ["a","b"] }]
    ]
  }
};
export function initializeFirestore(){ return {}; }
export function persistentLocalCache(){ return {}; }
export function persistentMultipleTabManager(){ return {}; }
export function collection(db, ...p){ return { path: p }; }
export function doc(a, ...p){ return { path: a.path ? a.path.concat(p) : p }; }
function fail(){ return Promise.reject(new Error("smoke test: writes disabled")); }
export const addDoc = fail, updateDoc = fail, deleteDoc = fail, setDoc = fail;
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
const blocked = [];
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
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push(msg.params.entry.text + " " + (msg.params.entry.url || ""));
  if (msg.method === "Network.loadingFailed" && msg.params.blockedReason) blocked.push(msg.params.blockedReason);
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

await send("Network.enable");
await send("Network.setBlockedURLs", { urls: ["*firestore.googleapis.com*", "*firebaseinstallations.googleapis.com*", "*identitytoolkit*"] });
await send("Runtime.enable");
await send("Log.enable");
await send("Fetch.enable", { patterns: [{ urlPattern: "*gstatic.com/firebasejs/*" }] });

const out = {};
for (const gid of ["smoke-one", "smoke-two", "smoke-odd", "smoke-gone"]) {
  await send("Page.navigate", { url: `${baseUrl}/index.html?g=${gid}` });
  await sleep(1500);
  out[gid] = await evaluate(`({
    people: document.getElementById("people-list").innerText.replace(/\\s+/g, " ").trim(),
    ledger: document.getElementById("ledger-list").innerText.replace(/\\s+/g, " ").trim(),
    balances: [...document.querySelectorAll("#balances-list > div")].map(function(d){ return d.innerText.replace(/\\s+/g, " ").trim(); })
  })`);
}
// Service worker: registered by the end of the module, and its cache holds the shell files.
await sleep(1500);
out.serviceWorker = await evaluate(`navigator.serviceWorker.ready.then(async function(){
  const keys = await caches.keys();
  const shell = {};
  for (const k of keys) {
    const c = await caches.open(k);
    shell[k] = (await c.keys()).map(function(r){ return new URL(r.url).pathname; }).sort();
  }
  return shell;
})`);
out.pageErrors = errors;
out.firestoreBlockedRequests = blocked.length;
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
