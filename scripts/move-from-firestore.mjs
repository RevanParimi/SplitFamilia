// SF-037: copies the family's groups from the old Firestore database to the Railway server, and
// checks that every balance comes out the same to the paisa. Not shipped: the Docker image copies
// only the app. Run from the repo (docs/google-play/MOVE_FROM_FIREBASE.md gives the order):
//
//   node scripts/move-from-firestore.mjs --codes-file data/move-codes.txt
//     A dry run: reads only, from Firestore's REST API, and writes nothing anywhere but the report.
//   node scripts/move-from-firestore.mjs --import <server URL> --codes-file data/move-codes.txt --token-file data/import-token.txt
//     The dry run, then the copy (POST /api/import), then each group read back from the server and
//     its balances compared with the dry run's. Exits 1 unless every balance matches.
//
// The group codes: in a file (one per line or space-separated), or as the last arguments. The
// token: in a file, or the IMPORT_TOKEN environment variable. Both files belong in data/, which
// git ignores, so neither the codes nor the token ever reach the repo, a command line or the
// terminal. Options: --project <Firebase project ID> (default splitfamilia-cf927); --report
// <file> (default data/move-report-<time>.txt).
//
// The report, with names, expenses and balances, goes to that file for the owner; the terminal
// shows only counts, "group 1", and whether the balances match. The token is never printed.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { toPaise, expenseProblem, computeBalances, simplifyDebts, formatPaise } from "../money.js";
import { checkGroup, checkPerson, checkExpense, MAX_PEOPLE, MAX_SPLIT, MAX_EXPENSES, MAX_SPLIT_ENTRIES } from "../ledger-rules.js";
import { isValidGroupId } from "../group-code.js";

export const DEFAULT_PROJECT = "splitfamilia-cf927";
const FIRESTORE = "https://firestore.googleapis.com/v1";
const PAGE_SIZE = 300;

// ---------- reading Firestore ----------

