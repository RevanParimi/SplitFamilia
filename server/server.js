// SplitFamilia's server (SF-031 to SF-034): the app's files, /healthz, the ledger API and its
// live updates, in one process with only Node's built-in modules. main.js starts it on Railway;
// tests start it in-process on a free port.
import { createServer } from "node:http";
import { loadStaticFiles, serveStatic, sendText, COMMON_HEADERS } from "./static.js";
import { openLedger } from "./db.js";
import { createApi, createGuessLimiter, createWriteLimiter, SWEEP_MS } from "./api.js";
import { createLiveHub } from "./live.js";

// True when the path has a "." or ".." segment, however it is written ("/..", "/%2e%2e/",
// "/.%2E\x"). Such a request is refused outright, even where cleaning it up would give a real file.
function hasDotSegment(url){
  const path = url.split(/[?#]/)[0].replace(/%2e/gi, ".").replace(/%2f/gi, "/").replace(/%5c/gi, "\\");
  return /(^|[/\\])\.\.?([/\\]|$)/.test(path);
}

// The path of a request's URL, without its query. The URL is read against a fixed origin, so
// "//host/x" stays a path. null when it can't be read.
function pathOf(url){
  if(typeof url !== "string" || !url.startsWith("/")) return null;
  try{
    return new URL("https://splitfamilia.invalid" + url).pathname;
  }catch(e){
    return null;
  }
}

// Why the database didn't open, without anything a person typed: SQLite's own short reason
// ("unable to open database file") or the system's error code.
function reason(err){
  return (err && (err.errstr || err.code || err.name)) || "unknown";
}

// options:
// - root: the folder holding the app's files (the image's /app, or this repo);
// - dbFile: the SQLite file;
// - storage: "volume" or "local", shown by /healthz;
// - log(line): where log lines go (console.log by default);
// - trustProxy: true behind Railway's proxy (see clientAddress in api.js);
// - importToken: the IMPORT_TOKEN variable, which opens POST /api/import (SF-037) while it is set;
// - heartbeatMs, maxStreams, maxStreamsPerAddress, guessLimit, guessWindowMs, writeLimit,
//   writeWindowMs, sweepMs, maxExpenses, maxSplitEntries, maxAnswerBytes, now: for tests.
export function createApp(options){
  const log = options.log || console.log;
  const files = loadStaticFiles(options.root);

  let ledger = null;
  try{
    ledger = openLedger(options.dbFile);
  }catch(err){
    // The page is still served (it doesn't need the database until T-09); the API answers 503.
    log("SplitFamilia server: the database is unavailable (" + reason(err) + "). The API answers 503.");
  }

  const hub = createLiveHub({
    heartbeatMs: options.heartbeatMs, maxStreams: options.maxStreams, maxStreamsPerAddress: options.maxStreamsPerAddress
  });
  const limiter = createGuessLimiter({ limit: options.guessLimit, windowMs: options.guessWindowMs, now: options.now });
  const writes = createWriteLimiter({ limit: options.writeLimit, windowMs: options.writeWindowMs, now: options.now });
  // The privacy policy says the server forgets an address within 11 minutes of its last request
  // (the T-06 review's F-16): the limiters are swept every 30 seconds. The timer doesn't keep the
  // process running, and close() stops it.
  const sweeper = setInterval(function(){
    limiter.sweep();
    writes.sweep();
  }, options.sweepMs || SWEEP_MS);
  sweeper.unref();
  const api = createApi({
    ledger: ledger, hub: hub, limiter: limiter, writes: writes, log: log,
    trustProxy: Boolean(options.trustProxy), maxExpenses: options.maxExpenses, maxSplitEntries: options.maxSplitEntries,
    maxAnswerBytes: options.maxAnswerBytes, importToken: options.importToken
  });
  // Since the switch-over the app needs its database, so /healthz fails without it (the T-08
  // review's N-5): Railway then keeps the last good deploy instead of this one.
  const health = {
    status: ledger ? "ok" : "unavailable",
    database: ledger ? "ok" : "unavailable",
    storage: options.storage || "local"
  };

  const server = createServer(function(req, res){
    const path = pathOf(req.url);
    if(path === null) return sendText(res, 400, "Bad request");
    if(hasDotSegment(req.url)) return sendText(res, 404, "Not found");
    if(path === "/healthz"){
      if(req.method !== "GET" && req.method !== "HEAD") return sendText(res, 405, "Method not allowed", { "Allow": "GET, HEAD" });
      const body = Buffer.from(JSON.stringify(health), "utf8");
      res.writeHead(ledger ? 200 : 503, Object.assign({
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": body.length,
        "Cache-Control": "no-store"
      }, COMMON_HEADERS));
      return res.end(req.method === "HEAD" ? undefined : body);
    }
    if(path === "/api" || path.startsWith("/api/")) return api(req, res, path);
    return serveStatic(req, res, files, path);
  });
  // Railway's proxy keeps idle connections for 60 seconds; the server must keep them longer, or it
  // may close one just as the proxy sends the next request on it.
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // Requests still being answered, so a shutdown can close every other connection at once
  // (including ones opened ahead of time that never sent a request).
  let inFlight = 0;
  let closing = false;
  server.on("request", function(req, res){
    inFlight++;
    res.on("close", function(){
      inFlight--;
      if(closing && inFlight === 0) server.closeAllConnections();
    });
  });

  return {
    server: server,
    hub: hub,
    ledger: ledger,
    limiter: limiter,
    writes: writes,
    // Stops taking requests, ends the live streams (pages reconnect), and closes the database.
    close: function(){
      return new Promise(function(resolve){
        closing = true;
        clearInterval(sweeper);
        hub.closeAll();
        // A request still running after 3 seconds is cut off; a phone sends it again.
        const force = setTimeout(function(){ server.closeAllConnections(); }, 3000);
        server.close(function(){
          clearTimeout(force);
          if(ledger) ledger.close();
          resolve();
        });
        if(inFlight === 0) server.closeAllConnections();
      });
    }
  };
}
