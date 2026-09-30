// T-09 review probe (evidence only, not part of `npm test`). The reviewer's own adversarial traces,
// on the real page, server and copy script, all local: 127.0.0.1, temporary databases, fake
// Firestore answers, and a made-up import token. Nothing reaches a real group or database.
//   node T-09-review-probe.mjs <repoDir> <empty scratch dir> [--sw-pause]
// By default new targets (the service worker) run at once, as on a phone. --sw-pause pauses each
// new target until the probe resumes it, as the T-09 browser check does. On this machine that
// made CDP replies stall: one run hung, two later runs timed out at R3 (the first run with it
// completed). Without the pause nothing stalled.
// Prints one JSON object. The expected values are worked out by hand in evidence/T-09-review.md.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repoArg, scratch, flag] = process.argv.slice(2);
const swPause = flag === "--sw-pause";
const repoDir = path.resolve(repoArg);
const load = (p) => import(pathToFileURL(path.join(repoDir, p)).href);
const { createApp } = await load("server/server.js");
const move = await load("scripts/move-from-firestore.mjs");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(scratch, { recursive: true });
const out = {};

// Every log line from both servers, and every console line from the browser: checked at the end
// for codes, names, descriptions and the token.
const serverLogs = [];
const consoleLines = [];
const SECRETS = [];