// One value from Firestore's REST API ({ stringValue: "x" }, { integerValue: "5" }, …) as plain data.
export function decodeValue(v){
  if(v === null || typeof v !== "object") return undefined;
  if("stringValue" in v) return v.stringValue;
  if("integerValue" in v) return Number(v.integerValue);
  if("doubleValue" in v) return Number(v.doubleValue);
  if("booleanValue" in v) return v.booleanValue;
  if("nullValue" in v) return null;
  if("timestampValue" in v) return v.timestampValue;
  if("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
  if("mapValue" in v) return decodeFields(v.mapValue.fields || {});
  return undefined;
}
export function decodeFields(fields){
  const out = {};
  Object.keys(fields || {}).forEach(function(k){ out[k] = decodeValue(fields[k]); });
  return out;
}
const idOf = function(name){ return name.slice(name.lastIndexOf("/") + 1); };

async function getJson(fetchFn, url){
  const res = await fetchFn(url, { headers: { "Accept": "application/json" } });
  if(res.status === 404) return null;
  if(!res.ok) throw new Error("Firestore answered " + res.status + (res.status === 403 ? ": its rules don't allow reading this group" : ""));
  return res.json();
}

async function listAll(fetchFn, url){
  const docs = [];
  let token = "";
  for(let page = 0; page < 1000; page++){
    const body = await getJson(fetchFn, url + "?pageSize=" + PAGE_SIZE + (token ? "&pageToken=" + encodeURIComponent(token) : ""));
    if(body === null) return docs;
    (body.documents || []).forEach(function(d){ docs.push(Object.assign({ id: idOf(d.name) }, decodeFields(d.fields))); });
    if(!body.nextPageToken) return docs;
    token = body.nextPageToken;
  }
  throw new Error("Firestore kept returning pages");
}

// One group as Firestore holds it, whether or not it has a group document of its own.
// → { code, found, hasGroupDocument, currency (raw, or undefined), people: [{ id, name }],
//   expenses: [{ id, date, desc, amount, paidBy, split }] }
export async function readFirestoreGroup(code, options){
  const fetchFn = options.fetch || globalThis.fetch;
  const base = FIRESTORE + "/projects/" + encodeURIComponent(options.project || DEFAULT_PROJECT) +
    "/databases/(default)/documents/groups/" + encodeURIComponent(code);
  const doc = await getJson(fetchFn, base);
  const people = await listAll(fetchFn, base + "/people");
  const expenses = await listAll(fetchFn, base + "/expenses");
  const fields = doc ? decodeFields(doc.fields) : {};
  return {
    code: code,
    found: doc !== null || people.length > 0 || expenses.length > 0,
    hasGroupDocument: doc !== null,
    currency: fields.currency,
    people: people.map(function(p){ return { id: p.id, name: p.name }; }),
    expenses: expenses
  };
}

// ---------- planning the copy ----------

// Two sets of balances (Maps of person ID → paise) agree when every ID has the same balance; an
// ID missing from one counts as 0.
export function sameBalances(a, b){
  const ids = new Set([...a.keys(), ...b.keys()]);
  for(const id of ids){ if((a.get(id) || 0) !== (b.get(id) || 0)) return false; }
  return true;
}

// A short fingerprint of a group's balances, to compare on the terminal without showing them.
export function fingerprint(balances){
  const text = [...balances.entries()].filter(function(e){ return e[1] !== 0; })
    .sort(function(x, y){ return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0; })
    .map(function(e){ return e[0] + ":" + e[1]; }).join("\n");
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
}

// What the copy of one group will be. Every expense that the page counts today and that the
// server can take is copied with its own ID, its amount in whole paise (99.5 → 9950), and its
// payer and split as they are, even someone since removed (their balance stays under that ID).
// → { code, found, payload (what POST /api/import takes), left: [{ id, desc, amount, reason }],
//     leftPeople, balancesToday, balancesAfter, keepsBalances, overLimits: [text] }
export function planGroup(read){
  const currency = checkGroup({ currency: read.currency }) === null ? read.currency : "₹";
  const people = [];
  const leftPeople = [];
  read.people.forEach(function(p){
    if(checkPerson({ id: p.id, name: p.name }) === null) people.push({ id: p.id, name: p.name });
    else leftPeople.push({ id: p.id, name: p.name, reason: "the name or ID can't be taken" });
  });
  const expenses = [];
  const left = [];
  read.expenses.forEach(function(e){
    const problem = expenseProblem(e);
    if(problem){
      left.push({ id: e.id, desc: e.desc, amount: e.amount, reason: "not counted today (" + problem + ")" });
      return;
    }
    const body = { id: e.id, date: e.date, desc: e.desc, amountPaise: toPaise(e.amount), paidBy: e.paidBy, split: e.split };
    const shape = checkExpense(body);
    if(shape){
      left.push({ id: e.id, desc: e.desc, amount: e.amount, reason: "the server can't take its " + shape });
      return;
    }
    expenses.push(body);
  });
  // Today's balances, as the page shows them: money.js leaves out what expenseProblem flags.
  const balancesToday = computeBalances(read.people, read.expenses);
  const balancesAfter = computeBalances(people, expenses.map(function(e){ return Object.assign({}, e, { amount: e.amountPaise / 100 }); }));
  const overLimits = [];
  if(people.length > MAX_PEOPLE) overLimits.push("more than " + MAX_PEOPLE + " people");
  if(expenses.some(function(e){ return e.split.length > MAX_SPLIT; })) overLimits.push("an expense split among more than " + MAX_SPLIT);
  if(expenses.length > MAX_EXPENSES) overLimits.push("more than " + MAX_EXPENSES + " expenses");
  const entries = expenses.reduce(function(n, e){ return n + e.split.length; }, 0);
  if(entries > MAX_SPLIT_ENTRIES) overLimits.push("more than " + MAX_SPLIT_ENTRIES + " split entries in all");
  return {
    code: read.code,
    found: read.found,
    hasGroupDocument: read.hasGroupDocument,
    payload: { code: read.code, currency: currency, people: people, expenses: expenses },
    left: left,
    leftPeople: leftPeople,
    balancesToday: balancesToday,
    balancesAfter: balancesAfter,
    keepsBalances: sameBalances(balancesToday, balancesAfter),
    overLimits: overLimits
  };
}

// ---------- the copy and the check ----------

// Sends one planned group to the server's import endpoint. → { status, body }
export async function importGroup(plan, options){
  const fetchFn = options.fetch || globalThis.fetch;
  const res = await fetchFn(options.server.replace(/\/+$/, "") + "/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + options.token },
    body: JSON.stringify(plan.payload)
  });
  let body = null;
  try{ body = await res.json(); }catch(e){ body = null; }
  return { status: res.status, body: body };
}

