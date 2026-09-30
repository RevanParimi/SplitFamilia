// T-08 fresh-session review: adversarial probes of the real server, in-process on 127.0.0.1 with
// temporary databases (tests/helpers/test-server.js). Nothing is edited; nothing leaves this
// machine. Run from the repo: node docs/planning/evidence/T-08-review-probe.mjs
// Prints one JSON object with every probe's observed result; the expected results are written
// by hand in the review receipt (T-08-review.md).
import { connect } from "node:net";
import { startTestServer, api, raw } from "../../../tests/helpers/test-server.js";
import { computeBalances } from "../../../money.js";

const out = {};

// Sends a request's head at once and its body only when `release` resolves, over its own socket.
// → Promise of the status code.
function heldRequest(port, method, path, headers, body, release){
  return new Promise(function(resolve, reject){
    const sock = connect(port, "127.0.0.1");
    let text = "";
    sock.setEncoding("utf8");
    sock.on("data", function(d){ text += d; });
    sock.on("error", function(){ /* the server may close after answering */ });
    sock.on("close", function(){
      const m = /^HTTP\/1\.1 (\d{3})/.exec(text);
      m ? resolve(Number(m[1])) : reject(new Error("no answer: " + JSON.stringify(text.slice(0, 80))));
    });
    const head = [method + " " + path + " HTTP/1.1", "Host: 127.0.0.1", "Connection: close"]
      .concat(Object.entries(headers).map(function([k, v]){ return k + ": " + v; }))
      .concat(["Content-Length: " + Buffer.byteLength(body), "", ""]).join("\r\n");
    sock.write(head);
    release.then(function(){ sock.write(body); });
  });
}

function tally(statuses){
  const t = {};
  statuses.forEach(function(s){ t[s] = (t[s] || 0) + 1; });
  return t;
}

// ---------- P1: the guessing limit with requests whose bodies arrive after their heads ----------
// Contract (SF-033, REVIEW.md): after 30 unknown codes from one address in 10 minutes, every API
// request from it gets 429. So of 60 unknown codes, at most 30 may get an answer other than 429.
{
  const s = await startTestServer();
  try{
    const port = Number(new URL(s.base).port);
    let go;
    const release = new Promise(function(r){ go = r; });
    const pending = [];
    for(let i = 0; i < 60; i++){
      pending.push(heldRequest(port, "POST", "/api/people",
        { "X-Group-Code": "held-guess-" + i, "Content-Type": "application/json" },
        JSON.stringify({ id: "p1", name: "Probe" }), release));
    }
    await new Promise(function(r){ setTimeout(r, 300); }); // every head has been read
    go();
    const statuses = await Promise.all(pending);
    const after = await api(s.base, "GET", "/api/group", { code: "held-guess-after" });
    out.P1_heldBodies = { sent: 60, answers: tally(statuses), trackedHits: "n/a", nextGet: after.status };
  }finally{ await s.close(); }
}
// The same 60 with each body sent together with its head, all at once.
{
  const s = await startTestServer();
  try{
    const port = Number(new URL(s.base).port);
    const pending = [];
    for(let i = 0; i < 60; i++){
      pending.push(heldRequest(port, "POST", "/api/people",
        { "X-Group-Code": "burst-guess-" + i, "Content-Type": "application/json" },
        JSON.stringify({ id: "p1", name: "Probe" }), Promise.resolve()));
    }
    out.P1_burst = { sent: 60, answers: tally(await Promise.all(pending)) };
  }finally{ await s.close(); }
}
// Held PUTs: each creates a group, which also counts as an unknown code.
{
  const s = await startTestServer();
  try{
    const port = Number(new URL(s.base).port);
    let go;
    const release = new Promise(function(r){ go = r; });
    const pending = [];
    for(let i = 0; i < 60; i++){
      pending.push(heldRequest(port, "PUT", "/api/group",
        { "X-Group-Code": "held-new-" + i, "Content-Type": "application/json" },
        JSON.stringify({ currency: "₹" }), release));
    }
    await new Promise(function(r){ setTimeout(r, 300); });
    go();
    const statuses = await Promise.all(pending);
    const groups = s.app.ledger.query("SELECT COUNT(*) AS n FROM groups")[0].n;
    out.P1_heldPuts = { sent: 60, answers: tally(statuses), groupsCreated: groups };
  }finally{ await s.close(); }
}

