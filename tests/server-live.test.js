// SF-034: live updates. The real server in-process, and the page's reader (ledger-client.js)
// against it.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTestServer, api } from "./helpers/test-server.js";
import { openLedger } from "../server/db.js";
import { watchGroup, createEventParser, reconnectDelay, GROUP_HEADER, EVENTS_PATH } from "../ledger-client.js";

let t;
// One test opens 100 streams from this one address, so this server allows that; the cap of 10 per
// address has its own test, on a server of its own.
before(async function(){ t = await startTestServer({ guessLimit: 100000, maxStreamsPerAddress: 1000 }); });
after(async function(){ await t.close(); });

let seq = 0;
async function newGroup(){
  const code = "live-" + (++seq);
  await api(t.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } });
  await api(t.base, "POST", "/api/people", { code: code, body: { id: "asha", name: "Asha" } });
  return code; // at version 2
}

function waitFor(check, ms, label){
  const until = Date.now() + (ms || 2000);
  return new Promise(function(resolve, reject){
    (function poll(){
      if(check()) return resolve();
      if(Date.now() > until) return reject(new Error("timed out: " + (label || "")));
      setTimeout(poll, 5);
    })();
  });
}
const pause = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };

// A raw stream, as a second phone would hold it: its events and how many comment lines came.
async function openStream(base, code, extraHeaders){
  const ctrl = new AbortController();
  const headers = Object.assign({}, extraHeaders || {});
  headers[GROUP_HEADER] = code;
  const res = await fetch(base + EVENTS_PATH, { headers: headers, signal: ctrl.signal });
  const stream = { res: res, events: [], comments: 0, ended: false, close: function(){ ctrl.abort(); } };
  if(!res.ok){ await res.text(); return stream; }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const feed = createEventParser();
  (async function(){
    try{
      for(;;){
        const chunk = await reader.read();
        if(chunk.done) break;
        const text = decoder.decode(chunk.value, { stream: true });
        stream.comments += (text.match(/^:/gm) || []).length;
        feed(text).forEach(function(ev){ stream.events.push(ev); });
      }
    }catch(e){ /* closed by the test */ }
    stream.ended = true;
  })();
  return stream;
}

test("the stream sends the group's version at once, as a no-store event stream", async function(){
  const code = await newGroup();
  const s = await openStream(t.base, code);
  try{
    assert.equal(s.res.status, 200);
    assert.equal(s.res.headers.get("content-type"), "text/event-stream; charset=utf-8");
    assert.equal(s.res.headers.get("cache-control"), "no-store");
    assert.equal(s.res.headers.get("x-content-type-options"), "nosniff");
    await waitFor(function(){ return s.events.length === 1; });
    assert.deepEqual(s.events, [{ event: "version", data: "{\"version\":2}" }]);
  }finally{ s.close(); }
});

test("two phones on one group: one adds an expense, the other hears it within 1 s; another group hears nothing", async function(){
  const code = await newGroup();
  const other = await newGroup();
  const heard = [];
  const states = [];
  const ben = watchGroup({ code: code, baseUrl: t.base, onVersion: function(v){ heard.push({ v: v, at: Date.now() }); }, onState: function(s){ states.push(s); } });
  const elsewhere = await openStream(t.base, other);
  try{
    await waitFor(function(){ return heard.length === 1; });
    assert.equal(heard[0].v, 2);
    assert.deepEqual(states, ["connecting", "live"]);
    await waitFor(function(){ return elsewhere.events.length === 1; });

    const sent = Date.now();
    const res = await api(t.base, "POST", "/api/expenses", { code: code, body: { id: "taxi", date: new Date().toISOString(), desc: "Taxi", amountPaise: 5000, paidBy: "asha", split: ["asha"] } });
    assert.equal(res.status, 201);
    await waitFor(function(){ return heard.length === 2; }, 1000, "the other phone within 1 s");
    assert.equal(heard[1].v, 3);
    assert.ok(heard[1].at - sent < 1000);
    // A change that changes nothing (the same expense again) sends nothing.
    await api(t.base, "POST", "/api/expenses", { code: code, body: { id: "taxi", date: new Date().toISOString(), desc: "Taxi", amountPaise: 5000, paidBy: "asha", split: ["asha"] } });
    await api(t.base, "DELETE", "/api/expenses/taxi", { code: code });
    await waitFor(function(){ return heard.length === 3; });
    assert.deepEqual(heard.map(function(h){ return h.v; }), [2, 3, 4]);
    await pause(100);
    assert.deepEqual(elsewhere.events.map(function(e){ return e.data; }), ["{\"version\":2}"]);
  }finally{
    ben.stop();
    elsewhere.close();
  }
});