// Reads the group back from the server and compares its balances with the dry run's.
// → { status, people, expenses, balances, matches }
export async function checkGroupOnServer(plan, options){
  const fetchFn = options.fetch || globalThis.fetch;
  const res = await fetchFn(options.server.replace(/\/+$/, "") + "/api/group", {
    headers: { "Accept": "application/json", "X-Group-Code": plan.code }
  });
  if(res.status !== 200) return { status: res.status, matches: false };
  const g = await res.json();
  const balances = computeBalances(g.people, g.expenses.map(function(e){ return Object.assign({}, e, { amount: e.amountPaise / 100 }); }));
  return {
    status: 200, people: g.people.length, expenses: g.expenses.length, balances: balances,
    matches: sameBalances(plan.balancesToday, balances) && g.expenses.length === plan.payload.expenses.length
  };
}

// ---------- what the owner and the terminal see ----------

function money(paise){ return "₹" + formatPaise(Math.abs(paise), "en-IN"); }

// The owner's report: names, expenses and balances. It goes to a git-ignored file, never the terminal.
export function reportText(plans, when){
  const lines = ["SplitFamilia: the move from Firestore, " + when, ""];
  plans.forEach(function(plan, i){
    const name = function(id){ const p = plan.payload.people.find(function(x){ return x.id === id; }); return p ? p.name : "(removed: " + id + ")"; };
    lines.push("Group " + (i + 1) + ": " + plan.code);
    if(!plan.found){ lines.push("  Nothing under this code in Firestore.", ""); return; }
    lines.push("  " + plan.payload.people.length + " people, " + plan.payload.expenses.length + " expenses to copy; currency " + plan.payload.currency +
      (plan.hasGroupDocument ? "" : " (no group document: ₹ is used)"));
    plan.leftPeople.forEach(function(p){ lines.push("  Person left out: " + p.name + " (" + p.reason + ")"); });
    plan.left.forEach(function(e){ lines.push("  Expense left out: " + JSON.stringify(e.desc) + ", amount " + JSON.stringify(e.amount) + ": " + e.reason); });
    plan.overLimits.forEach(function(t){ lines.push("  OVER THE LIMITS: " + t); });
    lines.push("  Balances today:");
    [...plan.balancesToday.entries()].forEach(function(e){
      lines.push("    " + name(e[0]) + ": " + (e[1] > 0 ? "is owed " : e[1] < 0 ? "owes " : "settled ") + (e[1] === 0 ? "" : money(e[1])));
    });
    lines.push("  Suggested payments:");
    simplifyDebts(plan.balancesToday).forEach(function(t){ lines.push("    " + name(t.from) + " pays " + name(t.to) + " " + money(t.amount)); });
    lines.push("  The copy keeps every balance: " + (plan.keepsBalances ? "yes" : "NO — decide before copying"), "");
  });
  return lines.join("\n") + "\n";
}

// One line per group for the terminal: counts only, no code, no name, no amount.
export function summaryLine(plan, i){
  if(!plan.found) return "group " + (i + 1) + ": nothing found in Firestore";
  return "group " + (i + 1) + ": " + plan.payload.people.length + " people, " + plan.payload.expenses.length + " expenses to copy, " +
    plan.left.length + " expenses and " + plan.leftPeople.length + " people left out" +
    (plan.overLimits.length ? ", OVER THE LIMITS" : "") +
    "; balances " + fingerprint(plan.balancesToday) + (plan.keepsBalances ? ", kept by the copy" : ", CHANGED by the copy");
}

