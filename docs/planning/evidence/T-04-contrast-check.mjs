// T-04 (SF-028): WCAG 2 contrast of every text colour on its background in the new index.html.
// The colours are read from the page's own :root tokens, so a changed token changes the result.
// AA asks 4.5:1 for normal text and 3:1 for large text (24 px, or 18.66 px bold) and for the
// borders of controls.   node T-04-contrast-check.mjs <repoDir>
import fs from "node:fs";
import path from "node:path";

const html = fs.readFileSync(path.join(path.resolve(process.argv[2] || "."), "index.html"), "utf8");
const root = /:root\{([^}]*)\}/.exec(html)[1];
const T = {};
for (const m of root.matchAll(/--([a-z-]+):(#[0-9A-Fa-f]{6})/g)) T[m[1]] = m[2];
T.white = "#FFFFFF";
const PILL = Number(/\.sync-pill\{[^}]*background:rgba\(255,255,255,([.\d]+)\)/.exec(html)[1]);

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// A translucent white over a colour, as the header's pill and round buttons are.
const over = (hex, alpha, base) => "#" + rgb(hex).map((v, i) => Math.round(v * alpha + rgb(base)[i] * (1 - alpha)).toString(16).padStart(2, "0")).join("");

// [what, text, background, needed]
const pairs = [
  ["body text", T.ink, T.bg, 4.5],
  ["secondary text (meta, hints in sheets)", T["ink-soft"], T.bg, 4.5],
  ["faint text (counters, captions, fine print, placeholders)", T["ink-faint"], T.bg, 4.5],
  ["meta text on a hovered row", T["ink-soft"], T.surface, 4.5],
  ["'waiting to sync' pill", T["ink-soft"], T.surface, 4.5],
  ["amount still waiting", T["ink-faint"], T.bg, 4.5],
  ["primary button text", T.white, T.brand, 4.5],
  ["primary button text, hovered", T.white, T["brand-press"], 4.5],
  ["outline and text buttons, links", T.brand, T.bg, 4.5],
  ["'Change' button, group tile initial, menu icons", T.brand, T["brand-soft"], 4.5],
  ["header: group name, '4 people'", T.white, T.brand, 4.5],
  // The page reads the pill's tint from its own CSS (the design's 18% gave 4.37:1).
  ["header: sync pill text (white " + Math.round(PILL * 100) + "% over brand)", T.white, over(T.white, PILL, T.brand), 4.5],
  ["header: ⋯ button icon (white 16% over brand)", T.white, over(T.white, 0.16, T.brand), 3],
  ["'not syncing' pill", T.owe, T["owe-soft"], 4.5],
  ["guide: step label, 'Not now'", T["accent-ink"], T["accent-soft"], 4.5],
  ["guide and intro card body", T["ink-soft"], T["accent-soft"], 4.5],
  ["guide button", T.white, T.ink, 4.5],
  ["balance amount, 'Remove', errors", T.owe, T.bg, 4.5],
  ["blocked removal, message bar, banner", T.owe, T["owe-soft"], 4.5],
  ["delete button in a dialog", T.white, T.owe, 4.5],
  ["payment rows, 'All settled up.'", T.good, T.bg, 4.5],
  ["'All settled up.' card, payment summary", T.good, T["good-soft"], 4.5],
  ["settled card sub-text", T["ink-soft"], T["good-soft"], 4.5],
  ["'Everyone' count on brand-soft", T["ink-soft"], T["brand-soft"], 4.5],
  ["dialog Cancel button", T.ink, T.surface, 4.5],
  ["input borders (non-text, 3:1)", T["line-strong"], T.bg, 3]
];
const avatars = [["#FFE3D8", "#9C3514"], ["#D6F1EA", "#0B5E55"], ["#E3E1FF", "#4133B8"], ["#FFEDC2", "#7F5200"], ["#FBDDEB", "#9B1C57"], ["#DAEAFE", "#1E4FB8"], ["#ECEAE6", "#56514B"]];
avatars.forEach(([bg, fg], i) => pairs.push([i < 6 ? "avatar " + (i + 1) + " initial" : "removed person's avatar", fg, bg, 4.5]));

let fails = 0;
for (const [what, fg, bg, need] of pairs) {
  const r = ratio(fg, bg);
  if (r < need) fails++;
  console.log((r >= need ? "pass " : "FAIL ") + r.toFixed(2).padStart(5) + ":1 (needs " + need + ")  " + fg + " on " + bg + "  " + what);
}
console.log(fails === 0 ? "All " + pairs.length + " pairs pass WCAG AA." : fails + " of " + pairs.length + " pairs fail.");