// ---------- P2: an odd amount through the API and back, into the balance maths ----------
{
  const s = await startTestServer();
  try{
    const code = "odd-amount-trip";
    await api(s.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } });
    for(const [id, name] of [["asha", "Asha"], ["ben", "Ben"], ["chitra", "Chitra"]]){
      await api(s.base, "POST", "/api/people", { code: code, body: { id: id, name: name } });
    }
    const sent = { id: "e-odd", date: "2026-09-30T04:15:00.000Z", desc: "Chai ☕", amountPaise: 10001, paidBy: "ben", split: ["chitra", "asha", "ben"] };
    const add = await api(s.base, "POST", "/api/expenses", { code: code, body: sent });
    const back = (await api(s.base, "GET", "/api/group", { code: code })).body;
    const stored = s.app.ledger.query("SELECT amount_paise, typeof(amount_paise) AS t FROM expenses WHERE id = ?", ["e-odd"])[0];
    // money.js reads rupees (the Firestore shape); feed it the server's paise as rupees, as SF-035 will.
    const exps = back.expenses.map(function(e){ return { id: e.id, amount: e.amountPaise / 100, paidBy: e.paidBy, split: e.split }; });
    const bal = computeBalances(back.people, exps);
    out.P2_oddAmount = {
      addStatus: add.status, returned: back.expenses[0], storedAs: stored,
      balances: Object.fromEntries(bal), balanceSum: Array.from(bal.values()).reduce(function(a, b){ return a + b; }, 0)
    };
    // Amount shapes that must be refused (400 amountPaise) or accepted as the same integer.
    const shapes = {};
    for(const [label, text] of [["3334.0", "3334.0"], ["1e3", "1e3"], ["\"3334\"", "\"3334\""], ["3334.5", "3334.5"], ["0", "0"], ["-1", "-1"],
      ["1000000000", "1000000000"], ["1000000001", "1000000001"], ["2^53+1", "9007199254740993"], ["true", "true"], ["null", "null"]]){
      const body = '{"id":"amt-' + Object.keys(shapes).length + '","date":"2026-09-30T04:15:00.000Z","desc":"x","amountPaise":' + text + ',"paidBy":"asha","split":["asha"]}';
      const res = await api(s.base, "POST", "/api/expenses", { code: code, body: body });
      shapes[label] = res.status + (res.body && res.body.field ? " " + res.body.field : "");
    }
    out.P2_amountShapes = shapes;
    out.P2_storedAmounts = s.app.ledger.query("SELECT id, amount_paise, typeof(amount_paise) AS t FROM expenses WHERE id LIKE 'amt-%' ORDER BY rowid");
  }finally{ await s.close(); }
}