// ---------- part 1: the import endpoint and the copy, in Node ----------
const TOKEN = "review-made-up-import-token-0123456789";
SECRETS.push(TOKEN);
async function listen(app){
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  return "http://127.0.0.1:" + app.server.address().port;
}
{
  const on = createApp({ root: repoDir, dbFile: path.join(scratch, "import-on.db"), log: (l) => serverLogs.push(l), importToken: TOKEN });
  const off = createApp({ root: repoDir, dbFile: path.join(scratch, "import-off.db"), log: (l) => serverLogs.push(l), importToken: TOKEN.slice(0, 23) });
  const ON = await listen(on);
  const OFF = await listen(off);
  try{
    const CODE = "review-move-trip";
    SECRETS.push(CODE, "Meera", "Kabir", "Ravi", "Houseboat", "Ferry", "Snacks", "Bus");
    const body = { code: CODE, currency: "₹", people: [{ id: "meera1", name: "Meera" }, { id: "kabir2", name: "Kabir" }],
      expenses: [
        { id: "x1", date: "2026-09-20T10:00:00.000Z", desc: "Houseboat", amountPaise: 1000001, paidBy: "meera1", split: ["meera1", "kabir2", "ravi-gone"] },
        { id: "x2", date: "2026-09-21T10:00:00.000Z", desc: "Ferry", amountPaise: 999, paidBy: "kabir2", split: ["meera1", "kabir2"] }
      ] };
    const post = (base, auth, payload) => fetch(base + "/api/import", { method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, auth === null ? {} : { "Authorization": auth }),
      body: JSON.stringify(payload || body) });
    const statusOf = async (p) => (await p).status;

    // P1. Tokens: only "Bearer <the token>" opens it; everything else looks like no such path.
    // A throwaway group, so a token that is let in doesn't copy P2's group early. (A space after
    // the token is let in: Node's HTTP parser trims a header value's trailing spaces, as HTTP says.)
    const spare = { code: "review-token-trip", currency: "₹", people: [], expenses: [] };
    SECRETS.push(spare.code);
    out.P1_tokens = {
      none: await statusOf(post(ON, null, spare)),
      wrong: await statusOf(post(ON, "Bearer " + TOKEN.slice(0, -1) + "X", spare)),
      upperCase: await statusOf(post(ON, "Bearer " + TOKEN.toUpperCase(), spare)),
      twoSpaces: await statusOf(post(ON, "Bearer  " + TOKEN, spare)),
      lowerScheme: await statusOf(post(ON, "bearer " + TOKEN, spare)),
      tokenPlusSpace: await statusOf(post(ON, "Bearer " + TOKEN + " ", spare)),
      shortTokenServer: await statusOf(post(OFF, "Bearer " + TOKEN.slice(0, 23), spare)),
      // What a GET says about the endpoint, on and off.
      getWhenOn: await statusOf(fetch(ON + "/api/import")),
      getWhenOff: await statusOf(fetch(OFF + "/api/import"))
    };
    // 60 wrong tokens in a row from one address: never limited (by design: the token is 32+
    // random characters, and the endpoint lives only for the move). Reads still answer.
    const wrongs = [];
    for(let i = 0; i < 60; i++) wrongs.push(await statusOf(post(ON, "Bearer wrong-" + i + "-" + "x".repeat(30), spare)));
    out.P1_sixtyWrongTokens = [...new Set(wrongs)];
    out.P1_unknownCodeAfter = await statusOf(fetch(ON + "/api/group", { headers: { "X-Group-Code": "never-made-trip" } }));

    // P2. The copy, then a GET, then a copy of one more expense: the shared answer follows.
    const get = async () => { const r = await fetch(ON + "/api/group", { headers: { "X-Group-Code": CODE, "Accept-Encoding": "gzip" } }); return r.status === 200 ? r.json() : r.status; };
    out.P2_beforeImport = await get();
    const first = await post(ON, "Bearer " + TOKEN);
    out.P2_firstImport = { status: first.status, body: await first.json() };
    const g1 = await get();
    out.P2_readBack = { version: g1.version, people: g1.people.length, expenses: g1.expenses.map((e) => [e.id, e.amountPaise]) };
    const plan = { code: CODE, payload: body, balancesToday: move.planGroup({ code: CODE, found: true, hasGroupDocument: true, currency: "₹",
      people: body.people, expenses: body.expenses.map((e) => Object.assign({}, e, { amount: e.amountPaise / 100 })) }).balancesToday };
    out.P2_balances = Object.fromEntries(plan.balancesToday);
    out.P2_check = (await move.checkGroupOnServer(plan, { server: ON })).matches;

    // P3. After the switch-over the family deletes the Ferry and adds Snacks on Railway; then the
    // copy is run again by mistake. Nothing deleted comes back, nothing is doubled, and the check
    // refuses to say "matches".
    const api = (method, p, b) => fetch(ON + p, { method, headers: Object.assign({ "X-Group-Code": CODE }, b ? { "Content-Type": "application/json" } : {}), body: b ? JSON.stringify(b) : undefined });
    await api("DELETE", "/api/expenses/x2");
    await api("POST", "/api/expenses", { id: "x3", date: "2026-10-02T10:00:00.000Z", desc: "Snacks", amountPaise: 300, paidBy: "kabir2", split: ["kabir2"] });
    const vBefore = (await get()).version;
    const again = await post(ON, "Bearer " + TOKEN);
    const g2 = await get();
    out.P3_rerunAfterChanges = { status: again.status, body: await again.json(), versionBefore: vBefore, versionAfter: g2.version,
      expenses: g2.expenses.map((e) => e.id), check: (await move.checkGroupOnServer(plan, { server: ON })).matches };
    // P4. An import with one more expense moves the version, so the next read isn't the old answer.
    const more = Object.assign({}, body, { expenses: body.expenses.concat([{ id: "x4", date: "2026-09-22T10:00:00.000Z", desc: "Bus", amountPaise: 150, paidBy: "meera1", split: ["meera1"] }]) });
    const r4 = await post(ON, "Bearer " + TOKEN, more);
    const g4 = await get();
    out.P4_importMovesVersion = { status: r4.status, body: await r4.json(), versionRead: g4.version, expenses: g4.expenses.map((e) => e.id) };
  }finally{
    await on.close();
    await off.close();
  }
}

