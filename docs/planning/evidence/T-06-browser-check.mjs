// T-06 browser check (evidence only, not part of `npm test`): a dry run of RELEASE_TESTING.md's
// checklist (SF-019) on the real page and server, plus the privacy page and its links (SF-018) and
// the message bar above an open sheet (the T-04 review's F-14). Everything is local: the real
// server on 127.0.0.1 with a temporary database, headless Edge over CDP. No real group or data.
//   node T-06-browser-check.mjs <repoDir> <empty scratch dir> [<screenshot dir>]
// Prints one JSON object. Each key is a checklist test number; the expected values are the
// guide's, worked out by hand there and in the T-06 receipt.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repoArg, scratch, shotsArg] = process.argv.slice(2);
const repoDir = path.resolve(repoArg);
const shotsDir = shotsArg ? path.resolve(shotsArg) : null;
fs.mkdirSync(scratch, { recursive: true });
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const { createApp } = await import(pathToFileURL(path.join(repoDir, "server", "server.js")).href);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (name) => process.stderr.write(new Date().toISOString().slice(11, 19) + " " + name + "\n");
const out = {};

// ---------- the server ----------
const app = createApp({ root: repoDir, dbFile: path.join(scratch, "check.db"), log: () => {} });
await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + app.server.address().port;
// "The computer": a second device in the same group, straight to the API.
const computer = (code) => async (method, p, body) => {
  const res = await fetch(BASE + p, { method, headers: { "X-Group-Code": code, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return res.status;
};
const serverGroup = (code) => app.ledger.groupVersion(code) === null ? null : app.ledger.readGroup(code);

// ---------- headless Edge ----------
const port = 9300 + Math.floor(Math.random() * 150);
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
const J = JSON.stringify;
const click = (tab, sel) => evaluate(tab, `(function(){ const e = document.querySelector(${J(sel)}); if(!e) throw new Error("no " + ${J(sel)}); e.click(); return true; })()`);
const clickText = (tab, sel, text) => evaluate(tab, `(function(){
  const e = [...document.querySelectorAll(${J(sel)})].find(function(x){ return x.textContent.replace(/\\s+/g, " ").indexOf(${J(text)}) !== -1; });
  if(!e) throw new Error("no " + ${J(sel + " " + text)}); e.click(); return true; })()`);
const type = (tab, id, value) => evaluate(tab, `(function(){ const e = document.getElementById(${J(id)}); e.value = ${J(value)};
  e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
const submit = (tab, id) => evaluate(tab, `(function(){ document.getElementById(${J(id)}).requestSubmit(); return true; })()`);
const payer = (tab, name) => evaluate(tab, `(function(){ const s = document.getElementById("exp-paidby");
  const o = [...s.options].find(function(x){ return x.textContent === ${J(name)}; }); if(!o) throw new Error("no payer " + ${J(name)});
  s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
const untick = (tab, name) => evaluate(tab, `(function(){
  const l = [...document.querySelectorAll("#split-people label")].find(function(x){ return x.querySelector(".name").textContent === ${J(name)}; });
  if(!l) throw new Error("no split row " + ${J(name)}); const cb = l.querySelector("input"); if(cb.checked) cb.click(); return true; })()`);
const text = (tab, id) => evaluate(tab, `(function(){ const e = document.getElementById(${J(id)}); return e && !e.hidden ? e.textContent.replace(/\\s+/g, " ").trim() : null; })()`);
const VIEW = `(function(){
  const vis = function(id){ const e = document.getElementById(id); return Boolean(e) && !e.hidden && e.getClientRects().length > 0; };
  const t = function(e){ return e ? e.textContent.replace(/\\s+/g, " ").trim() : null; };
  return {
    title: t(document.getElementById("group-name")),
    status: t(document.getElementById("group-status")),
    people: t(document.getElementById("people-count")),
    guide: vis("guide") ? t(document.getElementById("guide-step")) + " | " + t(document.getElementById("guide-title")) : null,
    balances: vis("balances-section") ? [...document.querySelectorAll("#balances-list .balance-row")].map(function(r){ return t(r.querySelector(".balance-who")) + " " + t(r.querySelector(".balance-amt")); })
      .concat([...document.querySelectorAll("#balances-list .settled-title, #balances-list .settled-sub")].map(t)) : null,
    ledger: vis("ledger-section") ? [...document.querySelectorAll("#ledger-list .expense-row")].map(function(r){
      return t(r.querySelector(".row-title")) + " | " + t(r.querySelector(".row-sub")).replace(/^\\d+ \\w+ · /, "") + " | " + t(r.querySelector(".row-amt")) + (r.querySelector(".pill-waiting") ? " | waiting to sync" : "");
    }) : null,
    sheet: document.getElementById("sheet").open ? t(document.getElementById("sheet-title")) : null,
    notice: document.getElementById("notice").hidden ? null : t(document.getElementById("notice-text"))
  };
})()`;
const view = (tab) => evaluate(tab, VIEW);
const WIDE = `(function(){
  const w = innerWidth; const over = [];
  document.querySelectorAll("body *").forEach(function(e){
    if(e.closest("[hidden]") || e.getClientRects().length === 0) return;
    if(e.closest("dialog") && !e.closest("dialog").open) return;
    const r = e.getBoundingClientRect();
    if(r.right > w + 0.5 || r.left < -0.5) over.push((e.id || e.className || e.tagName).toString().slice(0, 30) + " " + Math.round(r.left) + ".." + Math.round(r.right));
  });
  return { scroll: document.documentElement.scrollWidth > w ? document.documentElement.scrollWidth + " > " + w : "ok", over: over.slice(0, 8) };
})()`;
async function waitFor(tab, expr, ms){
  const until = Date.now() + ms;
  let v;
  while (Date.now() < until) { v = await evaluate(tab, expr); if (v) return v; await sleep(200); }
  return "TIMED OUT: " + J(v);
}
const waitStatus = (tab, re, ms) => waitFor(tab, `(function(){ const s = (document.getElementById("group-status") || {}).textContent || ""; return ${re}.test(s) ? s : ""; })()`, ms);
const code = (tab) => evaluate(tab, `new URL(location.href).searchParams.get("g")`);
const idOf = (c, name) => serverGroup(c).people.find((p) => p.name === name).id;
// Adds an expense through the sheet, as a person would. `only`: the names to leave ticked.
async function addExpense(tab, desc, amount, paidBy, only){
  await click(tab, "#add-expense-btn"); await sleep(350);
  await type(tab, "exp-desc", desc);
  await type(tab, "exp-amount", amount);
  await payer(tab, paidBy);
  if (only) {
    await click(tab, "#split-toggle"); await sleep(150);
    const all = await evaluate(tab, `[...document.querySelectorAll("#split-people .name")].map(function(n){ return n.textContent; })`);
    for (const n of all) if (!only.includes(n)) await untick(tab, n);
  }
  const hint = await text(tab, "split-hint");
  await submit(tab, "add-expense-form"); await sleep(600);
  return hint;
}
async function addPeople(tab, names){
  await click(tab, "#add-person-btn"); await sleep(350);
  for (const n of names) { await type(tab, "person-name", n); await submit(tab, "add-person-form"); await sleep(250); }
  await click(tab, "#sheet-close"); await sleep(350);
}
async function switchGroup(tab){
  await click(tab, "#menu-btn"); await sleep(300);
  await click(tab, "#switch-group-btn"); await sleep(2500);
}
async function confirmDelete(tab, rowText){
  await clickText(tab, "#ledger-list .expense-row", rowText); await sleep(350);
  const sheetTitle = await text(tab, "sheet-title");
  await click(tab, sheetTitle === "Edit payment" ? "#pay-delete-btn" : "#exp-delete-btn"); await sleep(300);
  const title = await text(tab, "confirm-title");
  await click(tab, "#confirm-ok"); await sleep(600);
  return title;
}
// Where the message bar is, whether it is the topmost thing at its centre, and whether it is in
// the top layer (a shown popover).
const NOTICE = `(function(){
  const n = document.getElementById("notice"); const r = n.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const x = document.getElementById("notice-close").getBoundingClientRect();
  return { shown: !n.hidden, popoverOpen: n.matches(":popover-open"), inside: n.parentNode.id || n.parentNode.tagName, noticeOnTop: Boolean(hit) && n.contains(hit), hitIs: hit ? (hit.id || hit.tagName) : null,
    box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], closeAt: [x.left + x.width / 2, x.top + x.height / 2],
    sheetOpen: document.getElementById("sheet").open };
})()`;
// Is the element ignored by the accessibility tree (inert under a modal dialog)?
async function axIgnored(tab, selector){
  await send("Accessibility.enable", {}, tab);
  const doc = await send("DOM.getDocument", { depth: 0 }, tab);
  const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector }, tab);
  const ax = await send("Accessibility.getPartialAXTree", { nodeId: q.result.nodeId, fetchRelatives: false }, tab);
  const node = (ax.result.nodes || [])[0];
  return node ? { ignored: node.ignored, role: node.role && node.role.value, name: node.name && node.name.value } : null;
}
async function tap(tab, x, y){
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }, tab);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }, tab);
}

