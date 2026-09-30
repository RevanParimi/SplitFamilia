// The ledger API (SF-033), all JSON, under /api/. There is no sign-in: a group's code is its
// password. So:
// - the code travels in the X-Group-Code header, never in the URL, and Railway's request logs
//   don't record it. This module logs at most a method, a status and an error code;
// - there is no endpoint that lists groups;
// - an address that tries more than 30 unknown codes in 10 minutes is refused for a while;
// - an address may send at most 300 changes in 10 minutes, and hold at most 10 live streams
//   (the owner, D-17), so no one can fill the database quickly or take every stream;
// - a group holds at most 20,000 split entries (D-18), and its answer is built once per version
//   and shared by every reader, gzipped when the browser accepts it, so reading even the largest
//   group stays cheap;
// - only ledger-shaped data is accepted (ledger-rules.js, shared with the page).
//
// GET    /api/group          the group: { currency, version, people, expenses }; 404 if unknown
// PUT    /api/group          { currency }; creates the group if it is new
// POST   /api/people         { id, name }
//                            409 when the group already has 100 people (MAX_PEOPLE)
// DELETE /api/people/<id>    409 while an expense uses them
// POST   /api/expenses       { id, date, desc, amountPaise, paidBy, split }
//                            409 when the group has had 5,000 expenses (MAX_EXPENSES), or the
//                            split would pass 20,000 entries in all (MAX_SPLIT_ENTRIES)
// DELETE /api/expenses/<id>
// GET    /api/group/events   the live stream (live.js)
// POST   /api/import         a whole group at once, only while the IMPORT_TOKEN variable is set
//                            and the request carries it (SF-037, the move from the old database)
//
// Errors are { "error": <code> } with the codes the page's friendlyError() maps. A change
// answers { "version" }, the group's version after it. Adding an ID that is already there
// changes nothing and still succeeds (200 instead of 201), so a phone may safely send it again.
import { createHash, timingSafeEqual } from "node:crypto";
import { gzip as gzipAsync } from "node:zlib";
import { isValidGroupId } from "../group-code.js";
import { checkGroup, checkPerson, checkExpense, isValidId, MAX_PEOPLE, MAX_EXPENSES, MAX_SPLIT_ENTRIES } from "../ledger-rules.js";
import { COMMON_HEADERS } from "./static.js";

export const GROUP_HEADER = "x-group-code";
// The largest expense allowed (split among MAX_SPLIT people with 64-character IDs) is about
// 8 KB, so 16 KB leaves room; a test sends exactly that expense.
export const MAX_BODY_BYTES = 16 * 1024;
// A whole group copied in at once: a family's is far smaller.
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
// A shorter IMPORT_TOKEN leaves the import endpoint off: it must be long and random.
export const MIN_IMPORT_TOKEN_LENGTH = 24;
export const GUESS_LIMIT = 30;
export const GUESS_WINDOW_MS = 10 * 60 * 1000;
// Changes (every PUT, POST and DELETE) per address: a family never comes near it, even a phone
// sending a day's waiting changes at once.
export const WRITE_LIMIT = 300;
export const WRITE_WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED_ADDRESSES = 10000;
// The group answers kept ready (D-18), by size: a few of the largest groups, or many small ones.
export const MAX_ANSWER_BYTES = 32 * 1024 * 1024;
// Smaller answers aren't worth gzipping.
const GZIP_FROM_BYTES = 1024;

