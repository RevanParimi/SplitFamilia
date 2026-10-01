// T-04 browser check (evidence only, not part of `npm test`): the real page on the real server,
// both local (127.0.0.1, a temporary database), in headless Edge over CDP. SF-022 (edit an
// expense), SF-023 (settle-ups), SF-029 (recent groups), SF-028 (the new UI: confirmations, field
// errors, the guide, widths and tap targets), and the T-09 review's F-11, F-12 and N-8.
// Nothing here reaches any real group or database.
//   node T-04-browser-check.mjs <repoDir> <empty scratch dir> [<screenshot dir>]
// Prints one JSON object; the expected values are worked out by hand in the T-04 receipt (B1–B17).
// New targets are not paused (the T-09 review's O-2), and every CDP reply has a time limit.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repoArg, scratch, shotsArg] = process.argv.slice(2);
const repoDir = path.resolve(repoArg);
const shotsDir = shotsArg ? path.resolve(shotsArg) : null;
const { createApp } = await import(pathToFileURL(path.join(repoDir, "server", "server.js")).href);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (name) => process.stderr.write(new Date().toISOString().slice(11, 19) + " " + name + "\n");
fs.mkdirSync(scratch, { recursive: true });
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const out = {};

// ---------- the server under test ----------
const served = [];
let streamsOpened = 0; // a live stream's response never finishes while the page is open
const app = createApp({ root: repoDir, dbFile: path.join(scratch, "check.db"), log: () => {} });
app.server.on("request", (req, res) => {
  if (req.url === "/api/group/events") streamsOpened++;
  res.on("finish", () => served.push(`${req.method} ${req.url} → ${res.statusCode}`));
});
await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + app.server.address().port;
// Another phone, straight to the API.
const phone = (code) => async (method, p, body) => {
  const res = await fetch(BASE + p, { method, headers: { "X-Group-Code": code, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status };
};
const serverGroup = (code) => app.ledger.groupVersion(code) === null ? null : (function(g){
  return { currency: g.currency, version: g.version, people: g.people.map((p) => p.name),
    expenses: g.expenses.map((e) => (e.kind ? "[" + e.kind + "] " : "") + e.desc + " " + e.amountPaise + " " + e.paidBy + ">" + e.split.join("+")) };
})(app.ledger.readGroup(code));

// The sample groups. People's IDs sort as Asha < Ben < Chitra, so a leftover paisa goes to Asha.
const TRIP = "check-trip-a9a9ijkeit";
const DIWALI = "diwali-party-2026-a9a9ijkeit";
const LAKE = "lake-trip-7k2m9xqpwd";
for (const code of [TRIP, DIWALI, LAKE]) {
  const p = phone(code);
  await p("PUT", "/api/group", { currency: "₹" });
  for (const [id, name] of [["p-asha", "Asha"], ["p-ben", "Ben"], ["p-chitra", "Chitra"]]) await p("POST", "/api/people", { id, name });
}
await phone(TRIP)("POST", "/api/expenses", { id: "dinner", date: "2026-09-28T15:30:00.000Z", desc: "Dinner", amountPaise: 120000, paidBy: "p-asha", split: ["p-asha", "p-ben", "p-chitra"] });
await phone(TRIP)("POST", "/api/expenses", { id: "deposit", date: "2025-12-30T12:30:00.000Z", desc: "Deposit", amountPaise: 30000, paidBy: "p-ben", split: ["p-ben"] });
await phone(DIWALI)("POST", "/api/expenses", { id: "sweets", date: "2026-09-20T13:30:00.000Z", desc: "Sweets", amountPaise: 30000, paidBy: "p-chitra", split: ["p-asha", "p-ben", "p-chitra"] });
await phone(LAKE)("POST", "/api/expenses", { id: "tix", date: "2026-09-30T08:00:00.000Z", desc: "Tickets", amountPaise: 1001, paidBy: "p-asha", split: ["p-asha", "p-ben"] });

// ---------- headless Edge ----------
const port = 9700 + Math.floor(Math.random() * 200);
// A made-up GitHub Pages name that Edge sends to the local server, for SF-038's "moved" notice (B17).
const PAGES_HOST = "pages-check.github.io";
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--lang=en-US", "--hide-scrollbars",
  `--host-resolver-rules=MAP ${PAGES_HOST} 127.0.0.1`,
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
async function setup(sessionId, type) {
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
  // Any alert(), confirm() or prompt() is recorded: the new UI has none (SF-028).
  if (msg.method === "Page.javascriptDialogOpening") {
    dialogs.push(msg.params.type + ": " + msg.params.message);
    send("Page.handleJavaScriptDialog", { accept: true }, msg.sessionId);
  }
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error"
    && !/ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE|ERR_NETWORK_CHANGED|net::ERR_FAILED|Failed to load resource|1Password|chrome-extension/.test(msg.params.entry.text)) {
    errors.push("log: " + msg.params.entry.text.slice(0, 160));
  }
});
await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
await send("Browser.grantPermissions", { origin: BASE, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] });
async function newTab(){
  const { result } = await send("Target.createTarget", { url: "about:blank" });
  for (let i = 0; i < 50; i++) {
    for (const [sid, s] of sessions) if (s.type === "page" && s.targetId === result.targetId) return sid;
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
const go = async (tab, p, wait = 2500) => { await send("Page.navigate", { url: p.startsWith("http") ? p : BASE + p }, tab); await sleep(wait); };
const viewport = (tab, width, height, dpr = 1) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: true }, tab);
async function shot(tab, name){
  if (!shotsDir) return;
  await send("Page.bringToFront", {}, tab);
  await evaluate(tab, `(function(){ if(document.activeElement) document.activeElement.blur(); return 1; })()`);
  await sleep(150);
  const res = await send("Page.captureScreenshot", { format: "png" }, tab);
  if (res.result && res.result.data) fs.writeFileSync(path.join(shotsDir, name + ".png"), Buffer.from(res.result.data, "base64"));
}

