// T-06 review probe (evidence only, not part of `npm test`; the T-06 review, 2026-10-02 IST).
//   node T-06-review-probe.mjs <repoDir> <empty scratch dir>
// Prints one JSON object. Everything is local: the real server on 127.0.0.1 with temporary
// databases, headless Edge over CDP, made-up group codes and documentation IP addresses (RFC 5737).
//
// Part A (Node): how long the server keeps a client's IP address in memory, against the privacy
//   policy's "for at most 10 minutes" (section 5) and "The server forgets IP addresses within 10
//   minutes" (section 10). Uses the real limiters and live hub with a fake clock.
// Part B (headless Edge): cases the T-06 browser check doesn't drive. B1: Escape closes a sheet
//   while the message bar is inside it. B2: a new message raised while the confirmation is open.
//   B3: N-14 on a browser without showModal (a panel opened over itself). Each case runs on the
//   app as it is, then on a scratch copy with the fix taken out, to show the case catches the bug.
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repoArg, scratchArg] = process.argv.slice(2);
const repoDir = path.resolve(repoArg);
const scratch = path.resolve(scratchArg);
fs.mkdirSync(scratch, { recursive: true });
const imp = (dir, p) => import(pathToFileURL(path.join(dir, p)).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (name) => process.stderr.write(new Date().toISOString().slice(11, 19) + " " + name + "\n");
const out = { A: {}, B: {} };

// ---------- Part A: the IP address in the server's memory ----------
step("A");
const api = await imp(repoDir, "server/api.js");
const live = await imp(repoDir, "server/live.js");
for (const [name, make] of [["guessLimiter", api.createGuessLimiter], ["writeLimiter", api.createWriteLimiter]]) {
  let t = Date.parse("2026-10-02T00:00:00Z");
  const lim = make({ now: () => t });
  const r = {};
  lim.hit("192.0.2.1"); // one request from an address that never comes back
  r.atStart = lim.size();
  t += 11 * 60 * 1000;
  lim.hit("198.51.100.2"); // another address, 11 minutes later
  r.after11Minutes = lim.size();
  t += 7 * 24 * 3600 * 1000;
  lim.hit("203.0.113.3"); // another, a week later
  r.after7Days = lim.size();
  lim.blocked("192.0.2.1"); // the first address is dropped only when it is seen again
  r.afterFirstAddressSeenAgain = lim.size();
  out.A[name] = r;
}
{
  const hub = live.createLiveHub({ heartbeatMs: 3600000, maxStreamsPerAddress: 1 });
  const res = new EventEmitter();
  res.writableEnded = false; res.destroyed = false;
  res.writeHead = () => res; res.write = () => true;
  hub.open("review-probe-code", res, 1, "192.0.2.9");
  const whileOpen = hub.full("192.0.2.9");
  res.emit("close");
  out.A.liveHub = { addressHeldWhileStreamOpen: whileOpen, addressHeldAfterClose: hub.full("192.0.2.9") };
}
out.A.timersInServer = fs.readdirSync(path.join(repoDir, "server")).filter((f) => f.endsWith(".js"))
  .map((f) => [f, (fs.readFileSync(path.join(repoDir, "server", f), "utf8").match(/setInterval\(/g) || []).length])
  .filter(([, n]) => n > 0).map(([f, n]) => f + ": " + n + " setInterval (" + (f === "live.js" ? "the stream heartbeat" : "?") + ")");

// ---------- Part B: the app, and copies with a fix taken out ----------
const { STATIC_FILES } = await imp(repoDir, "server/static.js");
function brokenCopy(label, find, replace){
  const root = path.join(scratch, "app-" + label);
  for (const p of Object.keys(STATIC_FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, p.slice(1))), { recursive: true });
    fs.copyFileSync(path.join(repoDir, p.slice(1)), path.join(root, p.slice(1)));
  }
  const file = path.join(root, "index.html");
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes(find)) throw new Error("break " + label + ": text not found");
  fs.writeFileSync(file, html.replace(find, replace));
  return root;
}
// F-14 as first tried in T-06: the bar a popover in <body>, never moved into the open dialog.
const noMove = brokenCopy("bar-stays-in-body", "if(notice.parentNode !== host) host.appendChild(notice);", "");
// N-14 as before T-06: openExpense sets `form` before the old panel's close hook runs.
const noEndPanel = brokenCopy("no-endpanel", "function openExpense(exp){\n      endPanel();\n", "function openExpense(exp){\n");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9450 + Math.floor(Math.random() * 150);
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--lang=en-US", "--hide-scrollbars",
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(scratch, "profile")}`, "about:blank"], { stdio: "ignore" });
let ver;
for (let i = 0; i < 80 && !ver; i++) { await sleep(200); try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch {} }
if (!ver) throw new Error("Edge did not start");
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map();
const sessions = new Map();
const errors = [], dialogs = [], timeouts = [];
let offline = false;
const send = (method, params = {}, sessionId) => {
  const id = nextId++;
  ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  return new Promise((r) => {
    const timer = setTimeout(() => { pending.delete(id); timeouts.push(method); r({ timeout: true, result: { result: {} } }); }, 20000);
    pending.set(id, (msg) => { clearTimeout(timer); r(msg); });
  });
};
const conditions = () => ({ offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
async function setup(sessionId, type){
  const calls = [send("Network.enable", {}, sessionId)];
  if (offline) calls.push(send("Network.emulateNetworkConditions", conditions(), sessionId));
  calls.push(send("Runtime.enable", {}, sessionId));
  if (type === "page") { calls.push(send("Log.enable", {}, sessionId)); calls.push(send("Page.enable", {}, sessionId)); }
  calls.push(send("Runtime.runIfWaitingForDebugger", {}, sessionId));
  await Promise.all(calls);
}
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === "Target.attachedToTarget") {
    const { sessionId, targetInfo } = msg.params;
    sessions.set(sessionId, { type: targetInfo.type, targetId: targetInfo.targetId });
    if (targetInfo.type === "page" || targetInfo.type === "service_worker") setup(sessionId, targetInfo.type);
    else send("Runtime.runIfWaitingForDebugger", {}, sessionId);
    return;
  }
  if (msg.method === "Target.detachedFromTarget") { sessions.delete(msg.params.sessionId); return; }
  if (msg.method === "Page.javascriptDialogOpening") {
    dialogs.push(msg.params.type + ": " + msg.params.message);
    send("Page.handleJavaScriptDialog", { accept: true }, msg.sessionId);
  }
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text;
    if (!/review probe/.test(d)) errors.push(d); // B1 throws one on purpose
  }
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error"
    && !/ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE|ERR_NETWORK_CHANGED|net::ERR_FAILED|Failed to load resource|1Password|chrome-extension|unexpected error/.test(msg.params.entry.text)) {
    errors.push("log: " + msg.params.entry.text.slice(0, 160));
  }
});
await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
async function newTab(){
  const { result } = await send("Target.createTarget", { url: "about:blank" });
  for (let i = 0; i < 50; i++) {
    for (const [sid, s] of sessions) if (s.type === "page" && s.targetId === result.targetId) return { sid, targetId: result.targetId };
    await sleep(100);
  }
  throw new Error("no session for the new tab");
}
async function setOffline(value){
  offline = value;
  await Promise.all([...sessions.keys()].map((sid) => send("Network.emulateNetworkConditions", conditions(), sid)));
}
const evaluate = async (tab, expression) => {
  const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, tab);
  if (res.timeout) throw new Error("evaluate timed out");
  if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 300));
  return res.result.result.value;
};
const go = async (tab, url, wait = 2500) => { await send("Page.navigate", { url }, tab); await sleep(wait); };
const J = JSON.stringify;
const click = (tab, sel) => evaluate(tab, `(function(){ const e = document.querySelector(${J(sel)}); if(!e) throw new Error("no " + ${J(sel)}); e.click(); return true; })()`);
const clickText = (tab, sel, text) => evaluate(tab, `(function(){
  const e = [...document.querySelectorAll(${J(sel)})].find(function(x){ return x.textContent.replace(/\\s+/g, " ").indexOf(${J(text)}) !== -1; });
  if(!e) throw new Error("no " + ${J(sel + " " + text)}); e.click(); return true; })()`);
const type = (tab, id, value) => evaluate(tab, `(function(){ const e = document.getElementById(${J(id)}); e.value = ${J(value)};
  e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
const submit = (tab, id) => evaluate(tab, `(function(){ document.getElementById(${J(id)}).requestSubmit(); return true; })()`);
async function waitFor(tab, expression, ms){
  const end = Date.now() + ms;
  let v;
  while (Date.now() < end) { v = await evaluate(tab, expression); if (v) return v; await sleep(200); }
  return v;
}
const waitLive = (tab) => waitFor(tab, `(function(){ const e = document.getElementById("group-status"); return e && e.textContent.trim() === "live" ? "live" : ""; })()`, 12000);
// Where the bar is, whether it is the topmost thing at its centre, and whether it is a shown popover.
const NOTICE = `(function(){
  const n = document.getElementById("notice"); const r = n.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const x = document.getElementById("notice-close").getBoundingClientRect();
  return { text: document.getElementById("notice-text").textContent, shown: !n.hidden, popoverOpen: n.matches(":popover-open"),
    inside: n.parentNode.id || n.parentNode.tagName, noticeOnTop: Boolean(hit) && n.contains(hit), hitIs: hit ? (hit.id || hit.className || hit.tagName) : null,
    closeAt: [x.left + x.width / 2, x.top + x.height / 2],
    sheetOpen: document.getElementById("sheet").open, confirmOpen: document.getElementById("confirm").open };
})()`;
const STATE = `({ noticeHidden: document.getElementById("notice").hidden, popoverOpen: document.getElementById("notice").matches(":popover-open"),
  noticeIn: document.getElementById("notice").parentNode.id || document.getElementById("notice").parentNode.tagName,
  sheetOpen: document.getElementById("sheet").open, confirmOpen: document.getElementById("confirm").open })`;
async function axIgnored(tab, selector){
  await send("Accessibility.enable", {}, tab);
  const doc = await send("DOM.getDocument", { depth: 0 }, tab);
  const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector }, tab);
  const ax = await send("Accessibility.getPartialAXTree", { nodeId: q.result.nodeId, fetchRelatives: false }, tab);
  const node = (ax.result.nodes || [])[0];
  return node ? { ignored: node.ignored, role: node.role && node.role.value } : null;
}
async function tap(tab, x, y){
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }, tab);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }, tab);
}
async function escape(tab){
  const k = { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
  await send("Input.dispatchKeyEvent", Object.assign({ type: "rawKeyDown" }, k), tab);
  await send("Input.dispatchKeyEvent", Object.assign({ type: "keyUp" }, k), tab);
}
const rand = () => Array.from({ length: 10 }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("");

// A made-up group: Asha and Ben, Dinner ₹300 (Asha) and Lunch ₹90 (Ben), both split between them.
async function seed(base, code){
  const call = async (method, p, body) => (await fetch(base + p, { method, headers: { "X-Group-Code": code, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined })).status;
  const date = new Date().toISOString();
  const statuses = [
    await call("PUT", "/api/group", { currency: "₹" }),
    await call("POST", "/api/people", { id: "p-asha", name: "Asha" }),
    await call("POST", "/api/people", { id: "p-ben", name: "Ben" }),
    await call("POST", "/api/expenses", { id: "e-dinner", date, desc: "Dinner", amountPaise: 30000, paidBy: "p-asha", split: ["p-asha", "p-ben"] }),
    await call("POST", "/api/expenses", { id: "e-lunch", date, desc: "Lunch", amountPaise: 9000, paidBy: "p-ben", split: ["p-asha", "p-ben"] })
  ];
  return { call, statuses };
}

async function withServer(root, label, body){
  const { createApp } = await imp(repoDir, "server/server.js");
  const app = createApp({ root, dbFile: path.join(scratch, label + ".db"), log: () => {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.server.address().port;
  const tab = await newTab();
  await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 740, deviceScaleFactor: 2, mobile: true }, tab.sid);
  try { return await body(base, app, tab.sid); }
  catch (e) { return { crash: String(e && e.stack || e).slice(0, 600) }; }
  finally {
    if (offline) await setOffline(false);
    await send("Target.closeTarget", { targetId: tab.targetId });
    await app.close();
  }
}

// B1 and B2: the message bar (F-14).
async function bar(base, app, T){
  const code = "rp-bar-" + rand();
  const { call, statuses } = await seed(base, code);
  const r = { seeded: statuses };
  await go(T, base + "/?g=" + code, 3000);
  r.status = await waitLive(T);

  // B1: a message while "Add expense" is open, then Escape.
  await click(T, "#add-expense-btn"); await sleep(400);
  await evaluate(T, `(setTimeout(function(){ throw new Error("review probe"); }, 0), true)`);
  await waitFor(T, `!document.getElementById("notice").hidden`, 5000); await sleep(300);
  r.B1_sheetOpen = Object.assign(await evaluate(T, NOTICE), { ax: await axIgnored(T, "#notice-close") });
  await escape(T); await sleep(600);
  r.B1_afterEscape = await evaluate(T, NOTICE);
  await tap(T, r.B1_afterEscape.closeAt[0], r.B1_afterEscape.closeAt[1]); await sleep(400);
  r.B1_afterTapOnClose = await evaluate(T, STATE);

  // B2: an offline edit of Lunch, which another phone deletes; the refusal arrives while the
  // confirmation for deleting Dinner is open.
  await setOffline(true); await sleep(600);
  await clickText(T, "#ledger-list .expense-row", "Lunch"); await sleep(400);
  await type(T, "exp-amount", "120"); await submit(T, "add-expense-form"); await sleep(600);
  r.B2_computerDeletesLunch = await call("DELETE", "/api/expenses/e-lunch");
  await clickText(T, "#ledger-list .expense-row", "Dinner"); await sleep(400);
  await click(T, "#exp-delete-btn"); await sleep(400);
  r.B2_beforeOnline = await evaluate(T, STATE);
  await setOffline(false);
  await waitFor(T, `!document.getElementById("notice").hidden`, 20000); await sleep(500);
  r.B2_messageWhileConfirmOpen = Object.assign(await evaluate(T, NOTICE), { ax: await axIgnored(T, "#notice-close") });
  await tap(T, r.B2_messageWhileConfirmOpen.closeAt[0], r.B2_messageWhileConfirmOpen.closeAt[1]); await sleep(400);
  r.B2_afterTapOnClose = await evaluate(T, STATE);
  await click(T, "#confirm-cancel"); await sleep(400);
  r.B2_afterCancel = await evaluate(T, STATE);
  await click(T, "#sheet-close"); await sleep(400);
  r.B2_end = await evaluate(T, STATE);
  r.B2_server = app.ledger.readGroup(code).expenses.map((e) => e.desc + " " + e.amountPaise);
  return r;
}

// B3: N-14 on a browser without showModal. "Add expense" is tapped again while its panel is open
// (nothing is inert without a modal dialog), then the form is filled in and saved.
async function panelOverItself(base, app, T){
  const code = "rp-n14-" + rand();
  const { statuses } = await seed(base, code);
  const r = { seeded: statuses };
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "delete HTMLDialogElement.prototype.showModal;" }, T);
  await go(T, base + "/?g=" + code, 3000);
  r.status = await waitLive(T);
  r.showModal = await evaluate(T, `typeof HTMLDialogElement.prototype.showModal`);
  await click(T, "#add-expense-btn"); await sleep(400);
  await click(T, "#add-expense-btn"); await sleep(400);
  await type(T, "exp-desc", "Bread"); await type(T, "exp-amount", "50");
  await submit(T, "add-expense-form"); await sleep(1500);
  r.sheetOpenAfterSave = await evaluate(T, `document.getElementById("sheet").open`);
  r.server = app.ledger.readGroup(code).expenses.map((e) => e.desc + " " + e.amountPaise);
  return r;
}

try {
  step("B1-B2 on the app"); out.B.bar = await withServer(repoDir, "bar", bar);
  step("B1-B2 with the bar left in <body>"); out.B.bar_break = await withServer(noMove, "bar-break", bar);
  step("B3 on the app"); out.B.n14 = await withServer(repoDir, "n14", panelOverItself);
  step("B3 without endPanel() in openExpense"); out.B.n14_break = await withServer(noEndPanel, "n14-break", panelOverItself);
} finally {
  out.dialogs = dialogs;
  out.errors = errors;
  out.timeouts = timeouts;
  try { await send("Browser.close"); } catch {}
  try { edge.kill(); } catch {}
}
console.log(JSON.stringify(out, null, 1));
process.exit(0);