class ApiError extends Error {
  constructor(status, code, field){
    super(code);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

// Counts requests with unknown codes per address. Once an address has made `limit` of them in
// the window, every API request from it is refused until the oldest drops out of the window,
// known codes included: otherwise a refusal would tell a guesser which codes exist.
export function createGuessLimiter(options){
  return createAddressLimiter(GUESS_LIMIT, GUESS_WINDOW_MS, options);
}

// Counts changes per address. Once an address has sent `limit` of them in the window, its
// changes are refused until the oldest drops out of the window; it can still read.
export function createWriteLimiter(options){
  return createAddressLimiter(WRITE_LIMIT, WRITE_WINDOW_MS, options);
}

// Counts events per address over a sliding window (options may change the limit and window).
function createAddressLimiter(defaultLimit, defaultWindowMs, options){
  const limit = (options && options.limit) || defaultLimit;
  const windowMs = (options && options.windowMs) || defaultWindowMs;
  const maxAddresses = (options && options.maxAddresses) || MAX_TRACKED_ADDRESSES;
  const now = (options && options.now) || Date.now;
  const hits = new Map(); // address → times of its recent events, oldest first

  function recent(address){
    const list = hits.get(address);
    if(!list) return null;
    const cutoff = now() - windowMs;
    while(list.length > 0 && list[0] <= cutoff) list.shift();
    if(list.length === 0){
      hits.delete(address);
      return null;
    }
    return list;
  }

  return {
    blocked: function(address){
      const list = recent(address);
      return list !== null && list.length >= limit;
    },
    // Records one event. True when this one reaches the limit.
    hit: function(address){
      let list = recent(address);
      if(list === null){
        // Past the cap, the address seen longest ago is forgotten, so memory stays bounded.
        if(hits.size >= maxAddresses) hits.delete(hits.keys().next().value);
        list = [];
        hits.set(address, list);
      }
      list.push(now());
      return list.length === limit;
    },
    // Seconds until the address may try again.
    retryAfter: function(address){
      const list = recent(address);
      return list === null ? 0 : Math.max(1, Math.ceil((list[0] + windowMs - now()) / 1000));
    },
    size: function(){ return hits.size; }
  };
}

// The address a request came from. Behind Railway's proxy that is X-Real-IP, which the proxy
// sets; anywhere else a client could send any X-Real-IP, so the connection's own address is used.
export function clientAddress(req, trustProxy){
  const real = req.headers["x-real-ip"];
  if(trustProxy && typeof real === "string" && real.trim() !== "") return real.trim();
  return req.socket.remoteAddress || "unknown";
}

function route(pathname, importOn){
  if(pathname === "/api/group") return { name: "group", methods: ["GET", "PUT"] };
  if(pathname === "/api/import" && importOn) return { name: "import", methods: ["POST"] };
  if(pathname === "/api/group/events") return { name: "events", methods: ["GET"] };
  if(pathname === "/api/people") return { name: "people", methods: ["POST"] };
  if(pathname === "/api/expenses") return { name: "expenses", methods: ["POST"] };
  const m = /^\/api\/(people|expenses)\/([^/]*)$/.exec(pathname);
  if(m) return { name: m[1] === "people" ? "person" : "expense", methods: ["DELETE"], id: m[2] };
  return null;
}

// The request's JSON body: at most maxBytes, sent as application/json.
function readJson(req, maxBytes){
  return new Promise(function(resolve, reject){
    const type = req.headers["content-type"];
    if(typeof type !== "string" || !/^application\/json\s*(;|$)/i.test(type)){
      return reject(new ApiError(415, "invalid-argument", "content-type"));
    }
    if(Number(req.headers["content-length"]) > maxBytes){
      return reject(new ApiError(413, "invalid-argument", "size"));
    }
    const chunks = [];
    let size = 0;
    let done = false;
    req.on("data", function(chunk){
      if(done) return;
      size += chunk.length;
      if(size > maxBytes){
        done = true;
        return reject(new ApiError(413, "invalid-argument", "size"));
      }
      chunks.push(chunk);
    });
    req.on("end", function(){
      if(done) return;
      done = true;
      try{
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      }catch(e){
        reject(new ApiError(400, "invalid-argument", "json"));
      }
    });
    req.on("error", function(err){
      if(done) return;
      done = true;
      reject(err);
    });
  });
}

// True when the request's "Authorization: Bearer <token>" is the import token. Both are hashed
// first, so the comparison takes the same time whatever the token's length or content.
function isImportToken(header, token){
  const m = typeof header === "string" ? /^Bearer (\S+)$/.exec(header) : null;
  if(!m) return false;
  const digest = function(t){ return createHash("sha256").update(t, "utf8").digest(); };
  return timingSafeEqual(digest(m[1]), digest(token));
}

// A whole group to copy in: { code, currency, people: [{ id, name }], expenses: [{ id, date,
// desc, amountPaise, paidBy, split }] }, each person and expense as the API itself takes them,
// except that a payer or split member need not be among the people: someone removed from the
// old group keeps their share under their old ID, as money.js allows. → null, or what is wrong.
function checkImport(body, maxExpenses){
  if(body === null || typeof body !== "object" || Array.isArray(body)) return "fields";
  const keys = Object.keys(body).sort().join(",");
  if(keys !== "code,currency,expenses,people") return "fields";
  if(!isValidGroupId(body.code)) return "code";
  if(checkGroup({ currency: body.currency })) return "currency";
  if(!Array.isArray(body.people) || body.people.length > MAX_PEOPLE) return "people";
  if(!Array.isArray(body.expenses) || body.expenses.length > maxExpenses) return "expenses";
  if(body.people.some(function(p){ return checkPerson(p) !== null; })) return "people";
  if(body.expenses.some(function(e){ return checkExpense(e) !== null; })) return "expenses";
  const unique = function(list){ return new Set(list.map(function(x){ return x.id; })).size === list.length; };
  if(!unique(body.people)) return "people";
  if(!unique(body.expenses)) return "expenses";
  return null;
}

// True when the browser takes a gzipped answer: the same test as static.js's, kept here so the
// server's part of T-09 deploys on its own before the page's (the switch-over guide's two pushes).
function acceptsGzip(header){
  return typeof header === "string" && /\bgzip\b/i.test(header) && !/\bgzip\s*;\s*q=0(?:\.0*)?(?![\d.])/i.test(header);
}

function sendJson(res, status, body, extra){
  const text = Buffer.from(JSON.stringify(body), "utf8");
  res.writeHead(status, Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": text.length,
    // Group data is never kept by a browser's or a proxy's HTTP cache.
    "Cache-Control": "no-store"
  }, COMMON_HEADERS, extra || {}));
  res.end(text);
}