// ---------- page helpers (all through the page's own controls) ----------
const status = (tab) => evaluate(tab, `(document.getElementById("group-status") || {}).textContent || null`);
async function waitStatus(tab, re, ms){
  const until = Date.now() + ms;
  let s = "";
  while (Date.now() < until) { s = await status(tab); if (re.test(s || "")) return s; await sleep(200); }
  return "TIMED OUT at: " + s;
}
const click = (tab, sel) => evaluate(tab, `(function(){ const e = document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error("no " + ${JSON.stringify(sel)}); e.click(); return true; })()`);
// Clicks the first element matching `sel` whose text contains `text`.
const clickText = (tab, sel, text) => evaluate(tab, `(function(){
  const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) !== -1; });
  if(!e) throw new Error("no " + ${JSON.stringify(sel + " " + text)}); e.click(); return true; })()`);
const type = (tab, id, value) => evaluate(tab, `(function(){ const e = document.getElementById(${JSON.stringify(id)}); e.value = ${JSON.stringify(value)};
  e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
const submit = (tab, id) => evaluate(tab, `(function(){ document.getElementById(${JSON.stringify(id)}).requestSubmit(); return true; })()`);
const codeOf = (tab) => evaluate(tab, `new URL(location.href).searchParams.get("g")`);
const VIEW = `(function(){
  const vis = function(id){ const e = document.getElementById(id); return Boolean(e) && !e.hidden && e.getClientRects().length > 0; };
  const text = function(e){ return e ? e.textContent.replace(/\\s+/g, " ").trim() : null; };
  const errs = [...document.querySelectorAll(".field-error, .blocked")].filter(function(e){ return !e.hidden && e.getClientRects().length > 0; }).map(text);
  return {
    screen: vis("join-screen") ? "welcome" : vis("app-shell") ? "group" : vis("moved-screen") ? "moved" : "other",
    title: text(document.getElementById("group-name")),
    status: text(document.getElementById("group-status")),
    peopleCount: text(document.getElementById("people-count")),
    guide: vis("guide") ? text(document.getElementById("guide-step")) + " | " + text(document.getElementById("guide-title")) + " | " + text(document.getElementById("guide-go")) : null,
    notLoaded: vis("not-loaded") ? text(document.getElementById("not-loaded-text")) : null,
    balances: vis("balances-section") ? [...document.querySelectorAll("#balances-list .balance-row .balance-who, #balances-list .balance-row .balance-amt, #balances-list .settled-title")].map(text) : null,
    ledger: vis("ledger-section") ? [...document.querySelectorAll("#ledger-list .expense-row")].map(function(r){
      return text(r.querySelector(".row-title")) + " | " + text(r.querySelector(".row-sub")) + " | " + text(r.querySelector(".row-amt")) + (r.querySelector(".pill-waiting") ? " | waiting" : "");
    }) : null,
    sheet: document.getElementById("sheet").open ? text(document.getElementById("sheet-title")) : null,
    confirm: document.getElementById("confirm").open ? text(document.getElementById("confirm-title")) + " | " + text(document.getElementById("confirm-body")) : null,
    fieldErrors: errs,
    notice: document.getElementById("notice").hidden ? null : text(document.getElementById("notice-text")),
    recent: vis("recent-section") ? [...document.querySelectorAll("#recent-list .group-open")].map(function(b){ return text(b.querySelector(".row-title")) + " | " + text(b.querySelector(".row-sub")); }) : null,
    addDisabled: document.getElementById("add-expense-btn").disabled
  };
})()`;
const view = (tab) => evaluate(tab, VIEW);
// Every visible control smaller than 44 × 44 CSS px (a checkbox counts by its row).
const SMALL = `(function(){
  const out = [];
  document.querySelectorAll("button, a, select, input, .check-row").forEach(function(e){
    if(e.type === "checkbox") return;
    if(e.closest("[hidden]") || e.getClientRects().length === 0) return;
    const r = e.getBoundingClientRect();
    if(r.width < 44 || r.height < 44) out.push((e.id || e.className || e.tagName) + " " + Math.round(r.width) + "x" + Math.round(r.height));
  });
  return out;
})()`;
const WIDE = `(function(){ return document.documentElement.scrollWidth > innerWidth ? document.documentElement.scrollWidth + " > " + innerWidth : "ok"; })()`;

let A = null, B = null;
try {
  A = await newTab();
  await viewport(A, 390, 844, 2);
  // First visit: the worker installs and takes control.
  await go(A, "/", 3000);
  for (let i = 0; i < 30 && !(await evaluate(A, `Boolean(navigator.serviceWorker.controller)`)); i++) await sleep(200);
  out.B0_welcome = await view(A);
  await shot(A, "after-390-welcome-first");

  step("B1");
  // B1. SF-022 online: Dinner ₹1,200.00 by Asha split three ways is edited to ₹1,250.50.
  await go(A, "/?g=" + TRIP, 3000);
  out.B1_before = Object.assign({ status: await waitStatus(A, /^live$/, 10000) }, await view(A));
  await shot(A, "after-390-home");
  await clickText(A, "#ledger-list .expense-row", "Dinner");
  await sleep(400);
  out.B1_sheet = await evaluate(A, `({ title: document.getElementById("sheet-title").textContent, desc: document.getElementById("exp-desc").value,
    amount: document.getElementById("exp-amount").value, payer: document.getElementById("exp-payer-name").textContent,
    split: document.getElementById("split-summary").textContent, save: document.getElementById("save-expense-btn").textContent,
    deleteShown: !document.getElementById("exp-delete-btn").hidden })`);
  await shot(A, "after-390-edit");
  await type(A, "exp-amount", "1250.50");
  await submit(A, "add-expense-form");
  await sleep(300);
  out.B1_after = Object.assign({ status: await waitStatus(A, /^live$/, 10000) }, await view(A));
  out.B1_server = serverGroup(TRIP);
  out.B1_rows = app.ledger.query("SELECT id, amount_paise AS paise, deleted_at IS NOT NULL AS deleted FROM expenses WHERE group_code = ? ORDER BY rowid", [TRIP]).map((r) => (r.id === "dinner" || r.id === "deposit" ? r.id : "new") + " " + r.paise + (r.deleted ? " deleted" : ""));

  step("B2");
  // B2. SF-022 offline: the edited Dinner's split becomes Asha and Ben only.
  await setOffline(true);
  await sleep(500);
  await clickText(A, "#ledger-list .expense-row", "Dinner");
  await sleep(400);
  await click(A, "#split-toggle");
  await sleep(200);
  await evaluate(A, `(function(){ const cb = [...document.querySelectorAll("#split-people input")].find(function(i){ return i.parentElement.textContent.indexOf("Chitra") !== -1; }); cb.click(); return true; })()`);
  await sleep(200);
  out.B2_form = await evaluate(A, `({ summary: document.getElementById("split-summary").textContent, count: document.getElementById("split-count").textContent, hint: document.getElementById("split-hint").textContent })`);
  await submit(A, "add-expense-form");
  await sleep(800);
  out.B2_offline = await view(A);
  await setOffline(false);
  out.B2_online = Object.assign({ status: await waitStatus(A, /^live$/, 20000) }, await view(A));
  out.B2_server = serverGroup(TRIP);

  step("B3");
  // B3. SF-028: deleting asks first, naming the item; Cancel keeps it.
  await clickText(A, "#ledger-list .expense-row", "Dinner");
  await sleep(400);
  await click(A, "#exp-delete-btn");
  await sleep(300);
  out.B3_confirm = (await view(A)).confirm;
  await shot(A, "after-390-confirm-delete");
  await click(A, "#confirm-cancel");
  await sleep(300);
  out.B3_afterCancel = { sheet: (await view(A)).sheet, server: serverGroup(TRIP).expenses.length };
  await click(A, "#exp-delete-btn");
  await sleep(300);
  await click(A, "#confirm-ok");
  await sleep(300);
  out.B3_deleted = Object.assign({ status: await waitStatus(A, /^live$/, 10000) }, await view(A));
  out.B3_server = serverGroup(TRIP);

  step("B4");
  // B4. SF-023: "Hotel" ₹300.00, paid by Ben (the form starts on the latest expense's payer, Deposit's),
  // split three ways; Asha pays Ben ₹40.00, then the rest; the ₹40.00 payment is then edited to ₹50.00.
  await click(A, "#add-expense-btn");
  await sleep(400);
  out.B4_addForm = await evaluate(A, `({ payer: document.getElementById("exp-payer-name").textContent, split: document.getElementById("split-summary").textContent })`);
  await type(A, "exp-desc", "Hotel");
  await type(A, "exp-amount", "300");
  await sleep(100);
  out.B4_hint = await evaluate(A, `document.getElementById("split-hint").textContent`);
  await shot(A, "after-390-add-expense");
  await submit(A, "add-expense-form");
  await sleep(300);
  out.B4_hotel = Object.assign({ status: await waitStatus(A, /^live$/, 10000) }, await view(A));
  await clickText(A, "#balances-list .balance-row", "Asha owes Ben");
  await sleep(400);
  out.B4_paySheet = await evaluate(A, `({ title: document.getElementById("sheet-title").textContent, from: document.getElementById("pay-from").textContent,
    to: document.getElementById("pay-to").textContent, amount: document.getElementById("pay-amount").value,
    note: document.getElementById("pay-note").hidden ? null : document.getElementById("pay-note").textContent })`);
  await shot(A, "after-390-record-payment");
  await type(A, "pay-amount", "40");
  out.B4_noteAfterChange = await evaluate(A, `document.getElementById("pay-note").hidden`);
  await submit(A, "pay-form");
  await sleep(300);
  out.B4_part = Object.assign({ status: await waitStatus(A, /^live$/, 10000) }, await view(A));
  await clickText(A, "#balances-list .balance-row", "Asha owes Ben");
  await sleep(400);
  out.B4_restAmount = await evaluate(A, `document.getElementById("pay-amount").value`);
  await submit(A, "pay-form");
  await sleep(300);
  out.B4_rest = Object.assign({ status: await waitStatus(A, /^live$/, 10000) }, await view(A));
  await clickText(A, "#ledger-list .expense-row", "₹40.00");
  await sleep(400);
  out.B4_editPaySheet = await evaluate(A, `({ title: document.getElementById("sheet-title").textContent, amount: document.getElementById("pay-amount").value,
    save: document.getElementById("pay-save-btn").textContent, deleteShown: !document.getElementById("pay-delete-btn").hidden })`);
  await type(A, "pay-amount", "50");
  await submit(A, "pay-form");
  await sleep(300);
  out.B4_edited = Object.assign({ status: await waitStatus(A, /^live$/, 10000) }, await view(A));
  out.B4_server = serverGroup(TRIP);

  step("B5");
  // B5. SF-028 people: a blocked removal says why in place; a free one asks first.
  await click(A, "#add-person-btn");
  await sleep(400);
  await type(A, "person-name", "Zed");
  await submit(A, "add-person-form");
  await sleep(300);
  await waitStatus(A, /^live$/, 10000);
  await evaluate(A, `(function(){ [...document.querySelectorAll("#people-list li")].find(function(l){ return l.textContent.indexOf("Asha") !== -1; }).querySelector("button").click(); return 1; })()`);
  await sleep(300);
  out.B5_blocked = await view(A);
  await shot(A, "after-390-people");
  await evaluate(A, `(function(){ [...document.querySelectorAll("#people-list li")].find(function(l){ return l.textContent.indexOf("Zed") !== -1; }).querySelector("button").click(); return 1; })()`);
  await sleep(300);
  out.B5_confirm = (await view(A)).confirm;
  await click(A, "#confirm-ok");
  await sleep(300);
  await waitStatus(A, /^live$/, 10000);
  out.B5_after = { people: serverGroup(TRIP).people, sheet: (await view(A)).sheet };
  await click(A, "#sheet-close");
  await sleep(300);

  step("B6");
  // B6. SF-028 field errors: an empty form says what's missing under each field, with no pop-up.
  await click(A, "#add-expense-btn");
  await sleep(400);
  await click(A, "#split-everyone");
  await submit(A, "add-expense-form");
  await sleep(300);
  out.B6_errors = Object.assign(await view(A), await evaluate(A, `({ invalid: ["exp-desc", "exp-amount"].map(function(id){ return document.getElementById(id).getAttribute("aria-invalid"); }), splitOpen: !document.getElementById("split-boxes").hidden })`));
  await type(A, "exp-amount", "12.345");
  await submit(A, "add-expense-form");
  await sleep(200);
  out.B6_decimals = (await view(A)).fieldErrors;
  await click(A, "#sheet-close");
  await sleep(300);

  step("B7");
  // B7. SF-029: a second group, then "Switch group" back to the list; neither is forgotten.
  await go(A, "/?g=" + DIWALI, 3000);
  out.B7_diwali = Object.assign({ status: await waitStatus(A, /^live$/, 10000) }, await view(A));
  await click(A, "#menu-btn");
  await sleep(300);
  await click(A, "#switch-group-btn");
  await sleep(2500);
  out.B7_list = Object.assign(await view(A), await evaluate(A, `({ key: localStorage.getItem("splitsheet-group"), stored: JSON.parse(localStorage.getItem("splitfamilia-recent")).map(function(e){ return e.code; }) })`));
  await shot(A, "after-390-your-groups");
  await clickText(A, "#recent-list .group-open", "Check trip");
  await sleep(2500);
  out.B7_opened = { code: await codeOf(A), status: await waitStatus(A, /^live$/, 10000), title: (await view(A)).title };
  await click(A, "#menu-btn");
  await sleep(300);
  await shot(A, "after-390-menu");
  await click(A, "#switch-group-btn");
  await sleep(2500);
  out.B7_order = (await view(A)).recent;

  step("B8");
  // B8. SF-029 "Remove from this device": the other group stays; the group itself is untouched.
  await click(A, "#recent-edit");
  await sleep(200);
  await evaluate(A, `(function(){ document.querySelector("#recent-list .group-remove[aria-label*='Diwali']").click(); return 1; })()`);
  await sleep(800);
  out.B8_after = Object.assign(await view(A), await evaluate(A, `new Promise(function(resolve){
    const req = indexedDB.open("splitfamilia");
    req.onsuccess = function(){ const tx = req.result.transaction("copies", "readonly"); const all = tx.objectStore("copies").getAllKeys();
      all.onsuccess = function(){ resolve({ copies: all.result.length, diwaliCopy: all.result.indexOf(${JSON.stringify(DIWALI)}) !== -1 }); }; };
    req.onerror = function(){ resolve({ copies: "error" }); };
  })`));
  out.B8_serverStillHasIt = serverGroup(DIWALI) !== null;

  step("B9");
  // B9. F-3: two taps at once on the list open one group only.
  await click(A, "#recent-edit");
  await sleep(200);
  await evaluate(A, `(function(){ localStorage.setItem("splitfamilia-recent", JSON.stringify([{ code: ${JSON.stringify(TRIP)}, openedAt: Date.now() }, { code: ${JSON.stringify(LAKE)}, openedAt: Date.now() - 86400000 }])); return 1; })()`);
  await go(A, "/", 2500);
  const streamsBefore = streamsOpened;
  await evaluate(A, `(function(){ const b = document.querySelectorAll("#recent-list .group-open"); b[0].click(); b[1].click(); return b.length; })()`);
  await sleep(3000);
  out.B9 = { code: await codeOf(A), title: (await view(A)).title, status: await status(A),
    streams: streamsOpened - streamsBefore };

  step("B10");
  // B10. N-8: an offline open of a group this phone never read says so, and holds the forms.
  await evaluate(A, `(function(){ localStorage.removeItem("splitsheet-group"); return 1; })()`);
  await setOffline(true);
  await sleep(300);
  await go(A, "/?g=" + LAKE, 3000);
  out.B10_offline = Object.assign(await view(A), await evaluate(A, `({ addPerson: document.getElementById("add-person-btn").disabled })`));
  await shot(A, "after-390-not-loaded");
  await setOffline(false);
  out.B10_online = Object.assign({ status: await waitStatus(A, /^live$/, 20000) }, await view(A));

  step("B11");
  // B11. F-12: on a code no group has, the currency can't be changed, offline or online.
  const typo = "check-typo-trip";
  await setOffline(true);
  await sleep(300);
  await go(A, "/?g=" + typo, 3000);
  await click(A, "#menu-btn");
  await sleep(300);
  out.B11_offline = Object.assign(await evaluate(A, `({ currencyDisabled: document.getElementById("currency-input").disabled })`), { status: await status(A) });
  await type(A, "currency-input", "$");
  await sleep(300);
  out.B11_afterTry = await status(A);
  await click(A, "#sheet-close");
  await setOffline(false);
  await sleep(6000);
  out.B11_online = Object.assign(await view(A), { serverGroup: serverGroup(typo) });

  step("B12");
  // B12. F-11 (the T-09 review's R3): a group started offline in tab A, opened in tab B before its
  // create is sent: once online, both tabs go live without a reload.
  await evaluate(A, `(function(){ localStorage.removeItem("splitsheet-group"); return 1; })()`);
  await go(A, "/", 2000);
  const createsBefore = served.filter((s) => s.startsWith("PUT /api/group")).length;
  await setOffline(true);
  await sleep(300);
  await click(A, "#start-group-btn");
  await sleep(200);
  await type(A, "new-group-name", "Hike");
  await submit(A, "new-group-form");
  await sleep(800);
  const hike = await codeOf(A);
  B = await newTab();
  await viewport(B, 390, 844, 1);
  await go(B, "/?g=" + hike, 2500);
  out.B12_offline = { A: await status(A), B: await status(B), notLoadedA: (await view(A)).notLoaded, guideA: (await view(A)).guide };
  await setOffline(false);
  out.B12_online = { A: await waitStatus(A, /^live$/, 25000), B: await waitStatus(B, /^live$/, 25000) };
  out.B12_server = { group: serverGroup(hike) !== null, creates: served.filter((s) => s.startsWith("PUT /api/group")).length - createsBefore };

  step("B13");
  // B13. SF-028 guide: add people → first expense → (started here) invite, until copied.
  await click(A, "#guide-go");
  await sleep(300);
  for (const name of ["Asha", "Ben"]) {
    await type(A, "person-name", name);
    await submit(A, "add-person-form");
    await sleep(300);
  }
  await click(A, "#sheet-close");
  await sleep(300);
  await waitStatus(A, /^live$/, 10000);
  out.B13_step2 = (await view(A)).guide;
  await click(A, "#guide-go");
  await sleep(300);
  await type(A, "exp-desc", "Bus");
  await type(A, "exp-amount", "90");
  await submit(A, "add-expense-form");
  await sleep(300);
  await waitStatus(A, /^live$/, 10000);
  out.B13_step3 = (await view(A)).guide;
  await shot(A, "after-390-guide-invite");
  await send("Page.bringToFront", {}, A); // the clipboard takes text only from the page in front
  await click(A, "#guide-go");
  await sleep(500);
  out.B13_copied = { guide: (await view(A)).guide, clipboard: await evaluate(A, `navigator.clipboard.readText().then(function(t){ return new URL(t).searchParams.get("g") === new URL(location.href).searchParams.get("g"); })`) };
  await sleep(1800);
  out.B13_afterCopy = (await view(A)).guide;
  await go(A, "/?g=" + hike, 3000);
  out.B13_reloaded = (await view(A)).guide;
  await viewport(B, 390, 844, 1);
  await send("Page.bringToFront", {}, B);
  out.B13_tabB = { status: await waitStatus(B, /^live$/, 10000), guide: (await view(B)).guide };

  step("B14");
  // B14. SF-028 layout: no sideways scroll and no control under 44 × 44 at each width, on each screen.
  out.B14 = {};
  await go(A, "/?g=" + TRIP, 3000);
  await waitStatus(A, /^live$/, 10000);
  for (const [w, h] of [[360, 740], [390, 844], [412, 915], [768, 1024]]) {
    await viewport(A, w, h, 1);
    await sleep(300);
    const r = { home: await evaluate(A, WIDE), homeSmall: await evaluate(A, SMALL) };
    for (const [opener, name] of [["#menu-btn", "menu"], ["#people-btn", "people"], ["#add-expense-btn", "add"], ["#balances-list .balance-row", "pay"]]) {
      await click(A, opener);
      await sleep(350);
      if (name === "add") { await click(A, "#split-toggle"); await sleep(150); }
      r[name] = await evaluate(A, WIDE);
      r[name + "Small"] = await evaluate(A, SMALL);
      await click(A, "#sheet-close");
      await sleep(300);
    }
    out.B14[w] = r;
  }
  await viewport(A, 768, 1024, 1);
  await shot(A, "after-768-home");
  await evaluate(A, `(function(){ localStorage.removeItem("splitsheet-group"); return 1; })()`);
  for (const [w, h] of [[360, 740], [390, 844], [412, 915], [768, 1024]]) {
    await viewport(A, w, h, 1);
    await go(A, "/", 1500);
    out.B14[w].welcome = await evaluate(A, WIDE);
    out.B14[w].welcomeSmall = await evaluate(A, SMALL);
    for (const [opener, name] of [["#start-group-btn", "newGroup"], ["#join-link-btn", "join"]]) {
      await click(A, opener);
      await sleep(350);
      out.B14[w][name] = await evaluate(A, WIDE);
      out.B14[w][name + "Small"] = await evaluate(A, SMALL);
      await click(A, "#sheet-close");
      await sleep(300);
    }
  }
  await viewport(A, 390, 844, 2);

  step("B15");
  // B15. The ledger writes the year only when it isn't this year; the worker is the v7 one.
  await go(A, "/?g=" + TRIP, 3000);
  out.B15 = Object.assign({ ledger: (await view(A)).ledger }, await evaluate(A, `caches.keys().then(function(k){ return { caches: k }; })`));

  step("B16");
  // B16. SF-028: every input and select on the page has a label (or, for none here, an aria-label),
  // and the dialogs are real dialogs.
  out.B16 = await evaluate(A, `(function(){
    const missing = [...document.querySelectorAll("input, select")].filter(function(e){
      return !(e.labels && e.labels.length) && !e.getAttribute("aria-label");
    }).map(function(e){ return e.id || e.type; });
    return { inputs: document.querySelectorAll("input, select").length, missing: missing,
      dialogs: [...document.querySelectorAll("dialog")].map(function(d){ return d.id + ":" + (d.getAttribute("role") || "dialog") + ":" + (d.getAttribute("aria-labelledby") || ""); }) };
  })()`);

  step("B17");
  // B17. SF-038 still holds: on a GitHub Pages address the page only points to the new home.
  await go(A, "http://" + PAGES_HOST + ":" + app.server.address().port + "/?g=" + TRIP, 2500);
  out.B17 = await evaluate(A, `({ moved: !document.getElementById("moved-screen").hidden, app: !document.getElementById("app-shell").hidden,
    welcome: !document.getElementById("join-screen").hidden, link: document.getElementById("moved-link").href })`);
  await shot(A, "after-390-moved");
} catch (e) {
  out.failure = String(e && e.stack || e);
}
out.dialogs = dialogs;
out.errors = errors;
out.timeouts = timeouts;
out.refusals = served.filter((s) => / → (4\d\d|5\d\d)$/.test(s) && !/^GET \/api\/group(\/events)? → 404$/.test(s));
console.log(JSON.stringify(out, null, 1));
try { await send("Browser.close"); } catch {}
await sleep(500);
try { edge.kill(); } catch {}
await app.close();