// ---------- P3: a replay after a delete, and two sends of one ID at the same moment ----------
{
  const s = await startTestServer();
  try{
    const code = "replay-trip";
    await api(s.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } });
    await api(s.base, "POST", "/api/people", { code: code, body: { id: "asha", name: "Asha" } });
    const tea = { id: "tea-1", date: "2026-09-30T04:15:00.000Z", desc: "Tea", amountPaise: 4000, paidBy: "asha", split: ["asha"] };
    const steps = [];
    steps.push(["add", (await api(s.base, "POST", "/api/expenses", { code: code, body: tea })).status]);
    steps.push(["delete", (await api(s.base, "DELETE", "/api/expenses/tea-1", { code: code })).status]);
    const vBefore = (await api(s.base, "GET", "/api/group", { code: code })).body.version;
    const replay = await api(s.base, "POST", "/api/expenses", { code: code, body: Object.assign({}, tea, { desc: "Tea, changed" }) });
    steps.push(["replay add (changed text)", replay.status, replay.body]);
    steps.push(["replay delete", (await api(s.base, "DELETE", "/api/expenses/tea-1", { code: code })).status]);
    const after = (await api(s.base, "GET", "/api/group", { code: code })).body;
    const rows = s.app.ledger.query("SELECT id, description, deleted_at IS NOT NULL AS deleted FROM expenses WHERE group_code = ?", [code]);
    // Two sends of one new ID at once.
    const twin = Object.assign({}, tea, { id: "twin-1" });
    const both = await Promise.all([1, 2].map(function(){ return api(s.base, "POST", "/api/expenses", { code: code, body: twin }); }));
    const twinRows = s.app.ledger.query("SELECT COUNT(*) AS n FROM expenses WHERE id = 'twin-1'")[0].n;
    const twinSplit = s.app.ledger.query("SELECT COUNT(*) AS n FROM expense_split WHERE expense_id = 'twin-1'")[0].n;
    out.P3_replay = {
      steps: steps, versionBeforeReplay: vBefore, versionAfter: after.version, expensesShown: after.expenses.length, rows: rows,
      twinStatuses: both.map(function(r){ return r.status; }).sort(), twinRows: twinRows, twinSplitRows: twinSplit
    };
  }finally{ await s.close(); }
}

// ---------- P4: streams: two on one group, one on another, one on an unknown code ----------
{
  const s = await startTestServer();
  try{
    for(const code of ["stream-a", "stream-b"]) await api(s.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } });
    await api(s.base, "POST", "/api/people", { code: "stream-a", body: { id: "asha", name: "Asha" } }); // a: version 2
    const port = Number(new URL(s.base).port);
    function openStream(code){
      const sock = connect(port, "127.0.0.1");
      const st = { text: "", sock: sock };
      sock.setEncoding("utf8");
      sock.on("data", function(d){ st.text += d; });
      sock.on("error", function(){});
      sock.write("GET /api/group/events HTTP/1.1\r\nHost: x\r\nX-Group-Code: " + code + "\r\nAccept: text/event-stream\r\n\r\n");
      return st;
    }
    const a1 = openStream("stream-a"), a2 = openStream("stream-a"), b = openStream("stream-b"), u = openStream("stream-unknown");
    await new Promise(function(r){ setTimeout(r, 200); });
    const openCounts = { a: s.app.hub.count("stream-a"), b: s.app.hub.count("stream-b"), all: s.app.hub.count() };
    const t0 = Date.now();
    await api(s.base, "POST", "/api/expenses", { code: "stream-a", body: { id: "x1", date: "2026-09-30T04:15:00.000Z", desc: "Taxi", amountPaise: 5000, paidBy: "asha", split: ["asha"] } });
    await new Promise(function(r){ setTimeout(r, 200); });
    const events = function(st){ return (st.text.match(/data: \{"version":\d+\}/g) || []); };
    const result = {
      openCounts: openCounts,
      a1: events(a1), a2: events(a2), b: events(b),
      unknownStatus: (/^HTTP\/1\.1 (\d{3})/.exec(u.text) || [])[1],
      heardWithinMs: Date.now() - t0,
      streamHeaders: a1.text.split("\r\n\r\n")[0].split("\r\n").filter(function(l){ return /content-type|cache-control|connection|nosniff/i.test(l); })
    };
    [a1, a2, b, u].forEach(function(st){ st.sock.destroy(); });
    await new Promise(function(r){ setTimeout(r, 200); });
    result.afterClose = { all: s.app.hub.count(), groups: s.app.hub.groups(), ticking: s.app.hub.ticking() };
    out.P4_streams = result;
  }finally{ await s.close(); }
}

