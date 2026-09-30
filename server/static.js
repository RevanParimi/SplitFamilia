// The app's own files (SF-031), with the headers the Caddyfile used to set. Only the files listed
// here are ever served: never docs/, tests/, the server's own code, the database or any dotfile
// but assetlinks.json, whatever else sits in the folder. tests/wiring.test.js checks this list
// against the service worker's SHELL and the Dockerfile.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

const JS = "text/javascript; charset=utf-8";
export const STATIC_FILES = {
  "/index.html": "text/html; charset=utf-8",
  "/service-worker.js": JS,
  "/money.js": JS,
  "/group-code.js": JS,
  "/sync-status.js": JS,
  "/ledger-rules.js": JS,
  "/ledger-client.js": JS,
  "/outbox.js": JS,
  "/manifest.json": "application/json",
  "/icon-192.png": "image/png",
  "/icon-512.png": "image/png",
  "/apple-touch-icon.png": "image/png",
  // Android checks this file to let the app open full screen (SF-012).
  "/.well-known/assetlinks.json": "application/json"
};

// On every response, files, errors and the API alike.
export const COMMON_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin"
};

function etagOf(body, suffix){
  return "\"" + createHash("sha256").update(body).digest("base64url").slice(0, 27) + suffix + "\"";
}

// Reads every listed file once, at start. A missing file stops the server from starting, so
// Railway's health check fails and the last good deploy stays live. Restart after editing a file.
export function loadStaticFiles(root){
  const files = new Map();
  Object.keys(STATIC_FILES).forEach(function(path){
    const type = STATIC_FILES[path];
    const body = readFileSync(join(root, path.slice(1)));
    const file = { type: type, body: body, etag: etagOf(body, ""), gzip: null, gzipEtag: null };
    if(!type.startsWith("image/")){
      const gz = gzipSync(body, { level: 9 });
      if(gz.length < body.length){
        file.gzip = gz;
        file.gzipEtag = etagOf(body, "-gz");
      }
    }
    files.set(path, file);
  });
  return files;
}

function acceptsGzip(header){
  return typeof header === "string" && /\bgzip\b/i.test(header) && !/\bgzip\s*;\s*q=0(?:\.0*)?(?![\d.])/i.test(header);
}

function matchesEtag(header, etag){
  if(typeof header !== "string") return false;
  return header.split(",").some(function(t){
    t = t.trim().replace(/^W\//, "");
    return t === "*" || t === etag;
  });
}

export function sendText(res, status, text, extra){
  const body = Buffer.from(text + "\n", "utf8");
  res.writeHead(status, Object.assign({
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-cache"
  }, COMMON_HEADERS, extra || {}));
  res.end(body);
}

// Serves `path` (already parsed from the URL, without its query) from `files`, or a 404.
// "/" is the page itself, served directly (no redirect), so the service worker keeps one copy.
export function serveStatic(req, res, files, path){
  const file = files.get(path === "/" ? "/index.html" : path);
  if(!file) return sendText(res, 404, "Not found");
  if(req.method !== "GET" && req.method !== "HEAD"){
    return sendText(res, 405, "Method not allowed", { "Allow": "GET, HEAD" });
  }
  const gzip = file.gzip !== null && acceptsGzip(req.headers["accept-encoding"]);
  const etag = gzip ? file.gzipEtag : file.etag;
  const headers = Object.assign({
    "Content-Type": file.type,
    // Every file is checked with the server on each fetch (a quick 304 when unchanged), so an
    // update reaches phones on their next open. The service worker keeps the offline copy.
    "Cache-Control": "no-cache",
    "ETag": etag
  }, COMMON_HEADERS);
  if(file.gzip !== null) headers["Vary"] = "Accept-Encoding";
  if(matchesEtag(req.headers["if-none-match"], etag)){
    res.writeHead(304, headers);
    return res.end();
  }
  const body = gzip ? file.gzip : file.body;
  if(gzip) headers["Content-Encoding"] = "gzip";
  headers["Content-Length"] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}
