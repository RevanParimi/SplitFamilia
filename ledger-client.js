// The page's side of its server (SF-034; the page starts using it in T-09, SF-035). Only what
// every browser has (fetch, TextDecoder, AbortController, timers), so npm test runs it in Node
// against the real server.
//
// Live updates come as a stream in Server-Sent Events format, read with fetch rather than
// EventSource, because only fetch can send the group code in a header: the code never goes in a
// URL, where request logs would record it.

export const GROUP_HEADER = "X-Group-Code";
export const EVENTS_PATH = "/api/group/events";
// No data for this long (the server sends a heartbeat every 25 s) means the connection is dead,
// for example after the phone changed networks: drop it and connect again.
export const IDLE_MS = 60000;

// How long to wait before connecting again after `failures` failed tries in a row:
// 1 s, 2 s, 4 s, 8 s, 16 s, then 30 s each time.
export function reconnectDelay(failures){
  return Math.min(1000 * Math.pow(2, failures), 30000);
}

// Reads a Server-Sent Events stream as its text arrives, in pieces of any size. Returns
// feed(text) → the events completed by that text: [{ event, data }]. Comment lines (the
// heartbeat) complete no event.
export function createEventParser(){
  let buffer = "";
  let event = "";
  let data = [];
  return function feed(text){
    buffer += text;
    const events = [];
    for(;;){
      const end = buffer.search(/\r\n|\r|\n/);
      if(end === -1) break;
      // A "\r" at the very end may be the first half of "\r\n": wait for the next piece.
      if(buffer[end] === "\r" && end === buffer.length - 1) break;
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + (buffer.startsWith("\r\n", end) ? 2 : 1));
      if(line === ""){
        if(data.length > 0) events.push({ event: event || "message", data: data.join("\n") });
        event = "";
        data = [];
        continue;
      }
      if(line[0] === ":") continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if(value[0] === " ") value = value.slice(1);
      if(field === "event") event = value;
      else if(field === "data") data.push(value);
    }
    return events;
  };
}

function versionOf(data){
  try{
    const v = JSON.parse(data).version;
    return Number.isSafeInteger(v) && v > 0 ? v : null;
  }catch(e){
    return null;
  }
}

// At most one live connection per open page: starting a new watch stops the one before.
let active = null;

// Watches group `code` for changes. options:
// - code: the group code;
// - onVersion(version): the group's version, at once and after every change;
// - onState(state, detail): "connecting", "live", "retrying" (detail: the wait in ms), or
//   "stopped" (detail: "not-found" or "invalid-argument", which trying again won't fix);
// - baseUrl: "" for the page's own server;
// - fetch, setTimeout, clearTimeout, idleMs: for tests.
// Returns { stop(), reconnectNow() }. The page calls reconnectNow() when the phone comes back
// online, so it doesn't wait out the delay.
export function watchGroup(options){
  if(active) active.stop();
  const handle = startWatch(options);
  active = handle;
  return handle;
}

function startWatch(options){
  const doFetch = options.fetch || globalThis.fetch.bind(globalThis);
  const setTimer = options.setTimeout || globalThis.setTimeout.bind(globalThis);
  const clearTimer = options.clearTimeout || globalThis.clearTimeout.bind(globalThis);
  const idleMs = options.idleMs || IDLE_MS;
  const onVersion = options.onVersion || function(){};
  const onState = options.onState || function(){};
  const url = (options.baseUrl || "") + EVENTS_PATH;

  let stopped = false;
  let failures = 0;
  let controller = null;
  let retryTimer = null;
  let idleTimer = null;

  function clearTimers(){
    if(retryTimer !== null) clearTimer(retryTimer);
    if(idleTimer !== null) clearTimer(idleTimer);
    retryTimer = null;
    idleTimer = null;
  }

  function armIdle(ctrl){
    if(idleTimer !== null) clearTimer(idleTimer);
    idleTimer = setTimer(function(){ ctrl.abort(); }, idleMs);
  }

  function connect(){
    retryTimer = null;
    if(stopped) return;
    const ctrl = new AbortController();
    controller = ctrl;
    onState("connecting");
    const headers = { "Accept": "text/event-stream" };
    headers[GROUP_HEADER] = options.code;
    doFetch(url, { headers: headers, cache: "no-store", signal: ctrl.signal })
      .then(function(res){
        if(!res.ok){
          if(res.body) res.body.cancel().catch(function(){});
          // A bad or unknown code won't fix itself; anything else (the server restarting, busy,
          // the address waiting out its limit) may.
          const final = res.status === 400 ? "invalid-argument" : res.status === 404 ? "not-found" : null;
          throw { final: final };
        }
        return read(res.body.getReader(), ctrl);
      })
      .then(function(){ retry(ctrl); }, function(err){
        if(err && err.final){
          stop();
          onState("stopped", err.final);
        }else{
          retry(ctrl);
        }
      });
  }

  async function read(reader, ctrl){
    const decoder = new TextDecoder();
    const feed = createEventParser();
    armIdle(ctrl);
    for(;;){
      const chunk = await reader.read();
      if(chunk.done) return;
      armIdle(ctrl);
      feed(decoder.decode(chunk.value, { stream: true })).forEach(function(ev){
        const version = ev.event === "version" ? versionOf(ev.data) : null;
        if(version === null || stopped || ctrl !== controller) return;
        failures = 0; // connected: the next drop starts again at 1 s
        onState("live");
        onVersion(version);
      });
    }
  }

  // The stream ended or failed: connect again after the delay. A stream that was replaced or
  // stopped does nothing.
  function retry(ctrl){
    if(stopped || ctrl !== controller) return;
    clearTimers();
    const wait = reconnectDelay(failures);
    failures++;
    onState("retrying", wait);
    retryTimer = setTimer(connect, wait);
  }

  function stop(){
    stopped = true;
    clearTimers();
    if(controller) controller.abort();
    controller = null;
    if(active === handle) active = null;
  }

  const handle = {
    stop: stop,
    reconnectNow: function(){
      if(stopped) return;
      clearTimers();
      failures = 0;
      const old = controller;
      controller = null;
      if(old) old.abort();
      connect();
    }
  };
  connect();
  return handle;
}
