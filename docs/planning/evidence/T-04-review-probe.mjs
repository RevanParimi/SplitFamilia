// T-04 review probe (evidence only, not part of `npm test`): hostile and cross-version cases the
// implementation's browser check (B0-B17) doesn't cover. Everything runs locally: the real server
// on 127.0.0.1 with temporary databases, headless Edge over CDP. No real group or database.
//   node T-04-review-probe.mjs <repoDir> <v6Dir> <empty scratch dir> [<screenshot dir>]
// <v6Dir> holds db0580b's page files and server/ (LF), plus a copy of recent-groups.js (the new
// server's file list names it; the v6 page never loads it).
// Prints one JSON object. The expected values are worked out by hand in evidence/T-04-review.md.
//   P1 rolling back: db0580b's db.js opens a database that has migration 2, a settle-up and an edit
//   P2 a v6 page (still on phones until its worker updates) reads a group with a settle-up and an edit
//   P3 hostile text at 360 px: 60-character names, a 200-character description, markup in text
//   P4 an offline edit that another phone's delete beats, refused while a sheet is open
//   P5 "Remove from this device" with a change still waiting, then another group online
//   P6 a settle-up recorded offline and edited offline: two waiting changes, one payment on the server
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repoArg, v6Arg, scratch, shotsArg] = process.argv.slice(2);
const repoDir = path.resolve(repoArg);
const v6Dir = path.resolve(v6Arg);
const shotsDir = shotsArg ? path.resolve(shotsArg) : null;
fs.mkdirSync(scratch, { recursive: true });
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const { createApp } = await import(pathToFileURL(path.join(repoDir, "server", "server.js")).href);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (name) => process.stderr.write(new Date().toISOString().slice(11, 19) + " " + name + "\n");
const out = {};
const PEOPLE = [["p-asha", "Asha"], ["p-ben", "Ben"], ["p-chitra", "Chitra"]];

// ---------- P1: rolling back to db0580b's server on a database T-04 has used ----------
step("P1");
{
  const newDb = await import(pathToFileURL(path.join(repoDir, "server", "db.js")).href);
  const oldDb = await import(pathToFileURL(path.join(v6Dir, "server", "db.js")).href);
  const file = path.join(scratch, "rollback.db");
  const code = "rollback-trip-a9a9ijkeit";
  let L = newDb.openLedger(file);
  L.setCurrency(code, "₹");
  for (const [id, name] of PEOPLE) L.addPerson(code, { id, name });
  L.addExpense(code, { id: "hotel", date: "2026-09-29T10:00:00.000Z", desc: "Hotel", amountPaise: 30000, paidBy: "p-ben", split: ["p-asha", "p-ben", "p-chitra"] });
  L.addExpense(code, { id: "pay1", date: "2026-09-30T10:00:00.000Z", desc: "Payment", amountPaise: 4000, paidBy: "p-asha", split: ["p-ben"], kind: "settlement" });
  const edit = L.replaceExpense(code, "pay1", { id: "pay2", date: "2026-09-30T10:00:00.000Z", desc: "Payment", amountPaise: 10000, paidBy: "p-asha", split: ["p-ben"], kind: "settlement" });
  const before = L.readGroup(code);
  L.close();
  L = oldDb.openLedger(file); // the old server starting on it
  const oldRead = L.readGroup(code);
  const added = L.addExpense(code, { id: "taxi", date: "2026-10-01T10:00:00.000Z", desc: "Taxi", amountPaise: 900, paidBy: "p-chitra", split: ["p-asha", "p-ben", "p-chitra"] });
  const oldAfter = L.readGroup(code);
  const schema = L.query ? L.query("SELECT version FROM schema_version") : null;
  L.close();
  L = newDb.openLedger(file); // and forward again
  const again = L.readGroup(code);
  L.close();
  const brief = (g) => ({ version: g.version, expenses: g.expenses.map((e) => (e.kind ? "[" + e.kind + "] " : "") + e.id + " " + e.amountPaise + " " + e.paidBy + ">" + e.split.join("+")) });
  out.P1 = { edit, newRead: brief(before), oldRead: brief(oldRead), oldAdded: added, oldAfter: brief(oldAfter), schema, forwardAgain: brief(again) };
}

