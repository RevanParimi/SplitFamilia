// T-04 store screenshots (SF-015, from SF-028's implemented UI): the real page on the real server,
// both local (127.0.0.1, a temporary database), in headless Edge, with made-up sample groups and
// people. Each shot is 360 × 640 CSS px at 3× = 1080 × 1920 (9:16), a 24-bit PNG with no alpha.
// Nothing here reaches any real group or database.
//   node T-04-store-shots.mjs <repoDir> <empty scratch dir> <output dir>
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repoArg, scratch, outArg] = process.argv.slice(2);
const repoDir = path.resolve(repoArg);
const outDir = path.resolve(outArg);
fs.mkdirSync(scratch, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { createApp } = await import(pathToFileURL(path.join(repoDir, "server", "server.js")).href);
const app = createApp({ root: repoDir, dbFile: path.join(scratch, "shots.db"), log: () => {} });
await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + app.server.address().port;

// ---------- sample data (made up) ----------
const GOA = "goa-trip-7k2m9xqpwd", DIWALI = "diwali-party-2026-a9a9ijkeit", OOTY = "ooty-weekend-m3x8q2zt4k";
async function api(code, method, p, body){
  const res = await fetch(BASE + p, { method, headers: { "X-Group-Code": code, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (res.status >= 300) throw new Error(method + " " + p + " " + res.status);
}
const P = { a: "p-asha", b: "p-ben", c: "p-chitra", d: "p-dev" };
for (const code of [GOA, DIWALI, OOTY]) {
  await api(code, "PUT", "/api/group", { currency: "₹" });
  for (const [id, name] of [[P.a, "Asha"], [P.b, "Ben"], [P.c, "Chitra"], [P.d, "Dev"]]) await api(code, "POST", "/api/people", { id, name });
}
const now = Date.now();
const daysAgo = (d, h) => { const t = new Date(now - d * 86400000); t.setHours(h, 0, 0, 0); return t.toISOString(); };
for (const [id, d, h, desc, amountPaise, paidBy, split, kind] of [
  ["g1", 3, 18, "Deposit for the stay", 1200000, P.a, [P.a, P.b, P.d]],
  ["g2", 2, 10, "Cab from the airport", 135000, P.d, [P.a, P.b, P.d]],
  ["g3", 1, 21, "Dinner", 120000, P.b, [P.a, P.b, P.d]],
  ["g4", 1, 22, "Payment", 10000, P.b, [P.a], "settlement"],
  ["g5", 0, 11, "Groceries and fruit for the week", 246000, P.a, [P.a, P.b, P.d]],
  ["g6", 0, 16, "Ice cream", 36000, P.d, [P.a, P.b, P.d]]
]) {
  const body = { id, date: daysAgo(d, h), desc, amountPaise, paidBy, split };
  if (kind) body.kind = kind;
  await api(GOA, "POST", "/api/expenses", body);
}
await api(DIWALI, "POST", "/api/expenses", { id: "w1", date: daysAgo(11, 19), desc: "Sweets, diyas and flowers", amountPaise: 240000, paidBy: P.c, split: [P.a, P.b, P.c, P.d] });
for (const [id, from, d] of [["w2", P.a, 10], ["w3", P.b, 9], ["w4", P.d, 7]]) {
  await api(DIWALI, "POST", "/api/expenses", { id, date: daysAgo(d, 12), desc: "Payment", amountPaise: 60000, paidBy: from, split: [P.c], kind: "settlement" });
}

// ---------- headless Edge ----------
const port = 9500 + Math.floor(Math.random() * 200);
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
const send = (method, params = {}, sessionId) => {
  const id = nextId++;
  ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  return new Promise((r) => {
    const timer = setTimeout(() => { pending.delete(id); r({ timeout: true, result: {} }); }, 20000);
    pending.set(id, (msg) => { clearTimeout(timer); r(msg); });
  });
};
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === "Target.attachedToTarget") {
    sessions.set(msg.params.sessionId, msg.params.targetInfo);
    send("Runtime.runIfWaitingForDebugger", {}, msg.params.sessionId);
  }
});
await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
const { result } = await send("Target.createTarget", { url: "about:blank" });
let tab = null;
for (let i = 0; i < 50 && !tab; i++) { await sleep(100); for (const [sid, t] of sessions) if (t.targetId === result.targetId) tab = sid; }
await send("Page.enable", {}, tab);
await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 640, deviceScaleFactor: 3, mobile: true }, tab);
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, tab)).result.result?.value;
const go = async (p, wait = 3000) => { await send("Page.navigate", { url: BASE + p }, tab); await sleep(wait); };
const click = (sel) => ev(`(function(){ document.querySelector(${JSON.stringify(sel)}).click(); return 1; })()`);
const shots = [];
async function shot(name){
  await ev(`(function(){ if(document.activeElement) document.activeElement.blur(); return 1; })()`);
  await sleep(300);
  const res = await send("Page.captureScreenshot", { format: "png" }, tab);
  const file = path.join(outDir, name + ".png");
  fs.writeFileSync(file, Buffer.from(res.result.data, "base64"));
  const b = fs.readFileSync(file);
  shots.push({ name, width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25], bytes: b.length });
}

try {
  // As inside the Android app (SF-010): no "Install app" button or iPhone tip.
  await go("/", 1500);
  await ev(`sessionStorage.setItem("splitfamilia-in-app", "1")`);
  await go("/?g=" + OOTY);
  await go("/?g=" + DIWALI);
  await go("/?g=" + GOA, 3500);
  // "Your groups" with believable opening times.
  await ev(`(function(){ localStorage.removeItem("splitsheet-group"); localStorage.setItem("splitfamilia-recent", JSON.stringify([
    { code: ${JSON.stringify(GOA)}, openedAt: Date.now() - 2 * 60000 },
    { code: ${JSON.stringify(DIWALI)}, openedAt: Date.now() - 26 * 3600000 },
    { code: ${JSON.stringify(OOTY)}, openedAt: new Date(new Date().getFullYear(), 7, 12, 10).getTime() }
  ])); return 1; })()`);
  await go("/", 2500);
  await shot("01-your-groups");
  await go("/?g=" + GOA, 3500);
  await shot("02-balances");
  await click("#add-expense-btn");
  await sleep(500);
  await ev(`(function(){ const d = document.getElementById("exp-desc"); d.value = "Dinner"; d.dispatchEvent(new Event("input"));
    const a = document.getElementById("exp-amount"); a.value = "1200"; a.dispatchEvent(new Event("input")); return 1; })()`);
  await shot("03-add-expense");
  await click("#sheet-close");
  await sleep(400);
  await ev(`(function(){ const s = document.getElementById("ledger-section"); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 16); return 1; })()`);
  await shot("04-expenses");
  await ev(`window.scrollTo(0, 0)`);
  await click("#balances-list .balance-row");
  await sleep(500);
  await shot("05-record-payment");
  await click("#sheet-close");
  await sleep(400);
  await click("#people-btn");
  await sleep(500);
  await shot("06-people");
  await click("#sheet-close");
  await go("/?g=" + DIWALI, 3500);
  await shot("07-settled");
} finally {
  console.log(JSON.stringify(shots, null, 1));
  try { await send("Browser.close"); } catch {}
  await sleep(500);
  try { edge.kill(); } catch {}
  await app.close();
}