// ---------- P5: dot paths, dotfiles and everything that isn't the app ----------
{
  const s = await startTestServer();
  try{
    const paths = ["/..", "/../package.json", "/%2e%2e/package.json", "/%2E%2E%2Fpackage.json", "/.%2e/package.json",
      "/..%2fpackage.json", "/..%5cpackage.json", "/..\\package.json", "/%5c..%5cpackage.json", "/./index.html",
      "/index.html/.", "/.well-known/../package.json", "/.well-known/%2e%2e/package.json", "/%252e%252e/package.json",
      "//package.json", "/.git/config", "/.env", "/.dockerignore", "/Dockerfile", "/server/main.js", "/server/db.js",
      "/data/splitfamilia.db", "/splitfamilia.db", "/splitfamilia.db-wal", "/ledger-rules.js", "/ledger-client.js",
      "/docs/planning/STATE.json", "/tests/wiring.test.js", "/firestore.rules", "/index.html%00", "/INDEX.HTML",
      "/index.html;.js", "/%2e", "/.", "/api/../index.html", "/api/%2e%2e/index.html", "/.well-known/assetlinks.json",
      "/", "/?g=goa-trip-2026", "/index.html"];
    const res = {};
    for(const p of paths){
      const r = await raw(s.base, p);
      res[p] = r.status + (r.headers["x-content-type-options"] === "nosniff" ? "" : " NO-NOSNIFF");
    }
    out.P5_paths = res;
  }finally{ await s.close(); }
}

// ---------- P6: codes in log lines, across every refusal and a forced 500 ----------
{
  const s = await startTestServer({ guessLimit: 5 });
  const secret = ["secret-family-code", "Asha-Secret-Name", "Secret Chai", "7k2m9xqpwd"];
  try{
    const code = "secret-family-code";
    await api(s.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } });
    await api(s.base, "POST", "/api/people", { code: code, body: { id: "asha", name: "Asha-Secret-Name" } });
    await api(s.base, "POST", "/api/people", { code: code, body: { id: "asha!", name: "Asha-Secret-Name" } });
    await api(s.base, "POST", "/api/expenses", { code: code, body: { id: "x", date: "bad", desc: "Secret Chai", amountPaise: 1, paidBy: "asha", split: ["asha"] } });
    await api(s.base, "POST", "/api/expenses", { code: code, body: "{\"desc\":\"Secret Chai\"" });
    await api(s.base, "POST", "/api/expenses", { code: code, body: { id: "x", date: "2026-09-30T04:15:00.000Z", desc: "Secret Chai", amountPaise: 1, paidBy: "nobody", split: ["asha"] } });
    await api(s.base, "GET", "/api/group", { code: "Secret-Family-Code" });
    await api(s.base, "GET", "/api/group", { code: "secret-" + "7k2m9xqpwd" });
    await api(s.base, "DELETE", "/api/group", { code: code });
    await api(s.base, "GET", "/api/nope?code=" + code, { code: code });
    for(let i = 0; i < 6; i++) await api(s.base, "GET", "/api/group", { code: "guess-" + i });
    // A 500: the database closed under the server.
    const g = await startTestServer();
    try{
      await api(g.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } });
      g.app.ledger.close();
      const r500 = await api(g.base, "GET", "/api/group", { code: code });
      out.P6_forced500 = { status: r500.status, body: r500.body, log: g.logs.slice() };
      g.app.ledger.close = function(){}; // already closed
    }finally{ await g.close(); }
    const leaks = s.logs.filter(function(l){ return secret.some(function(x){ return l.toLowerCase().includes(x.toLowerCase()); }); });
    out.P6_logs = { lines: s.logs, leaks: leaks };
  }finally{ await s.close(); }
}