test("a heartbeat comment arrives while nothing changes", async function(){
  const h = await startTestServer({ heartbeatMs: 40 });
  try{
    await api(h.base, "PUT", "/api/group", { code: "quiet", body: { currency: "₹" } });
    const s = await openStream(h.base, "quiet");
    await waitFor(function(){ return s.comments >= 3; }, 1000, "three heartbeats");
    assert.equal(s.events.length, 1);
    s.close();
    await waitFor(function(){ return h.app.hub.count() === 0 && !h.app.hub.ticking(); }, 1000, "the heartbeat timer stops with the last stream");
  }finally{
    await h.close();
  }
});

test("100 streams opened and closed leave nothing behind", async function(){
  const code = await newGroup();
  const other = await newGroup();
  const hub = t.app.hub;
  const streams = [];
  for(let i = 0; i < 100; i++) streams.push(await openStream(t.base, i % 4 === 0 ? other : code));
  await waitFor(function(){ return hub.count(code) === 75 && hub.count(other) === 25; }, 3000, "100 open");
  assert.equal(hub.groups(), 2);
  assert.ok(hub.ticking());
  streams.forEach(function(s){ s.close(); });
  await waitFor(function(){ return hub.count() === 0; }, 3000, "all closed");
  assert.equal(hub.groups(), 0);
  assert.equal(hub.addresses(), 0);
  assert.equal(hub.ticking(), false);
  // Publishing to a group nobody watches is harmless.
  const res = await api(t.base, "PUT", "/api/group", { code: code, body: { currency: "$" } });
  assert.equal(res.status, 200);
});

test("at most one live connection per page: a new watch stops the old one", async function(){
  const first = await newGroup();
  const second = await newGroup();
  const hub = t.app.hub;
  const handles = [];
  try{
    handles.push(watchGroup({ code: first, baseUrl: t.base }));
    await waitFor(function(){ return hub.count(first) === 1; });
    handles.push(watchGroup({ code: second, baseUrl: t.base }));
    await waitFor(function(){ return hub.count(first) === 0 && hub.count(second) === 1; }, 1000, "the first watch stopped");
    const again = watchGroup({ code: second, baseUrl: t.base });
    handles.push(again);
    await pause(50);
    await waitFor(function(){ return hub.count(second) === 1; });
    again.reconnectNow();
    await pause(50);
    await waitFor(function(){ return hub.count(second) === 1; });
    again.stop();
    await waitFor(function(){ return hub.count() === 0; });
  }finally{
    // Even if a check above failed, no watch is left reconnecting.
    handles.forEach(function(h){ h.stop(); });
  }
});