// options: { ledger (null when the database couldn't be opened), hub, limiter (unknown codes),
// writes (changes), log, trustProxy, maxExpenses and maxSplitEntries (the limits unless a test
// sets them), maxAnswerBytes (for tests),
// importToken (the import endpoint exists only when this is at least MIN_IMPORT_TOKEN_LENGTH long) }
export function createApi(options){
  const ledger = options.ledger;
  const hub = options.hub;
  const limiter = options.limiter;
  const writes = options.writes;
  const log = options.log;
  const trustProxy = options.trustProxy;
  const maxExpenses = options.maxExpenses || MAX_EXPENSES;
  const maxSplitEntries = options.maxSplitEntries || MAX_SPLIT_ENTRIES;
  const maxAnswerBytes = options.maxAnswerBytes || MAX_ANSWER_BYTES;
  const importToken = typeof options.importToken === "string" && options.importToken.length >= MIN_IMPORT_TOKEN_LENGTH
    ? options.importToken : null;

  function fail(req, res, status, code, field, extra){
    if(status !== 429) log("SplitFamilia api: " + req.method + " " + status + " " + code);
    sendJson(res, status, field ? { error: code, field: field } : { error: code }, extra);
  }

  function tooMany(req, res, which, address){
    return fail(req, res, 429, "resource-exhausted", null, { "Retry-After": String(which.retryAfter(address)) });
  }

  // Each group's answer to GET /api/group, built once per version and shared by every reader
  // (D-18): building a large group's answer is the costly part, and an answer a slow reader holds
  // is this one buffer, not a copy each. The gzipped copy is made on Node's worker threads, so the
  // server goes on answering meanwhile. The group seen longest ago goes first when the answers
  // pass maxAnswerBytes. code → { version, json, gzip (a promise of the gzipped copy, or of null
  // when the answer is small), bytes }
  const answers = new Map();
  let answerBytes = 0;
  function groupAnswer(code, version){
    const kept = answers.get(code);
    if(kept){
      answers.delete(code);
      if(kept.version === version){
        answers.set(code, kept);
        return kept;
      }
      answerBytes -= kept.bytes;
    }
    const json = Buffer.from(JSON.stringify(ledger.readGroup(code)), "utf8");
    const answer = { version: version, json: json, gzip: null, bytes: json.length };
    answer.gzip = json.length < GZIP_FROM_BYTES ? Promise.resolve(null) : new Promise(function(resolve){
      gzipAsync(json, function(err, zipped){
        if(err) return resolve(null);
        if(answers.get(code) === answer){
          answer.bytes += zipped.length;
          answerBytes += zipped.length;
          trimAnswers(code);
        }
        resolve(zipped);
      });
    });
    answers.set(code, answer);
    answerBytes += answer.bytes;
    trimAnswers(code);
    return answer;
  }
  function trimAnswers(keep){
    for(const [k, a] of answers){
      if(answerBytes <= maxAnswerBytes || k === keep) break;
      answers.delete(k);
      answerBytes -= a.bytes;
    }
  }
  async function sendGroup(req, res, code, version){
    const answer = groupAnswer(code, version);
    const zipped = acceptsGzip(req.headers["accept-encoding"]) ? await answer.gzip : null;
    const gzip = zipped !== null;
    const body = gzip ? zipped : answer.json;
    const headers = Object.assign({
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": body.length,
      "Cache-Control": "no-store",
      "Vary": "Accept-Encoding"
    }, COMMON_HEADERS);
    if(gzip) headers["Content-Encoding"] = "gzip";
    res.writeHead(200, headers);
    res.end(body);
  }

  // A change the group saw: every page showing it hears the new version.
  function changed(res, status, code, version){
    hub.publish(code, version);
    sendJson(res, status, { version: version });
  }

  // The move from the old database (SF-037): the token holder copies in a whole group. It isn't
  // a guess or a change from a phone, so neither limit counts it. A wrong token looks like no
  // such path.
  async function importGroup(req, res){
    if(!isImportToken(req.headers["authorization"], importToken)) return fail(req, res, 404, "not-found");
    if(!ledger) return fail(req, res, 503, "unavailable");
    const body = await readJson(req, MAX_IMPORT_BYTES);
    const problem = checkImport(body, maxExpenses);
    if(problem) return fail(req, res, 400, "invalid-argument", problem);
    const code = body.code;
    const exists = ledger.groupVersion(code) !== null;
    const newPeople = body.people.filter(function(p){ return !ledger.personExists(code, p.id); }).length;
    const newExpenses = body.expenses.filter(function(e){ return !ledger.expenseExists(code, e.id); });
    const people = (exists ? ledger.personIds(code).size : 0) + newPeople;
    const expenses = (exists ? ledger.expenseCount(code) : 0) + newExpenses.length;
    const entries = (exists ? ledger.splitEntryCount(code) : 0) + newExpenses.reduce(function(n, e){ return n + e.split.length; }, 0);
    if(people > MAX_PEOPLE || expenses > maxExpenses || entries > maxSplitEntries) return fail(req, res, 409, "failed-precondition", "group-full");
    const result = ledger.importGroup(code, { currency: body.currency, people: body.people, expenses: body.expenses });
    hub.publish(code, result.version);
    return sendJson(res, 200, { version: result.version, created: result.created, added: result.added });
  }

  async function handle(req, res, pathname){
    const r = route(pathname, importToken !== null);
    if(!r) return fail(req, res, 404, "not-found");
    if(!r.methods.includes(req.method)) return fail(req, res, 405, "invalid-argument", "method", { "Allow": r.methods.join(", ") });
    if(r.name === "import") return importGroup(req, res);

    const address = clientAddress(req, trustProxy);
    if(limiter.blocked(address)) return tooMany(req, res, limiter, address);
    const code = req.headers[GROUP_HEADER];
    if(!isValidGroupId(code)) return fail(req, res, 400, "invalid-argument", "code");
    if(r.id !== undefined && !isValidId(r.id)) return fail(req, res, 400, "invalid-argument", "id");
    if(!ledger) return fail(req, res, 503, "unavailable");

    let body = null;
    if(req.method === "PUT" || req.method === "POST"){
      body = await readJson(req, MAX_BODY_BYTES);
      const problem = r.name === "group" ? checkGroup(body) : r.name === "people" ? checkPerson(body) : checkExpense(body);
      if(problem) return fail(req, res, 400, "invalid-argument", problem);
    }

    // From here on nothing waits, so each check and its write see the same database, and each
    // limit is checked and counted together. The body's wait let other requests from this
    // address past the check above, so it is checked again (T-08 review, F-8).
    if(limiter.blocked(address)) return tooMany(req, res, limiter, address);
    if(req.method !== "GET"){
      if(writes.blocked(address)) return tooMany(req, res, writes, address);
      if(writes.hit(address)) log("SplitFamilia api: an address reached the limit of changes");
    }
    const version = ledger.groupVersion(code);
    const creating = r.name === "group" && req.method === "PUT";
    if(version === null){
      // An unknown code, or a new group: both count towards the limit.
      if(limiter.hit(address)) log("SplitFamilia api: an address reached the limit of unknown group codes");
      if(!creating) return fail(req, res, 404, "not-found");
    }

    if(r.name === "group" && req.method === "GET") return sendGroup(req, res, code, version);
    if(creating) return changed(res, 200, code, ledger.setCurrency(code, body.currency).version);
    if(r.name === "events"){
      if(hub.full(address)) return fail(req, res, 503, "unavailable");
      return hub.open(code, res, version, address);
    }
    if(r.name === "people"){
      // A second copy of someone already here succeeds as it is, even in a full group.
      if(ledger.personExists(code, body.id)) return sendJson(res, 200, { version: version });
      if(ledger.personIds(code).size >= MAX_PEOPLE) return fail(req, res, 409, "failed-precondition", "group-full");
      const result = ledger.addPerson(code, body);
      return result.added ? changed(res, 201, code, result.version) : sendJson(res, 200, { version: result.version });
    }
    if(r.name === "person"){
      if(ledger.personInUse(code, r.id)) return fail(req, res, 409, "failed-precondition", "in-use");
      const result = ledger.deletePerson(code, r.id);
      return result.deleted ? changed(res, 200, code, result.version) : sendJson(res, 200, { version: result.version });
    }
    if(r.name === "expenses"){
      // A second copy of an expense already here succeeds as it is, even if its payer has since
      // been removed or the group is full: the phone's first send got through.
      if(ledger.expenseExists(code, body.id)) return sendJson(res, 200, { version: version });
      if(ledger.expenseCount(code) >= maxExpenses) return fail(req, res, 409, "failed-precondition", "group-full");
      if(ledger.splitEntryCount(code) + body.split.length > maxSplitEntries) return fail(req, res, 409, "failed-precondition", "group-full");
      const problem = checkExpense(body, ledger.personIds(code));
      if(problem) return fail(req, res, 400, "invalid-argument", problem);
      const result = ledger.addExpense(code, body);
      return result.added ? changed(res, 201, code, result.version) : sendJson(res, 200, { version: result.version });
    }
    // r.name === "expense"
    const result = ledger.deleteExpense(code, r.id);
    return result.deleted ? changed(res, 200, code, result.version) : sendJson(res, 200, { version: result.version });
  }

  return function(req, res, pathname){
    return handle(req, res, pathname).catch(function(err){
      if(err instanceof ApiError){
        // A body that wasn't read is left unread, so the connection isn't used again.
        const close = err.status === 413 || err.status === 415 ? { "Connection": "close" } : undefined;
        return fail(req, res, err.status, err.code, err.field, close);
      }
      // Only the error's code or name, never its message, which could hold typed text.
      log("SplitFamilia api: " + req.method + " 500 internal (" + ((err && (err.code || err.name)) || "unknown") + ")");
      if(!res.headersSent) sendJson(res, 500, { error: "internal" });
      else res.destroy();
    });
  };
}