// ---------- the command line ----------

export async function main(argv, env, out){
  const args = { codes: [], project: DEFAULT_PROJECT, server: null, report: null, codesFile: null, tokenFile: null };
  for(let i = 0; i < argv.length; i++){
    if(argv[i] === "--import") args.server = argv[++i];
    else if(argv[i] === "--project") args.project = argv[++i];
    else if(argv[i] === "--report") args.report = argv[++i];
    else if(argv[i] === "--codes-file") args.codesFile = argv[++i];
    else if(argv[i] === "--token-file") args.tokenFile = argv[++i];
    else args.codes.push(argv[i]);
  }
  try{
    if(args.codesFile) args.codes = args.codes.concat(readFileSync(args.codesFile, "utf8").split(/\s+/).filter(Boolean));
  }catch(e){ out("Couldn't read the codes file."); return 2; }
  let token = env.IMPORT_TOKEN || "";
  try{
    if(args.tokenFile) token = readFileSync(args.tokenFile, "utf8").trim();
  }catch(e){ out("Couldn't read the token file."); return 2; }
  if(args.codes.length === 0){ out("Usage: node scripts/move-from-firestore.mjs [--import <server URL> --token-file <file>] --codes-file <file>"); return 2; }
  const bad = args.codes.findIndex(function(c){ return !isValidGroupId(c); });
  if(bad !== -1){ out("group " + (bad + 1) + " isn't a valid group code."); return 2; }
  if(args.server !== null && !token){ out("Give the import token (the same as on Railway) with --token-file, or IMPORT_TOKEN."); return 2; }
  if(args.server !== null && !/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(args.server)){
    out("The server must be an https:// address (or a local one for testing)."); return 2;
  }

  const plans = [];
  for(const code of args.codes) plans.push(planGroup(await readFirestoreGroup(code, { project: args.project })));
  const when = new Date().toISOString();
  const report = resolve(args.report || fileURLToPath(new URL("../data/move-report-" + when.replace(/[:.]/g, "-") + ".txt", import.meta.url)));
  mkdirSync(dirname(report), { recursive: true });
  writeFileSync(report, reportText(plans, when));
  out("Dry run" + (args.server ? ", then the copy" : "") + ". The report for the owner (names and balances): " + report);
  plans.forEach(function(p, i){ out(summaryLine(p, i)); });
  if(args.server === null) return 0;

  let ok = true;
  for(let i = 0; i < plans.length; i++){
    const plan = plans[i];
    if(!plan.found){ ok = false; out("group " + (i + 1) + ": not copied (nothing in Firestore)"); continue; }
    const res = await importGroup(plan, { server: args.server, token: token });
    if(res.status !== 200){
      ok = false;
      out("group " + (i + 1) + ": the server refused the copy: " + res.status + " " + ((res.body && res.body.error) || "") + " " + ((res.body && res.body.field) || ""));
      continue;
    }
    const check = await checkGroupOnServer(plan, { server: args.server });
    ok = ok && check.matches;
    out("group " + (i + 1) + ": copied (" + res.body.added.people + " people and " + res.body.added.expenses + " expenses new on the server); " +
      "read back: " + check.people + " people, " + check.expenses + " expenses, balances " +
      (check.balances ? fingerprint(check.balances) : "?") + (check.matches ? ": MATCH" : ": DIFFERENT"));
  }
  out(ok ? "Every balance matches to the paisa." : "NOT every group matches: see above, and don't switch over yet.");
  return ok ? 0 : 1;
}

if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href){
  main(process.argv.slice(2), process.env, console.log).then(function(code){ process.exitCode = code; }, function(err){
    console.log("Stopped: " + (err && err.message ? err.message : "an unexpected error"));
    process.exitCode = 1;
  });
}
