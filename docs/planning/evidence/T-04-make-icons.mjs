// T-04 (D-19): makes the app's three icons from the owner's icon image, in headless Edge's canvas
// (no image library on this machine). The source is a rounded square on white; Play and Android
// cut their own shape, so the icon must fill its whole square:
//   1. find the rounded square in the source (its edges and corner radius);
//   2. extend it to a full square with a margin: a pixel outside the shape starts as the colour of
//      the nearest point just inside its edge and, over the next RAMP pixels, blends into a smooth
//      fit of the background (a quadratic in x and y, fitted to a band just inside the edge), so
//      the gradient carries on without streaks;
//   3. scale down in steps: icon-512.png (Play, install, splash), icon-192.png (home screen, tab),
//      apple-touch-icon.png (180, iPhone home screen).
// The margin keeps the whole logo inside the 80% circle a "maskable" icon may be cut to.
//   node T-04-make-icons.mjs <repoDir> <empty scratch dir> [margin fraction, default 0.08]
// Prints the measurements and each file's size; writes a preview with Play's and Android's masks
// to <scratch>/icon-masks-preview.png.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [repoArg, scratch, marginArg] = process.argv.slice(2);
const repoDir = path.resolve(repoArg);
const MARGIN = Number(marginArg || 0.08);
const source = path.join(repoDir, "docs", "design", "icon", "splitfamilia-icon.png");
fs.mkdirSync(scratch, { recursive: true });
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const port = 9300 + Math.floor(Math.random() * 200);
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
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
    const timer = setTimeout(() => { pending.delete(id); r({ timeout: true }); }, 60000);
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
const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, tab);
  if (res.timeout) throw new Error("timed out");
  if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 400));
  return res.result.result.value;
};