// ---------- part 2: the page in headless Edge ----------
const dbFile = path.join(scratch, "page.db");
const served = [];
let app = null;
let serverPort = 0;
async function startServer(){
  app = createApp({ root: repoDir, dbFile, log: (l) => serverLogs.push(l), guessLimit: 1000 });
  app.server.on("request", (req, res) => res.on("finish", () => served.push(`${req.method} ${req.url} → ${res.statusCode}`)));
  await new Promise((r) => app.server.listen(serverPort, "127.0.0.1", r));
  serverPort = app.server.address().port;
}
async function stopServer(){ if(app){ await app.close(); app = null; } }
await startServer();
const BASE = `http://127.0.0.1:${serverPort}`;
// Another phone, straight to the API.
const phone = (code) => (method, p, b) => fetch(BASE + p, { method, headers: Object.assign({ "X-Group-Code": code }, b ? { "Content-Type": "application/json" } : {}), body: b ? JSON.stringify(b) : undefined });

const port = 9500 + Math.floor(Math.random() * 400);
const LOOKALIKE = "notgithub.io";
spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--lang=en-US",
  `--host-resolver-rules=MAP ${LOOKALIKE} 127.0.0.1`,
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(scratch, "profile")}`, "about:blank"], { stdio: "ignore" });
let ver;
for (let i = 0; i < 60 && !ver; i++) { await sleep(200); try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch {} }
if (!ver) throw new Error("Edge did not start");
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map();
const sessions = new Map(); // sessionId → { type, targetId }
const errors = [], dialogs = [];
let offline = false;
// A reply that never comes (a first run hung here) is recorded, not waited for.
const timeouts = [];
const step = (name) => process.stderr.write(new Date().toISOString().slice(11, 19) + " " + name + "\n");
const send = (method, params = {}, sessionId) => {
  const id = nextId++;
  ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  return new Promise((r) => {
    const timer = setTimeout(() => { pending.delete(id); timeouts.push(method); r({ timeout: true, result: { result: {} } }); }, 20000);
    pending.set(id, (msg) => { clearTimeout(timer); r(msg); });
  });
};
const conditions = () => ({ offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
// The commands go out together; a target handles them in order, so with --sw-pause the network
// setting is in place before a paused target runs.
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
    dialogs.push(msg.params.message);
    send("Page.handleJavaScriptDialog", { accept: true }, msg.sessionId);
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    consoleLines.push(msg.params.args.map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(" "));
  }
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error"
    && !/ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE|ERR_NETWORK_CHANGED|net::ERR_FAILED|Failed to load resource/.test(msg.params.entry.text)) {
    errors.push("log: " + msg.params.entry.text.slice(0, 160));
  }
});
await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: swPause, flatten: true });
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
  if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 300));
  return res.result.result.value;
};
const go = async (tab, url, wait = 2000) => { await send("Page.navigate", { url: url.startsWith("http") ? url : BASE + url }, tab); await sleep(wait); };
const status = (tab) => evaluate(tab, `(document.getElementById("group-status") || {}).textContent || null`);
async function waitStatus(tab, re, ms){
  const until = Date.now() + ms;
  let s = "";
  while (Date.now() < until) { s = await status(tab); if (re.test(s)) return s; await sleep(200); }
  return "TIMED OUT at: " + s;
}
const shown = (sel) => `(function(){ const e = document.querySelector(${JSON.stringify(sel)}); if(!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== "none" && !e.hidden && r.width > 0; })()`;
const SCREEN = `({ href: location.href.replace(/[?].*/, ""), boot: ${shown("#boot")}, join: ${shown("#join-screen")}, moved: ${shown("#moved-screen")}, app: ${shown("#app-shell")}, controlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller) })`;
const LEDGER = `({
  people: [...document.querySelectorAll("#people-list .chip span")].map(function(e){ return e.textContent; }),
  waitingPeople: [...document.querySelectorAll("#people-list .chip.waiting span")].map(function(e){ return e.textContent; }),
  rows: [...document.querySelectorAll("#ledger-list .ledger-row")].map(function(r){
    return r.querySelector(".ledger-desc").textContent + " " + r.querySelector(".ledger-amt").textContent + (r.querySelector(".ledger-sync") ? " (waiting)" : "");
  }),
  balances: [...document.querySelectorAll("#balances-list .balance-row, #balances-list .settled")].map(function(r){ return r.textContent; }),
  currency: document.getElementById("currency-input").value,
  notice: document.getElementById("notice").hidden ? null : document.getElementById("notice-text").textContent
})`;
const ledger = (tab) => evaluate(tab, LEDGER);
const addPerson = (tab, name) => evaluate(tab, `(function(){ document.getElementById("person-name").value = ${JSON.stringify(name)};
  document.getElementById("add-person-form").requestSubmit(); return true; })()`);
const removePerson = (tab, name) => evaluate(tab, `(function(){
  const chip = [...document.querySelectorAll("#people-list .chip")].find(function(c){ return c.querySelector("span").textContent === ${JSON.stringify(name)}; });
  chip.querySelector("button").click(); return true; })()`);
const addExpense = (tab, desc, amount, payer, split) => evaluate(tab, `(function(){
  document.getElementById("exp-desc").value = ${JSON.stringify(desc)};
  document.getElementById("exp-amount").value = ${JSON.stringify(amount)};
  const sel = document.getElementById("exp-paidby");
  sel.value = [...sel.options].find(function(o){ return o.textContent === ${JSON.stringify(payer)}; }).value;
  [...document.querySelectorAll("#split-boxes label")].forEach(function(l){ l.querySelector("input").checked = ${JSON.stringify(split)}.includes(l.textContent); });
  document.getElementById("add-expense-form").requestSubmit(); return true; })()`);
const setCurrency = (tab, symbol) => evaluate(tab, `(function(){ const el = document.getElementById("currency-input");
  el.value = ${JSON.stringify(symbol)}; el.dispatchEvent(new Event("change")); return true; })()`);
const startGroup = (tab, name) => evaluate(tab, `(function(){ document.getElementById("new-group-name").value = ${JSON.stringify(name)};
  document.getElementById("new-group-form").requestSubmit(); return true; })()`);
const codeOf = (tab) => evaluate(tab, `new URL(location.href).searchParams.get("g")`);
const serverGroup = (code) => app.ledger.groupVersion(code) === null ? null : (function(g){
  return { currency: g.currency, version: g.version, people: g.people.map((p) => p.name), expenses: g.expenses.map((e) => e.desc + " " + e.amountPaise) };
})(app.ledger.readGroup(code));
const count = (re) => served.filter((s) => re.test(s)).length;

let A = null, B = null;
try {
  A = await newTab();
  // First visit: the worker installs and takes control.
  await go(A, "/", 3000);
  for (let i = 0; i < 30 && !(await evaluate(A, `Boolean(navigator.serviceWorker.controller)`)); i++) await sleep(200);
  await sleep(1000);

  step("R1");
  // R1. D3: a new group started with no connection, two people added, the page reloaded, still
  // offline; then back online. By hand: the create goes first, then Asha and Ben: version 3.
  await setOffline(true);
  await sleep(300);
  await startGroup(A, "Trek");
  await sleep(500);
  const trek = await codeOf(A);
  SECRETS.push(trek);
  await addPerson(A, "Asha"); await sleep(200);
  await addPerson(A, "Ben"); await sleep(500);
  out.R1_offline = Object.assign({ status: await status(A), server: serverGroup(trek) }, await ledger(A));
  await go(A, "/?g=" + trek, 3000);
  out.R1_reloadedOffline = Object.assign({ screen: await evaluate(A, SCREEN), status: await status(A) }, await ledger(A));
  await setOffline(false);
  out.R1_online = { status: await waitStatus(A, /^· live$/, 15000) };
  await sleep(300);
  Object.assign(out.R1_online, await ledger(A), { server: serverGroup(trek) });

  step("R2");
  // R2. Two tabs of Trek, both offline. Tab B removes Ben (no expense names him yet). Meanwhile
  // another phone adds "Fuel" ₹60.00 by Ben split Asha and Ben. Tab A adds Chitra, then "Dinner"
  // ₹90.00 by Asha split Asha and Chitra. Online: B's removal is refused in the middle of the
  // queue (409 in-use); the rest still goes, each change once.
  // By hand: Fuel 3000 each; Dinner 4500 each. Asha +9000 − 4500 − 3000 = +1500; Ben +6000 − 3000
  // = +3000; Chitra −4500; sum 0 → "Chitra owes Ben ₹30.00", "Chitra owes Asha ₹15.00".
  B = await newTab();
  await go(B, "/?g=" + trek, 2500);
  out.R2_tabB_live = await waitStatus(B, /^· live$/, 10000);
  await setOffline(true);
  await sleep(500);
  await removePerson(B, "Ben");
  await sleep(300);
  const fuelBen = app.ledger.readGroup(trek).people.find((p) => p.name === "Ben").id;
  const fuelAsha = app.ledger.readGroup(trek).people.find((p) => p.name === "Asha").id;
  out.R2_otherPhoneFuel = (await phone(trek)("POST", "/api/expenses", { id: "fuel-from-other-phone", date: "2026-09-30T12:00:00.000Z", desc: "Fuel", amountPaise: 6000, paidBy: fuelBen, split: [fuelAsha, fuelBen] })).status;
  await addPerson(A, "Chitra"); await sleep(300);
  await addExpense(A, "Dinner", "90.00", "Asha", ["Asha", "Chitra"]);
  await sleep(800);
  const deletesBefore = count(/^DELETE \/api\/people\//), expensePostsBefore = count(/^POST \/api\/expenses/), peoplePostsBefore = count(/^POST \/api\/people/);
  out.R2_offline = { A: Object.assign({ status: await status(A) }, await ledger(A)), B: Object.assign({ status: await status(B) }, await ledger(B)) };
  await setOffline(false);
  out.R2_online = { A: await waitStatus(A, /^· live$/, 20000), B: await waitStatus(B, /^· live$/, 20000) };
  await sleep(1500);
  out.R2_after = {
    A: Object.assign({ status: await status(A) }, await ledger(A)),
    B: Object.assign({ status: await status(B) }, await ledger(B)),
    server: serverGroup(trek),
    sentOnce: { personDeletes: count(/^DELETE \/api\/people\//) - deletesBefore, expensePosts: count(/^POST \/api\/expenses/) - expensePostsBefore,
      peoplePosts: count(/^POST \/api\/people/) - peoplePostsBefore },
    refusals: served.filter((s) => /^DELETE \/api\/people\/.* → 409$/.test(s)).length
  };

  step("R3");
  // R3. A second tab of a group created offline: tab A starts "Hike" offline, tab B opens the same
  // link, still offline; then online. Only one tab can send the create.
  await go(A, "/", 1500);
  await evaluate(A, `(function(){ localStorage.removeItem("splitsheet-group"); return true; })()`);
  await go(A, "/", 2000);
  await setOffline(true);
  await sleep(300);
  await startGroup(A, "Hike");
  await sleep(500);
  const hike = await codeOf(A);
  SECRETS.push(hike);
  await go(B, "/?g=" + hike, 2500);
  out.R3_offline = { A: await status(A), B: await status(B) };
  await setOffline(false);
  await sleep(15000);
  out.R3_after15s = { A: await status(A), B: await status(B), server: serverGroup(hike),
    creates: served.filter((s) => s.startsWith("PUT /api/group")).length };
  await go(B, "/?g=" + hike, 1000);
  out.R3_B_reloaded = await waitStatus(B, /^· live$/, 10000);

  step("R4a");
  // R4. Offline opens of groups this phone never read.
  // (a) A group that exists (made by another phone): shown empty offline, then filled online.
  const lake = "review-lake-trip";
  SECRETS.push(lake, "Isha", "Omar", "Tickets");
  const other = phone(lake);
  await other("PUT", "/api/group", { currency: "€" });
  await other("POST", "/api/people", { id: "isha", name: "Isha" });
  await other("POST", "/api/people", { id: "omar", name: "Omar" });
  await other("POST", "/api/expenses", { id: "tix", date: "2026-09-30T08:00:00.000Z", desc: "Tickets", amountPaise: 1001, paidBy: "isha", split: ["isha", "omar"] });
  await setOffline(true);
  await go(A, "/?g=" + lake, 3000);
  out.R4a_offline = Object.assign({ screen: await evaluate(A, SCREEN), status: await status(A) }, await ledger(A));
  await setOffline(false);
  out.R4a_online = { status: await waitStatus(A, /^· live$/, 15000) };
  await sleep(300);
  Object.assign(out.R4a_online, await ledger(A));
  step("R4b");
  // (b) A code no group has, with a person added offline: refused, and no group is made.
  const nope = "review-nope-trip";
  SECRETS.push(nope, "Zed");
  await setOffline(true);
  await go(A, "/?g=" + nope, 3000);
  await addPerson(A, "Zed");
  await sleep(500);
  out.R4b_offline = Object.assign({ status: await status(A) }, await ledger(A));
  await setOffline(false);
  await sleep(6000);
  out.R4b_online = Object.assign({ status: await status(A), serverHasGroup: serverGroup(nope) !== null }, await ledger(A));
  step("R4c");
  // (c) The same, but the currency symbol is changed offline instead.
  const typo = "review-typo-trip";
  SECRETS.push(typo);
  await setOffline(true);
  await go(A, "/?g=" + typo, 3000);
  await setCurrency(A, "$");
  await sleep(500);
  out.R4c_offline = { status: await status(A) };
  await setOffline(false);
  await sleep(6000);
  out.R4c_online = Object.assign({ status: await status(A), serverGroup: serverGroup(typo) }, await ledger(A));

  step("R5");
  // R5. A host that merely contains "github.io" runs the app as usual (no "moved" card).
  await evaluate(A, `(function(){ localStorage.removeItem("splitsheet-group"); return true; })()`);
  await go(A, `http://${LOOKALIKE}:${serverPort}/`, 2500);
  out.R5_lookalike = await evaluate(A, SCREEN);

  step("R7");
  // R7. The offline reopen, five times: the server stopped and the tab offline, open Trek's link.
  await go(A, "/?g=" + trek, 2500);
  await waitStatus(A, /^· live$/, 10000);
  out.R7_offlineReopen = { swPause: swPause, runs: [] };
  for (let i = 0; i < 5; i++) {
    await stopServer();
    await setOffline(true);
    await go(A, "/?g=" + trek, 3000);
    let screen;
    try { screen = await evaluate(A, SCREEN); } catch (e) { screen = { error: String(e.message).slice(0, 80) }; }
    const people = screen.app ? (await ledger(A)).people.length : null;
    out.R7_offlineReopen.runs.push({ app: Boolean(screen.app), controlled: screen.controlled, href: screen.href || null, people: people, status: screen.app ? await status(A) : null });
    await setOffline(false);
    await startServer();
    await go(A, "/?g=" + trek, 2500);
    await waitStatus(A, /^· live$/, 15000);
  }
} finally {
  out.dialogs = dialogs;
  out.errors = errors;
  out.cdpTimeouts = timeouts;
  try { await send("Browser.close"); } catch {}
  await sleep(1500);
  ws.close();
  await stopServer();
}

// R6. No log line or console line holds a group code, a name, a description or the token.
out.R6_logs = {
  serverLines: serverLogs.length,
  consoleLines: consoleLines.length,
  leaks: serverLogs.concat(consoleLines).filter((l) => SECRETS.some((s) => l.includes(s))),
  sampleServer: [...new Set(serverLogs)].slice(0, 12),
  sampleConsole: [...new Set(consoleLines)].slice(0, 12)
};
console.log(JSON.stringify(out, null, 2));