test("reconnect delays grow 1 s, 2 s, 4 s, 8 s, 16 s, then stay at 30 s", async function(){
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 10].map(reconnectDelay), [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  const waits = [];
  let tries = 0;
  const h = watchGroup({
    code: "anything",
    fetch: function(){ tries++; return Promise.reject(new TypeError("fetch failed")); },
    setTimeout: function(fn, ms){ waits.push(ms); return setTimeout(fn, 0); },
    onState: function(){}
  });
  await waitFor(function(){ return waits.length >= 8; });
  h.stop();
  assert.deepEqual(waits.slice(0, 8), [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  const after = tries;
  await pause(30);
  assert.equal(tries, after, "no try after stop()");
});

test("a server restart drops every stream, and the page reconnects to the new server", async function(){
  const dir = mkdtempSync(join(tmpdir(), "splitfamilia-restart-"));
  const dbFile = join(dir, "splitfamilia.db");
  let first = await startTestServer({ dbFile: dbFile });
  const port = Number(new URL(first.base).port);
  await api(first.base, "PUT", "/api/group", { code: "restart", body: { currency: "₹" } });
  const heard = [];
  const states = [];
  // Waits are shortened a hundredfold, so the test doesn't take seconds.
  const h = watchGroup({
    code: "restart", baseUrl: first.base,
    onVersion: function(v){ heard.push(v); }, onState: function(s, d){ states.push(d === undefined ? s : s + ":" + d); },
    setTimeout: function(fn, ms){ return setTimeout(fn, ms / 100); }
  });
  let second = null;
  try{
    await waitFor(function(){ return heard.length === 1; });
    await first.app.close();
    await waitFor(function(){ return states.includes("retrying:2000"); }, 2000, "at least two failed tries");
    // A change while the server was down (made straight in the file), then the new server.
    const ledger = openLedger(dbFile);
    ledger.setCurrency("restart", "$");
    ledger.close();
    second = await startTestServer({ dbFile: dbFile, port: port });
    await waitFor(function(){ return heard.length === 2; }, 3000, "reconnected");
    assert.deepEqual(heard, [1, 2]);
    assert.deepEqual(states.slice(0, 3), ["connecting", "live", "retrying:1000"]);
    assert.equal(states[states.length - 1], "live");
    assert.equal(second.app.hub.count("restart"), 1);
  }finally{
    h.stop();
    if(second) await second.close();
    rmSync(first.dir, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("an unknown or invalid code stops the watch instead of trying forever", async function(){
  for(const [code, reason] of [["no-such-group", "not-found"], ["Not-A-Code", "invalid-argument"]]){
    const states = [];
    let tries = 0;
    const h = watchGroup({
      code: code, baseUrl: t.base,
      fetch: function(url, init){ tries++; return fetch(url, init); },
      onState: function(s, d){ states.push(d === undefined ? s : s + ":" + d); }
    });
    await waitFor(function(){ return states.length === 2; });
    assert.deepEqual(states, ["connecting", "stopped:" + reason]);
    await pause(50);
    assert.equal(tries, 1);
    h.stop();
  }
});

test("a stream that goes quiet is dropped and opened again", async function(){
  const q = await startTestServer({ heartbeatMs: 60000 });
  try{
    await api(q.base, "PUT", "/api/group", { code: "silent", body: { currency: "₹" } });
    const heard = [];
    const states = [];
    // idleMs 10 s and waits shortened a hundredfold: silence for 100 ms counts as dead.
    const h = watchGroup({
      code: "silent", baseUrl: q.base, idleMs: 10000,
      onVersion: function(v){ heard.push(v); }, onState: function(s){ states.push(s); },
      setTimeout: function(fn, ms){ return setTimeout(fn, ms / 100); }
    });
    await waitFor(function(){ return heard.length >= 2; }, 2000, "dropped and reopened");
    h.stop();
    assert.deepEqual(heard.slice(0, 2), [1, 1]);
    assert.deepEqual(states.slice(0, 4), ["connecting", "live", "retrying", "connecting"]);
    await waitFor(function(){ return q.app.hub.count() === 0; });
  }finally{
    await q.close();
  }
});

test("stopping the server ends each stream", async function(){
  const s2 = await startTestServer();
  await api(s2.base, "PUT", "/api/group", { code: "bye", body: { currency: "₹" } });
  const s = await openStream(s2.base, "bye");
  await waitFor(function(){ return s.events.length === 1; });
  await s2.close();
  await waitFor(function(){ return s.ended; }, 2000, "the stream ends");
});

test("the event reader copes with pieces of any size and every line ending", function(){
  const feed = createEventParser();
  assert.deepEqual(feed("event: vers"), []);
  assert.deepEqual(feed("ion\ndata: {\"version\":"), []);
  assert.deepEqual(feed("7}\n"), []);
  assert.deepEqual(feed("\n"), [{ event: "version", data: "{\"version\":7}" }]);
  assert.deepEqual(feed(": keep-alive\n\n"), []);
  assert.deepEqual(feed("event: version\r"), []);
  // The last "\r" may be half of "\r\n", so the blank line waits for the next piece.
  assert.deepEqual(feed("\ndata:8\r\n\r\ndata: a\ndata: b\r\r"), [{ event: "version", data: "8" }]);
  assert.deepEqual(feed("\n"), [{ event: "message", data: "a\nb" }]);
  assert.deepEqual(feed("event: nothing\n\n"), []);
});

test("one address holds at most 10 streams: the 11th gets 503, others still get theirs, and closing one frees a place", async function(){
  // Behind the proxy, so two addresses can be told apart; the real cap of 10 (the owner, D-17).
  const p = await startTestServer({ trustProxy: true });
  const streams = [];
  try{
    const code = "crowded-trip";
    await api(p.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } });
    const asha = { "X-Real-IP": "1.1.1.1" };
    for(let i = 0; i < 10; i++){
      const s = await openStream(p.base, code, asha);
      streams.push(s);
      assert.equal(s.res.status, 200, "stream " + (i + 1));
    }
    await waitFor(function(){ return p.app.hub.countFrom("1.1.1.1") === 10; }, 2000, "10 open");
    const eleventh = await openStream(p.base, code, asha);
    assert.equal(eleventh.res.status, 503);
    // Another family's phone still gets its stream.
    const ben = await openStream(p.base, code, { "X-Real-IP": "2.2.2.2" });
    streams.push(ben);
    assert.equal(ben.res.status, 200);
    // Closing one of the ten makes room for one more.
    streams[0].close();
    await waitFor(function(){ return p.app.hub.countFrom("1.1.1.1") === 9; }, 2000, "one closed");
    const again = await openStream(p.base, code, asha);
    streams.push(again);
    assert.equal(again.res.status, 200);
    streams.forEach(function(s){ s.close(); });
    await waitFor(function(){ return p.app.hub.count() === 0; }, 2000, "all closed");
    assert.equal(p.app.hub.addresses(), 0);
  }finally{
    streams.forEach(function(s){ s.close(); });
    await p.close();
  }
});
