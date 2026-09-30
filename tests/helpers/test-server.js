// Starts the real server in this process on a free port, with a new database file in a temporary
// folder. Nothing here touches the network beyond 127.0.0.1, or any real database.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "node:http";
import { createApp } from "../../server/server.js";

export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

// options: anything createApp takes (dbFile defaults to a new temporary file), and `port`
// (a free one if left out).
// → { app, base, logs, dir, close() }
export async function startTestServer(options){
  const dir = mkdtempSync(join(tmpdir(), "splitfamilia-test-"));
  const logs = [];
  const app = createApp(Object.assign({
    root: REPO_ROOT,
    dbFile: join(dir, "splitfamilia.db"),
    log: function(line){ logs.push(line); }
  }, options || {}));
  const port = (options && options.port) || 0;
  await new Promise(function(resolve, reject){
    app.server.once("error", reject);
    app.server.listen(port, "127.0.0.1", resolve);
  });
  return {
    app: app,
    base: "http://127.0.0.1:" + app.server.address().port,
    logs: logs,
    dir: dir,
    close: async function(){
      await app.close();
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  };
}

// One API call. → { status, body (parsed JSON, or null), headers }
export async function api(base, method, path, options){
  options = options || {};
  const headers = Object.assign({}, options.headers || {});
  if(options.code !== undefined) headers["X-Group-Code"] = options.code;
  let body;
  if(options.body !== undefined){
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    if(!("Content-Type" in headers)) headers["Content-Type"] = "application/json";
  }
  const res = await fetch(base + path, { method: method, headers: headers, body: body });
  const text = await res.text();
  let parsed = null;
  try{ parsed = text ? JSON.parse(text) : null; }catch(e){ parsed = null; }
  return { status: res.status, body: parsed, headers: res.headers };
}

// A raw request with the path exactly as given (fetch would clean up "/../x") and no automatic
// decompression. → { status, headers, body: Buffer }
export function raw(base, path, options){
  options = options || {};
  const url = new URL(base);
  return new Promise(function(resolve, reject){
    const req = request({
      host: url.hostname, port: url.port, path: path,
      method: options.method || "GET", headers: options.headers || {}
    }, function(res){
      const chunks = [];
      res.on("data", function(c){ chunks.push(c); });
      res.on("end", function(){ resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }); });
    });
    req.on("error", reject);
    req.end(options.body);
  });
}