// ---------- P7: the group-code header's edge cases ----------
{
  const s = await startTestServer({ guessLimit: 1000 });
  try{
    await api(s.base, "PUT", "/api/group", { code: "goa-trip-2026", body: { currency: "₹" } });
    const port = Number(new URL(s.base).port);
    function rawHead(lines){
      return new Promise(function(resolve){
        const sock = connect(port, "127.0.0.1");
        let text = "";
        sock.setEncoding("utf8");
        sock.on("data", function(d){ text += d; });
        sock.on("error", function(){});
        sock.on("close", function(){ resolve((/^HTTP\/1\.1 (\d{3})/.exec(text) || [])[1] || "none"); });
        sock.write(lines.concat(["Connection: close", "", ""]).join("\r\n"));
      });
    }
    out.P7_header = {
      twoHeadersSameCode: await rawHead(["GET /api/group HTTP/1.1", "Host: x", "X-Group-Code: goa-trip-2026", "X-Group-Code: goa-trip-2026"]),
      codeOnlyInQuery: await rawHead(["GET /api/group?code=goa-trip-2026 HTTP/1.1", "Host: x"]),
      paddedCode: await rawHead(["GET /api/group HTTP/1.1", "Host: x", "X-Group-Code:   goa-trip-2026   "]),
      len80: (await api(s.base, "GET", "/api/group", { code: "a".repeat(80) })).status,
      len81: (await api(s.base, "GET", "/api/group", { code: "a".repeat(81) })).status
    };
  }finally{ await s.close(); }
}

// ---------- P8: how much one address may write to a group it just made ----------
// Not in any card's contract; measured so the follow-up (F-9) rests on numbers, not guesses.
{
  const s = await startTestServer();
  try{
    const code = "flood-test";
    await api(s.base, "PUT", "/api/group", { code: code, body: { currency: "₹" } });
    const split = [];
    for(let i = 0; i < 100; i++){
      const id = ("p" + i).padEnd(64, "x");
      split.push(id);
      await api(s.base, "POST", "/api/people", { code: code, body: { id: id, name: "N" + i } });
    }
    const t0 = Date.now();
    const statuses = [];
    const N = 2000;
    for(let batch = 0; batch < N / 50; batch++){
      const round = [];
      for(let j = 0; j < 50; j++){
        const n = batch * 50 + j;
        round.push(api(s.base, "POST", "/api/expenses", { code: code, body: {
          id: "flood-" + n, date: "2026-09-30T04:15:00.000Z", desc: "ऋ".repeat(200), amountPaise: 1, paidBy: split[0], split: split } }));
      }
      (await Promise.all(round)).forEach(function(r){ statuses.push(r.status); });
    }
    const ms = Date.now() - t0;
    const pages = s.app.ledger.query("PRAGMA page_count")[0].page_count * s.app.ledger.query("PRAGMA page_size")[0].page_size;
    out.P8_writeFlood = { expensesSent: N, answers: tally(statuses), ms: ms, perSecond: Math.round(N / (ms / 1000)),
      databaseBytesAfter: pages, bytesPerExpense: Math.round(pages / N), refusedAny: statuses.some(function(st){ return st >= 400; }) };
  }finally{ await s.close(); }
}

// ---------- P9: one address holding every live stream (the cap is shrunk to 20 for the probe) ----------
{
  const s = await startTestServer({ maxStreams: 20 });
  try{
    await api(s.base, "PUT", "/api/group", { code: "family", body: { currency: "₹" } });
    await api(s.base, "PUT", "/api/group", { code: "someone-elses-new-group", body: { currency: "₹" } });
    const port = Number(new URL(s.base).port);
    const socks = [];
    function openStream(code){
      return new Promise(function(resolve){
        const sock = connect(port, "127.0.0.1");
        let text = "";
        sock.setEncoding("utf8");
        sock.on("error", function(){});
        sock.on("data", function(d){
          text += d;
          const m = /^HTTP\/1\.1 (\d{3})/.exec(text);
          if(m) resolve(Number(m[1]));
        });
        socks.push(sock);
        sock.write("GET /api/group/events HTTP/1.1\r\nHost: x\r\nX-Group-Code: " + code + "\r\n\r\n");
      });
    }
    const held = [];
    for(let i = 0; i < 20; i++) held.push(await openStream("someone-elses-new-group"));
    const family = await openStream("family");
    out.P9_streamCap = { heldByOneAddress: tally(held), familyStream: family };
    socks.forEach(function(k){ k.destroy(); });
  }finally{ await s.close(); }
}

console.log(JSON.stringify(out, null, 1));