let T = null;
try {
  T = await newTab();
  await viewport(T, 360, 740, 2);

  // ---------- Install and start ----------
  step("I1");
  await go(T, BASE + "/", 3000);
  out.I1 = await evaluate(T, `(function(){ const t = function(s){ const e = document.querySelector(s); return e ? e.textContent.replace(/\\s+/g, " ").trim() : null; };
    return { wordmark: t("#join-screen .wordmark"), tagline: t(".tagline"), start: t("#start-group-btn"), join: t("#join-link-btn"), fine: t(".fine-print"),
      policyHref: document.querySelector(".fine-print a").getAttribute("href"),
      installVisible: [...document.querySelectorAll(".install-btn")].some(function(b){ return !b.hidden && b.getClientRects().length > 0; }) }; })()`);
  out.I1.wide = await evaluate(T, WIDE);

  // ---------- Groups and people ----------
  step("G1-G3");
  await click(T, "#start-group-btn"); await sleep(300);
  await type(T, "new-group-name", "Goa trip");
  await submit(T, "new-group-form"); await sleep(2500);
  out.G1 = await view(T);
  const GOA = await code(T);
  await click(T, "#guide-go"); await sleep(350);
  for (const n of ["Asha", "Ben", "Chitra"]) { await type(T, "person-name", n); await submit(T, "add-person-form"); await sleep(250); }
  out.G3_emptyName = await evaluate(T, `(function(){ document.getElementById("person-name").value = ""; document.getElementById("add-person-form").requestSubmit();
    return document.querySelectorAll("#people-list > li").length; })()`);
  out.G2_peopleSheet = await evaluate(T, `[...document.querySelectorAll("#people-list .name")].map(function(n){ return n.firstChild.textContent; })`);
  await click(T, "#sheet-close"); await sleep(350);
  out.G2 = await view(T);

  // ---------- Expenses, splitting and balances ----------
  step("M1-M4");
  await addExpense(T, "Dinner", "300", "Asha");
  out.M1 = await view(T);
  await click(T, "#add-expense-btn"); await sleep(350);
  await submit(T, "add-expense-form"); await sleep(300);
  out.M2_empty = { desc: await text(T, "exp-desc-error"), amount: await text(T, "exp-amount-error") };
  await type(T, "exp-desc", "Zero"); await type(T, "exp-amount", "0");
  await submit(T, "add-expense-form"); await sleep(300);
  out.M2_zero = { amount: await text(T, "exp-amount-error"), sheetStillOpen: (await view(T)).sheet };
  await click(T, "#sheet-close"); await sleep(350);
  out.M2_ledger = (await view(T)).ledger;
  out.M3_hint = await addExpense(T, "Taxi", "100", "Asha", ["Ben", "Chitra"]);
  out.M3 = await view(T);
  out.M4_confirm = await confirmDelete(T, "Taxi");
  out.M4 = await view(T);

  step("M5-M6");
  await switchGroup(T);
  await click(T, "#start-group-btn"); await sleep(300);
  await type(T, "new-group-name", "Rounding test");
  await submit(T, "new-group-form"); await sleep(2500);
  const ROUND = await code(T);
  await addPeople(T, ["Asha", "Ben", "Chitra", "Dev"]);
  await addExpense(T, "Cake", "100", "Asha", ["Ben", "Chitra", "Dev"]);
  out.M5 = await view(T);
  out.M5_extraPaisaGoesTo = "the first of " + J(serverGroup(ROUND).people.filter((p) => p.name !== "Asha").map((p) => p.name + " " + p.id.slice(0, 8))) + " by ID";
  out.M5_allFour = { split: "₹100 / 4", each: (10000 / 4) / 100 };
  out.M6_deleteConfirm = await confirmDelete(T, "Cake");
  await addExpense(T, "Cake", "100", "Asha", ["Asha", "Ben", "Chitra"]);
  out.M6 = await view(T);
  out.M6_ids = serverGroup(ROUND).people.filter((p) => p.name !== "Dev").map((p) => p.name + " " + p.id.slice(0, 8)).sort((a, b) => a.split(" ")[1] < b.split(" ")[1] ? -1 : 1);
  const roundLink = await evaluate(T, `location.href`);
  await switchGroup(T);
  await clickText(T, "#recent-list .group-open", "Goa trip"); await sleep(2500);

  step("M7-M14");
  await clickText(T, "#balances-list .balance-row", "Ben owes Asha"); await sleep(350);
  out.M7_sheet = { title: await text(T, "sheet-title"), from: await text(T, "pay-from"), to: await text(T, "pay-to"), amount: await evaluate(T, `document.getElementById("pay-amount").value`),
    note: await text(T, "pay-note"), outside: await evaluate(T, `document.querySelector("#pay-form .panel-body > .field-hint:last-child").textContent`) };
  await type(T, "pay-amount", "40");
  await submit(T, "pay-form"); await sleep(600);
  out.M7 = await view(T);
  await clickText(T, "#balances-list .balance-row", "Chitra owes Asha"); await sleep(350);
  await submit(T, "pay-form"); await sleep(600);
  out.M8 = await view(T);
  await clickText(T, "#ledger-list .expense-row", "Dinner"); await sleep(350);
  await type(T, "exp-amount", "600"); await submit(T, "add-expense-form"); await sleep(600);
  out.M9 = await view(T);
  await clickText(T, "#ledger-list .expense-row", "Dinner"); await sleep(350);
  await payer(T, "Ben"); await submit(T, "add-expense-form"); await sleep(600);
  out.M10 = await view(T);
  await clickText(T, "#ledger-list .expense-row", "Dinner"); await sleep(350);
  await click(T, "#split-toggle"); await sleep(150); await untick(T, "Chitra"); await click(T, "#split-toggle"); await sleep(150);
  await submit(T, "add-expense-form"); await sleep(600);
  out.M11 = await view(T);
  const versionBefore = serverGroup(GOA).version;
  await clickText(T, "#ledger-list .expense-row", "Dinner"); await sleep(350);
  await submit(T, "add-expense-form"); await sleep(600);
  out.M12 = Object.assign(await view(T), { serverVersionUnchanged: serverGroup(GOA).version === versionBefore });
  await clickText(T, "#ledger-list .expense-row", "Ben paid Asha"); await sleep(350);
  out.M13_sheet = await text(T, "sheet-title");
  await type(T, "pay-amount", "50"); await submit(T, "pay-form"); await sleep(600);
  out.M13_edit = await view(T);
  out.M13_deleteConfirm = await confirmDelete(T, "Ben paid Asha");
  out.M13_delete = await view(T);
  await clickText(T, "#balances-list .balance-row", "Asha owes Ben"); await sleep(350);
  await submit(T, "pay-form"); await sleep(600);
  await clickText(T, "#balances-list .balance-row", "Asha owes Chitra"); await sleep(350);
  await submit(T, "pay-form"); await sleep(600);
  out.M14 = await view(T);

  // ---------- People ----------
  step("P1-P2");
  await addExpense(T, "Lunch", "90", "Asha");
  await click(T, "#people-btn"); await sleep(350);
  await evaluate(T, `(function(){ document.querySelector('[aria-label="Remove Ben"]').click(); return true; })()`); await sleep(300);
  out.P1 = await text(T, "person-blocked");
  await type(T, "person-name", "Dev"); await submit(T, "add-person-form"); await sleep(500);
  await evaluate(T, `(function(){ document.querySelector('[aria-label="Remove Dev"]').click(); return true; })()`); await sleep(300);
  out.P2_confirm = { title: await text(T, "confirm-title"), body: await text(T, "confirm-body"), ok: await text(T, "confirm-ok") };
  await click(T, "#confirm-ok"); await sleep(600);
  await click(T, "#sheet-close"); await sleep(300);
  out.P2 = (await view(T)).people;

  // ---------- Switching and removing ----------
  step("L2-L3");
  await switchGroup(T);
  out.L2 = await evaluate(T, `[...document.querySelectorAll("#recent-list .group-open")].map(function(b){ return b.textContent.replace(/\\s+/g, " ").trim(); })`);
  await click(T, "#recent-edit"); await sleep(200);
  out.L3_note = await text(T, "recent-note");
  await evaluate(T, `(function(){ const b = document.querySelector('[aria-label="Remove Rounding test from this device"]'); if(!b) throw new Error("no remove"); b.click(); return true; })()`); await sleep(400);
  await click(T, "#recent-edit"); await sleep(200);
  out.L3_list = await evaluate(T, `[...document.querySelectorAll("#recent-list .group-open .row-title")].map(function(b){ return b.textContent; })`);
  await go(T, roundLink, 3000);
  out.L3_reopened = await view(T);

  // ---------- Privacy policy links (S5) ----------
  step("S5");
  await switchGroup(T);
  await clickText(T, "#recent-list .group-open", "Goa trip"); await sleep(2500);
  await click(T, "#menu-btn"); await sleep(300);
  out.S5_menuLink = await evaluate(T, `(function(){ const a = document.querySelector("#menu-panel .policy-link"); const r = a.getBoundingClientRect();
    return { text: a.textContent, href: a.getAttribute("href"), height: Math.round(r.height), visible: r.width > 0 }; })()`);
  await click(T, "#menu-panel .policy-link"); await sleep(2500);
  out.S5_page = await evaluate(T, `({ title: document.title, url: location.pathname, h1: document.querySelector("h1").textContent, draft: document.querySelector(".draft").textContent.replace(/\\s+/g, " ").trim(),
    sections: document.querySelectorAll("#policy h2").length, first: document.querySelector("#policy h2").textContent, last: [...document.querySelectorAll("#policy h2")].pop().textContent,
    back: document.querySelector("a.back").textContent, fonts: [...document.querySelectorAll("link[rel=stylesheet], script")].length })`);
  out.S5_wide360 = await evaluate(T, WIDE);
  await shot(T, "T-06-360-privacy-top");
  await evaluate(T, `window.scrollTo(0, document.body.scrollHeight)`); await sleep(200);
  await shot(T, "T-06-360-privacy-end");
  await click(T, "a.back"); await sleep(3000);
  out.S5_backTo = await view(T);
  await switchGroup(T);
  await click(T, ".fine-print .policy-link"); await sleep(2500);
  out.S5_fromWelcome = await evaluate(T, `document.title`);
  await viewport(T, 800, 1280, 1); await sleep(300);
  out.S5_wide800 = await evaluate(T, WIDE);
  await viewport(T, 360, 740, 2); await sleep(300);
  await go(T, BASE + "/?g=" + GOA, 3000);

  // ---------- Live sync (S2) ----------
  step("S2");
  out.S2_status = await waitStatus(T, /^live$/, 10000);
  const pc = computer(GOA);
  out.S2_post = await pc("POST", "/api/expenses", { id: "ice-cream-1", date: new Date().toISOString(), desc: "Ice cream", amountPaise: 6000, paidBy: idOf(GOA, "Chitra"),
    split: ["Asha", "Ben", "Chitra"].map((n) => idOf(GOA, n)) });
  out.S2 = await waitFor(T, `(function(){ return [...document.querySelectorAll("#ledger-list .row-title")].some(function(e){ return e.textContent === "Ice cream"; }); })()`, 8000);
  out.S2_view = await view(T);

  // ---------- Offline (O1-O5) ----------
  step("O1-O5");
  await setOffline(true); await sleep(800);
  out.O1 = (await view(T)).status;
  await addExpense(T, "Snacks", "90", "Ben");
  out.O2 = await view(T);
  await clickText(T, "#ledger-list .expense-row", "Snacks"); await sleep(350);
  await type(T, "exp-amount", "120"); await submit(T, "add-expense-form"); await sleep(600);
  await confirmDelete(T, "Ice cream");
  out.O3 = await view(T);
  await setOffline(false);
  out.O4_status = await waitStatus(T, /^live$/, 20000);
  out.O4 = await view(T);
  out.O4_server = serverGroup(GOA).expenses.map((e) => e.desc + " " + e.amountPaise);
  await setOffline(true); await sleep(500);
  await go(T, BASE + "/", 3500);
  out.O5 = await view(T);
  out.O5_privacyOffline = await (async () => { await go(T, BASE + "/privacy.html", 2500); return evaluate(T, `document.title + " | " + document.querySelectorAll("#policy h2").length + " sections"`); })();
  await setOffline(false);
  await go(T, BASE + "/", 3000);
  out.R1_reload = { title: (await view(T)).title, status: await waitStatus(T, /^live$/, 10000) };

  // ---------- Errors (E1-E3) and the message bar above a sheet (F-14) ----------
  step("E1-E2");
  await switchGroup(T);
  await click(T, "#join-link-btn"); await sleep(300);
  await type(T, "join-code", "no such group here");
  await submit(T, "join-form");
  out.E1 = await waitFor(T, `(function(){ const e = document.getElementById("join-error"); return e.hidden ? "" : e.textContent; })()`, 8000);
  await click(T, "#sheet-close"); await sleep(300);
  await go(T, BASE + "/?g=GOA", 3000);
  out.E2 = await text(T, "join-alert");

  step("E3 (F-14)");
  await go(T, BASE + "/?g=" + GOA, 3000);
  await waitStatus(T, /^live$/, 10000);
  await setOffline(true); await sleep(600);
  await clickText(T, "#ledger-list .expense-row", "Lunch"); await sleep(350);
  await type(T, "exp-amount", "120"); await submit(T, "add-expense-form"); await sleep(600);
  const lunchId = serverGroup(GOA).expenses.find((e) => e.desc === "Lunch").id;
  out.E3_computerDelete = await pc("DELETE", "/api/expenses/" + lunchId);
  await click(T, "#add-expense-btn"); await sleep(400);
  await setOffline(false);
  await waitFor(T, `!document.getElementById("notice").hidden`, 20000);
  await sleep(400);
  out.E3 = Object.assign({ text: await text(T, "notice-text") }, await evaluate(T, NOTICE));
  out.E3_ax = { text: await axIgnored(T, "#notice-text"), close: await axIgnored(T, "#notice-close") };
  await shot(T, "T-06-360-notice-above-sheet");
  // The sheet closes under the bar: the bar goes back to the page, still shown and on top.
  await click(T, "#sheet-close"); await sleep(400);
  out.E3_sheetClosed = await evaluate(T, NOTICE);
  // A confirmation opens over a sheet while the bar shows: the bar moves into the confirmation.
  await clickText(T, "#ledger-list .expense-row", "Snacks"); await sleep(400);
  out.E3_editSheet = await evaluate(T, NOTICE);
  await click(T, "#exp-delete-btn"); await sleep(400);
  out.E3_confirmOpen = Object.assign(await evaluate(T, NOTICE), { ax: await axIgnored(T, "#notice-close") });
  await shot(T, "T-06-360-notice-above-confirm");
  await click(T, "#confirm-cancel"); await sleep(400);
  out.E3_confirmCancelled = await evaluate(T, NOTICE);
  await tap(T, out.E3_confirmCancelled.closeAt[0], out.E3_confirmCancelled.closeAt[1]); await sleep(400);
  out.E3_afterTapOnClose = await evaluate(T, `({ noticeHidden: document.getElementById("notice").hidden, popoverOpen: document.getElementById("notice").matches(":popover-open"), sheetOpen: document.getElementById("sheet").open })`);
  await click(T, "#sheet-close"); await sleep(400);
  out.E3_after = await view(T);
  out.E3_server = serverGroup(GOA).expenses.map((e) => e.desc + " " + e.amountPaise);

  step("F-14: a message before a sheet opens");
  await go(T, BASE + "/?g=no-such-trip-a9a9ijkeit", 3500);
  out.F14_before = Object.assign({ text: await text(T, "notice-text") }, await evaluate(T, NOTICE));
  await click(T, "#menu-btn"); await sleep(500);
  out.F14_menuOpen = Object.assign(await evaluate(T, NOTICE), { ax: await axIgnored(T, "#notice-close") });
  await tap(T, out.F14_menuOpen.closeAt[0], out.F14_menuOpen.closeAt[1]); await sleep(400);
  out.F14_afterTapOnClose = await evaluate(T, `({ noticeHidden: document.getElementById("notice").hidden, sheetOpen: document.getElementById("sheet").open })`);
} catch (e) {
  out.crash = String(e && e.stack || e).slice(0, 800);
} finally {
  out.dialogs = dialogs;
  out.errors = errors;
  out.timeouts = timeouts;
  try { await send("Browser.close"); } catch {}
  try { edge.kill(); } catch {}
  await app.close();
}
console.log(JSON.stringify(out, null, 1));
process.exit(0);