const dataUrl = "data:image/png;base64," + fs.readFileSync(source).toString("base64");
const out = await evaluate(`(async function(){
  const img = new Image();
  img.src = ${JSON.stringify(dataUrl)};
  await img.decode();
  const W = img.width, H = img.height;
  if (W !== H) throw new Error("the source isn't square: " + W + "x" + H);
  const src = document.createElement("canvas"); src.width = W; src.height = H;
  const sctx = src.getContext("2d");
  sctx.drawImage(img, 0, 0);
  const d = sctx.getImageData(0, 0, W, H).data;
  const white = function(x, y){ const i = (y * W + x) * 4; return d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235; };
  // 1. The rounded square: its edges along the middle row and column, and its corner radius from
  // where the top-left diagonal meets the curve (t = r × (1 − 1/√2) for a circular corner).
  const mid = W >> 1;
  let L = 0; while (white(L, mid)) L++;
  let R = W - 1; while (white(R, mid)) R--;
  let T = 0; while (white(mid, T)) T++;
  let B = H - 1; while (white(mid, B)) B--;
  let t = 0; while (white(L + t, T + t)) t++;
  const radius = t / (1 - Math.SQRT1_2);
  // Sample just inside the edge, past its soft border.
  const INSET = 10;
  const l = L + INSET, r = R - INSET, tp = T + INSET, b = B - INSET, rad = Math.max(1, radius - INSET);
  // Signed distance to the inset rounded square (negative inside), and its nearest point.
  function nearest(x, y){
    const cx = Math.min(Math.max(x, l + rad), r - rad), cy = Math.min(Math.max(y, tp + rad), b - rad);
    const vx = x - cx, vy = y - cy, len = Math.hypot(vx, vy);
    if (len > rad) return { x: cx + vx * rad / len, y: cy + vy * rad / len, dist: len - rad };
    return { x: x, y: y, dist: len - rad };
  }
  // The background's smooth fit: c = a0 + a1·u + a2·v + a3·u² + a4·uv + a5·v² per channel, with u, v
  // in [-1, 1], by least squares over a 24-pixel band just inside the inset edge.
  const feats = function(x, y){ const u = (x - W / 2) / (W / 2), v = (y - H / 2) / (H / 2); return [1, u, v, u * u, u * v, v * v]; };
  const N = 6, A = Array.from({ length: N }, function(){ return new Array(N).fill(0); }), Bv = [0, 1, 2].map(function(){ return new Array(N).fill(0); });
  let samples = 0;
  for (let y = T; y <= B; y += 2) for (let x = L; x <= R; x += 2) {
    const n = nearest(x, y);
    if (n.dist > -24 || n.dist < -26) continue;
    const f = feats(x, y), i = (y * W + x) * 4;
    for (let j = 0; j < N; j++) { for (let k = 0; k < N; k++) A[j][k] += f[j] * f[k]; for (let ch = 0; ch < 3; ch++) Bv[ch][j] += f[j] * d[i + ch]; }
    samples++;
  }
  function solve(M, v){
    const a = M.map(function(row, i){ return row.concat([v[i]]); });
    for (let c = 0; c < N; c++) {
      let piv = c; for (let rr = c + 1; rr < N; rr++) if (Math.abs(a[rr][c]) > Math.abs(a[piv][c])) piv = rr;
      const tmp = a[c]; a[c] = a[piv]; a[piv] = tmp;
      for (let rr = 0; rr < N; rr++) if (rr !== c) { const f = a[rr][c] / a[c][c]; for (let k = c; k <= N; k++) a[rr][k] -= f * a[c][k]; }
    }
    return a.map(function(row, i){ return row[N] / row[i]; });
  }
  const coef = [0, 1, 2].map(function(ch){ return solve(A, Bv[ch]); });
  const model = function(x, y){ const f = feats(x, y); return coef.map(function(cf){ let s = 0; for (let j = 0; j < N; j++) s += cf[j] * f[j]; return Math.min(255, Math.max(0, s)); }); };
  const RAMP = 60;
  // 2. The full square: the shape centred, with a margin all round.
  const side = R - L + 1;
  const m = Math.round(side * ${MARGIN});
  const E = side + 2 * m;
  const ext = document.createElement("canvas"); ext.width = E; ext.height = E;
  const ectx = ext.getContext("2d");
  const outData = ectx.createImageData(E, E);
  const o = outData.data;
  for (let Y = 0; Y < E; Y++) {
    for (let X = 0; X < E; X++) {
      const x = X - m + L, y = Y - m + T;
      const n = nearest(x, y);
      const sx = Math.min(W - 1, Math.max(0, Math.round(n.x))), sy = Math.min(H - 1, Math.max(0, Math.round(n.y)));
      const si = (sy * W + sx) * 4, oi = (Y * E + X) * 4;
      if (n.dist <= 0) { o[oi] = d[si]; o[oi + 1] = d[si + 1]; o[oi + 2] = d[si + 2]; }
      else {
        // The fit is used only within the original square's box, so it never runs away in the margin.
        const s = Math.min(1, n.dist / RAMP), w = s * s * (3 - 2 * s);
        const mc = model(Math.min(Math.max(x, L), R), Math.min(Math.max(y, T), B));
        for (let ch = 0; ch < 3; ch++) o[oi + ch] = Math.round(d[si + ch] * (1 - w) + mc[ch] * w);
      }
      o[oi + 3] = 255;
    }
  }
  ectx.putImageData(outData, 0, 0);
  // 3. Scale down in steps of at most half, with the browser's best smoothing.
  function scaled(from, size){
    let cur = from;
    while (cur.width / 2 > size) {
      const half = document.createElement("canvas"); half.width = Math.round(cur.width / 2); half.height = half.width;
      const h = half.getContext("2d"); h.imageSmoothingEnabled = true; h.imageSmoothingQuality = "high";
      h.drawImage(cur, 0, 0, half.width, half.height);
      cur = half;
    }
    const c = document.createElement("canvas"); c.width = size; c.height = size;
    const cctx = c.getContext("2d"); cctx.imageSmoothingEnabled = true; cctx.imageSmoothingQuality = "high";
    cctx.drawImage(cur, 0, 0, size, size);
    return c;
  }
  const i512 = scaled(ext, 512);
  const files = {
    "icon-512.png": i512.toDataURL("image/png"),
    "icon-192.png": scaled(i512, 192).toDataURL("image/png"),
    "apple-touch-icon.png": scaled(i512, 180).toDataURL("image/png")
  };
  // A preview: the full square, then Play's rounded mask, then Android's circle (80% safe zone ringed).
  const P = 512, pv = document.createElement("canvas"); pv.width = P * 3 + 80; pv.height = P + 40;
  const p = pv.getContext("2d");
  p.fillStyle = "#ECEAE6"; p.fillRect(0, 0, pv.width, pv.height);
  p.drawImage(i512, 20, 20);
  p.save(); p.beginPath(); p.roundRect(P + 40, 20, P, P, P * 0.2); p.clip(); p.drawImage(i512, P + 40, 20); p.restore();
  p.save(); p.beginPath(); p.arc(2 * P + 60 + P / 2, 20 + P / 2, P / 2, 0, Math.PI * 2); p.clip(); p.drawImage(i512, 2 * P + 60, 20); p.restore();
  p.strokeStyle = "rgba(255,0,0,0.8)"; p.lineWidth = 2;
  p.beginPath(); p.arc(2 * P + 60 + P / 2, 20 + P / 2, P * 0.4, 0, Math.PI * 2); p.stroke();
  files["preview"] = pv.toDataURL("image/png");
  return { source: W + "x" + H, square: { left: L, right: R, top: T, bottom: B, radius: Math.round(radius) }, fitSamples: samples, margin: m, extended: E, files: files };
})()`);

const report = { source: out.source, square: out.square, fitSamples: out.fitSamples, margin: out.margin, extended: out.extended, files: {} };
for (const [name, url] of Object.entries(out.files)) {
  const buf = Buffer.from(url.split(",")[1], "base64");
  const target = name === "preview" ? path.join(scratch, "icon-masks-preview.png") : path.join(repoDir, name);
  fs.writeFileSync(target, buf);
  report.files[name] = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25], bytes: buf.length };
}
console.log(JSON.stringify(report, null, 1));
try { await send("Browser.close"); } catch {}
await sleep(500);
try { edge.kill(); } catch {}