// ---------- the servers under test: T-04's page, and the v6 page on T-04's server ----------
const servers = [];
async function serve(root, db){
  const app = createApp({ root, dbFile: path.join(scratch, db), log: () => {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  servers.push(app);
  return { app, base: "http://127.0.0.1:" + app.server.address().port };
}
const NEW = await serve(repoDir, "new.db");
const OLD = await serve(v6Dir, "v6.db");

// ---------- P7: PC-009 steps 3-4 rehearsed: T-04's server, and db0580b's own server (the live one) ----------
step("P7");
{
  const { createApp: createOldApp } = await import(pathToFileURL(path.join(v6Dir, "server", "server.js")).href);
  const live = createOldApp({ root: v6Dir, dbFile: path.join(scratch, "live-v6.db"), log: () => {} });
  await new Promise((r) => live.server.listen(0, "127.0.0.1", r));
  const probe = async (base) => {
    const code = "pc009-probe-a9a9ijkeit";
    const body = { id: "pc009-probe-new", date: "2026-10-01T00:00:00.000Z", desc: "Probe", amountPaise: 100, paidBy: "p-a", split: ["p-a"] };
    const put = await fetch(base + "/api/expenses/pc009-probe", { method: "PUT", headers: { "X-Group-Code": code, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const get = await fetch(base + "/api/group", { headers: { "X-Group-Code": code } });
    return { put: put.status + " " + (await put.text()), get: get.status + " " + (await get.text()) };
  };
  out.P7_newServer = await probe(NEW.base);
  out.P7_newServerHasGroup = NEW.app.ledger.groupVersion("pc009-probe-a9a9ijkeit") !== null;
  out.P7_liveV6Server = await probe("http://127.0.0.1:" + live.server.address().port);
  await live.close();
}
const phone = (srv, code) => async (method, p, body) => {
  const res = await fetch(srv.base + p, { method, headers: { "X-Group-Code": code, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return res.status;
};
const serverGroup = (srv, code) => srv.app.ledger.groupVersion(code) === null ? null : (function(g){
  return { currency: g.currency, version: g.version, people: g.people.map((p) => p.name),
    expenses: g.expenses.map((e) => (e.kind ? "[" + e.kind + "] " : "") + e.desc.slice(0, 24) + " " + e.amountPaise + " " + e.paidBy + ">" + e.split.join("+")) };
})(srv.app.ledger.readGroup(code));
async function makeGroup(srv, code, people, expenses){
  const p = phone(srv, code);
  await p("PUT", "/api/group", { currency: "₹" });
  for (const [id, name] of people) await p("POST", "/api/people", { id, name });
  for (const e of expenses) await p("POST", "/api/expenses", e);
}

const V6 = "old-page-trip-a9a9ijkeit";
await makeGroup(OLD, V6, PEOPLE, [
  { id: "hotel", date: "2026-09-29T10:00:00.000Z", desc: "Hotel", amountPaise: 30000, paidBy: "p-ben", split: ["p-asha", "p-ben", "p-chitra"] },
  { id: "pay", date: "2026-09-30T10:00:00.000Z", desc: "Payment", amountPaise: 10000, paidBy: "p-asha", split: ["p-ben"], kind: "settlement" },
  { id: "dinner", date: "2026-09-30T15:00:00.000Z", desc: "Dinner", amountPaise: 120000, paidBy: "p-asha", split: ["p-asha", "p-ben"] }
]);
out.P2_editStatus = await phone(OLD, V6)("PUT", "/api/expenses/dinner", { id: "dinner-2", date: "2026-09-30T15:00:00.000Z", desc: "Dinner", amountPaise: 150000, paidBy: "p-asha", split: ["p-asha", "p-ben"] });

const LONG_NAME = "Wolfeschlegelsteinhausenbergerdorffvoralternwarengewissenhaf"; // 60, no spaces
const MARKUP_NAME = "<b>Chitra</b>";
const LONG_DESC = "Supercalifragilisticexpialidocious".repeat(6).slice(0, 200); // 200, no spaces
const MARKUP_DESC = "<img src=x onerror=\"window.__pwned=1\">";
const HOSTILE = "a-very-long-family-group-name-for-the-hills-and-back-again-trip-a9a9ijkeit";
await makeGroup(NEW, HOSTILE, [["p-asha", "Asha"], ["p-long", LONG_NAME], ["p-markup", MARKUP_NAME]], [
  { id: "long", date: "2026-09-29T10:00:00.000Z", desc: LONG_DESC, amountPaise: 999999999, paidBy: "p-long", split: ["p-asha", "p-long", "p-markup"] },
  { id: "markup", date: "2026-09-30T10:00:00.000Z", desc: MARKUP_DESC, amountPaise: 1001, paidBy: "p-markup", split: ["p-asha", "p-markup"] }
]);
const RACE = "race-trip-a9a9ijkeit";
await makeGroup(NEW, RACE, PEOPLE.slice(0, 2), [
  { id: "dinner", date: "2026-09-30T15:00:00.000Z", desc: "Dinner", amountPaise: 30000, paidBy: "p-asha", split: ["p-asha", "p-ben"] }
]);
const WAIT = "waiting-trip-a9a9ijkeit";
await makeGroup(NEW, WAIT, PEOPLE.slice(0, 2), []);
const SETTLE = "settle-trip-a9a9ijkeit";
await makeGroup(NEW, SETTLE, PEOPLE.slice(0, 2), [
  { id: "hotel", date: "2026-09-30T10:00:00.000Z", desc: "Hotel", amountPaise: 20000, paidBy: "p-ben", split: ["p-asha", "p-ben"] }
]);

// ---------- headless Edge ----------
const port = 9500 + Math.floor(Math.random() * 150);
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
const go = async (tab, url, wait = 2500) => { await send("Page.navigate", { url }, tab); await sleep(wait); };
const viewport = (tab, width, height, dpr = 1) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: true }, tab);
async function shot(tab, name){
  if (!shotsDir) return;
  await send("Page.bringToFront", {}, tab);
  await sleep(150);
  const res = await send("Page.captureScreenshot", { format: "png" }, tab);
  if (res.result && res.result.data) fs.writeFileSync(path.join(shotsDir, name + ".png"), Buffer.from(res.result.data, "base64"));
}
const status = (tab) => evaluate(tab, `(document.getElementById("group-status") || {}).textContent || null`);
async function waitStatus(tab, re, ms){
  const until = Date.now() + ms;
  let s = "";
  while (Date.now() < until) { s = await status(tab); if (re.test(s || "")) return s; await sleep(200); }
  return "TIMED OUT at: " + s;
}
const click = (tab, sel) => evaluate(tab, `(function(){ const e = document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error("no " + ${JSON.stringify(sel)}); e.click(); return true; })()`);
const clickText = (tab, sel, text) => evaluate(tab, `(function(){
  const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) !== -1; });
  if(!e) throw new Error("no " + ${JSON.stringify(sel + " " + text)}); e.click(); return true; })()`);
const type = (tab, id, value) => evaluate(tab, `(function(){ const e = document.getElementById(${JSON.stringify(id)}); e.value = ${JSON.stringify(value)};
  e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
const submit = (tab, id) => evaluate(tab, `(function(){ document.getElementById(${JSON.stringify(id)}).requestSubmit(); return true; })()`);
const VIEW = `(function(){
  const vis = function(id){ const e = document.getElementById(id); return Boolean(e) && !e.hidden && e.getClientRects().length > 0; };
  const text = function(e){ return e ? e.textContent.replace(/\\s+/g, " ").trim() : null; };
  return {
    title: text(document.getElementById("group-name")),
    status: text(document.getElementById("group-status")),
    balances: vis("balances-section") ? [...document.querySelectorAll("#balances-list .balance-row .balance-who, #balances-list .balance-row .balance-amt, #balances-list .settled-title")].map(text) : null,
    ledger: vis("ledger-section") ? [...document.querySelectorAll("#ledger-list .expense-row")].map(function(r){
      return text(r.querySelector(".row-title")).slice(0, 40) + " | " + text(r.querySelector(".row-sub")).slice(0, 60) + " | " + text(r.querySelector(".row-amt")) + (r.querySelector(".pill-waiting") ? " | waiting" : "");
    }) : null,
    sheet: document.getElementById("sheet").open ? text(document.getElementById("sheet-title")) : null,
    notice: document.getElementById("notice").hidden ? null : text(document.getElementById("notice-text")),
    recent: vis("recent-section") ? [...document.querySelectorAll("#recent-list .group-open")].map(function(b){ return text(b.querySelector(".row-title")) + " | " + text(b.querySelector(".row-sub")); }) : null
  };
})()`;
const view = (tab) => evaluate(tab, VIEW);
// Sideways scroll, and every visible element wider than the viewport or sticking out of it.
const WIDE = `(function(){
  const w = innerWidth;
  const over = [];
  document.querySelectorAll("body *").forEach(function(e){
    if(e.closest("[hidden]") || e.getClientRects().length === 0) return;
    if(e.closest("dialog") && !e.closest("dialog").open) return;
    const r = e.getBoundingClientRect();
    if(r.right > w + 0.5 || r.left < -0.5) over.push((e.id || e.className || e.tagName).toString().slice(0, 30) + " " + Math.round(r.left) + ".." + Math.round(r.right));
  });
  return { scroll: document.documentElement.scrollWidth > w ? document.documentElement.scrollWidth + " > " + w : "ok", over: over.slice(0, 8) };
})()`;

let T = null;
try {
  T = await newTab();
  await viewport(T, 360, 740, 2);

  // ---------- P2: the v6 page on T-04's server ----------
  step("P2");
  await go(T, OLD.base + "/?g=" + V6, 4000);
  out.P2_v6 = await evaluate(T, `(function(){
    const t = function(id){ const e = document.getElementById(id); return e ? e.innerText.replace(/\\s+/g, " ").trim() : null; };
    return { cache: null, status: t("group-status"), balances: t("balances-list"), ledger: t("ledger-list") };
  })()`);
  out.P2_v6.caches = await evaluate(T, `caches.keys()`);

  // ---------- P3: hostile text at 360 px ----------
  step("P3");
  await go(T, NEW.base + "/?g=" + HOSTILE, 4000);
  out.P3_status = await waitStatus(T, /^live$/, 10000);
  out.P3_home = Object.assign(await view(T), { wide: await evaluate(T, WIDE) });
  await shot(T, "review-360-hostile-home");
  await click(T, "#people-btn"); await sleep(400);
  out.P3_people = await evaluate(T, WIDE);
  await shot(T, "review-360-hostile-people");
  await click(T, "#sheet-close"); await sleep(300);
  await clickText(T, "#ledger-list .expense-row", "Supercali"); await sleep(400);
  out.P3_edit = { wide: await evaluate(T, WIDE), amount: await evaluate(T, `document.getElementById("exp-amount").value`), payer: await evaluate(T, `document.getElementById("exp-payer-name").textContent`) };
  await shot(T, "review-360-hostile-edit");
  await click(T, "#exp-delete-btn"); await sleep(400);
  out.P3_confirm = { title: await evaluate(T, `document.getElementById("confirm-title").textContent.length`), wide: await evaluate(T, WIDE) };
  await shot(T, "review-360-hostile-confirm");
  await click(T, "#confirm-cancel"); await sleep(200);
  await click(T, "#sheet-close"); await sleep(300);
  await click(T, "#balances-list .balance-row"); await sleep(400);
  out.P3_pay = { wide: await evaluate(T, WIDE), from: await evaluate(T, `document.getElementById("pay-from").textContent`), to: await evaluate(T, `document.getElementById("pay-to").textContent`) };
  await shot(T, "review-360-hostile-pay");
  await click(T, "#sheet-close"); await sleep(300);
  out.P3_markup = await evaluate(T, `({ pwned: window.__pwned === 1, imgs: document.querySelectorAll("#app-shell img, #sheet img").length, bold: document.querySelectorAll("#app-shell b").length,
    nameShown: document.body.innerText.indexOf("<b>Chitra</b>") !== -1, descShown: document.body.innerText.indexOf("<img src=x") !== -1 })`);
  await click(T, "#menu-btn"); await sleep(400);
  out.P3_menu = await evaluate(T, WIDE);
  await click(T, "#switch-group-btn"); await sleep(2500);
  out.P3_welcome = Object.assign(await view(T), { wide: await evaluate(T, WIDE) });
  await shot(T, "review-360-hostile-welcome");

  // ---------- P4: an offline edit beaten by another phone's delete, refused under an open sheet ----------
  step("P4");
  await go(T, NEW.base + "/?g=" + RACE, 3000);
  out.P4_before = Object.assign({ status: await waitStatus(T, /^live$/, 10000) }, await view(T));
  await setOffline(true); await sleep(500);
  await clickText(T, "#ledger-list .expense-row", "Dinner"); await sleep(400);
  await type(T, "exp-amount", "400");
  await submit(T, "add-expense-form"); await sleep(600);
  out.P4_offline = await view(T);
  out.P4_otherPhoneDelete = await phone(NEW, RACE)("DELETE", "/api/expenses/dinner");
  await click(T, "#add-expense-btn"); await sleep(400);
  await setOffline(false);
  for (let i = 0; i < 60; i++) { if ((await view(T)).notice) break; await sleep(250); }
  out.P4_refusedWithSheetOpen = Object.assign(await view(T), await evaluate(T, `(function(){
    const n = document.getElementById("notice"); const r = n.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { noticeOnTop: Boolean(hit) && n.contains(hit), hitIs: hit ? (hit.id || hit.tagName) : null };
  })()`));
  await shot(T, "review-390-notice-under-sheet");
  await click(T, "#sheet-close"); await sleep(400);
  out.P4_afterClose = Object.assign({ status: await waitStatus(T, /^live$/, 10000) }, await view(T), await evaluate(T, `(function(){
    const n = document.getElementById("notice"); const r = n.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { noticeOnTop: Boolean(hit) && n.contains(hit) };
  })()`));
  out.P4_server = serverGroup(NEW, RACE);

  // ---------- P5: "Remove from this device" with a change waiting, then another group online ----------
  step("P5");
  await go(T, NEW.base + "/?g=" + WAIT, 3000);
  out.P5_live = await waitStatus(T, /^live$/, 10000);
  await setOffline(true); await sleep(500);
  await click(T, "#add-expense-btn"); await sleep(400);
  await type(T, "exp-desc", "Taxi");
  await type(T, "exp-amount", "500");
  await submit(T, "add-expense-form"); await sleep(600);
  out.P5_offline = await view(T);
  await click(T, "#menu-btn"); await sleep(300);
  await click(T, "#switch-group-btn"); await sleep(3000);
  out.P5_welcomeOffline = await view(T);
  await click(T, "#recent-edit"); await sleep(200);
  await evaluate(T, `(function(){ const b = document.querySelector('[aria-label="Remove Waiting trip from this device"]'); if(!b) throw new Error("no remove button"); b.click(); return true; })()`);
  await sleep(500);
  await click(T, "#recent-edit"); await sleep(200);
  out.P5_afterRemove = await view(T);
  await clickText(T, "#recent-list .group-open", "Race trip"); await sleep(2500);
  out.P5_otherGroupOffline = await view(T);
  await setOffline(false);
  out.P5_otherGroupOnline = Object.assign({ status: await waitStatus(T, /^live$/, 20000) }, await view(T));
  await sleep(1000);
  out.P5_serverWaitingGroup = serverGroup(NEW, WAIT);
  out.P5_store = await evaluate(T, `new Promise(function(resolve){
    const req = indexedDB.open("splitfamilia");
    req.onerror = function(){ resolve("no db"); };
    req.onsuccess = function(){
      const db = req.result; const names = [...db.objectStoreNames];
      const t = db.transaction(names, "readonly"); const res = {};
      names.forEach(function(n){ const r = t.objectStore(n).getAllKeys(); r.onsuccess = function(){ res[n] = r.result.map(String); }; });
      t.oncomplete = function(){ resolve(res); };
    };
  })`);

  // ---------- P6: a settle-up recorded and edited offline ----------
  step("P6");
  await go(T, NEW.base + "/?g=" + SETTLE, 3000);
  out.P6_before = Object.assign({ status: await waitStatus(T, /^live$/, 10000) }, await view(T));
  await setOffline(true); await sleep(500);
  await click(T, "#balances-list .balance-row"); await sleep(400);
  out.P6_prefill = await evaluate(T, `document.getElementById("pay-amount").value`);
  await type(T, "pay-amount", "30");
  await submit(T, "pay-form"); await sleep(600);
  await click(T, "#ledger-list .expense-row.payment"); await sleep(400);
  await type(T, "pay-amount", "45");
  await submit(T, "pay-form"); await sleep(600);
  out.P6_offline = await view(T);
  await setOffline(false);
  out.P6_online = Object.assign({ status: await waitStatus(T, /^live$/, 20000) }, await view(T));
  out.P6_server = serverGroup(NEW, SETTLE);
  out.P6_serverRows = NEW.app.ledger.query("SELECT amount_paise, kind, deleted_at IS NOT NULL AS deleted FROM expenses WHERE group_code = ? ORDER BY rowid", [SETTLE]);
} catch (e) {
  out.crash = String(e && e.stack || e).slice(0, 600);
} finally {
  out.dialogs = dialogs;
  out.errors = errors;
  out.timeouts = timeouts;
  try { await send("Browser.close"); } catch {}
  try { edge.kill(); } catch {}
  for (const app of servers) await app.close();
}
console.log(JSON.stringify(out, null, 1));
process.exit(0);
