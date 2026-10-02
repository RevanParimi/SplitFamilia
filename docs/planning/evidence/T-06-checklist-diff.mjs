// T-06 evidence (SF-020; not part of `npm test`, so ticking boxes never breaks a test): every
// checkbox in the owner's brief, stage 8, appears word for word in PRODUCTION_RELEASE_CHECKLIST.md
// as "- [ ] <text>" or "- [x] <text>", under a heading with the same name, in the same order.
//   node T-06-checklist-diff.mjs <repoDir>
// Prints each brief section with its boxes found or MISSING, the ticked ones, and the boxes the
// checklist adds; exits 1 if anything is missing or out of place.
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(process.argv[2] || ".");
const brief = fs.readFileSync(path.join(repo, "docs/planning/brief/2026-09-28-google-play-release-brief.md"), "utf8").replace(/\r\n/g, "\n");
const list = fs.readFileSync(path.join(repo, "docs/google-play/PRODUCTION_RELEASE_CHECKLIST.md"), "utf8").replace(/\r\n/g, "\n");

// The brief's stage 8: plain headings ("Developer account") followed by "[ ] item" lines.
const stage = brief.slice(brief.indexOf("# 8. PRODUCTION RELEASE CHECKLIST"), brief.indexOf("# REVIEWER ACCOUNT"));
const wanted = [];
let section = null;
stage.split("\n").forEach(function(line){
  const box = /^\[ \] (.+)$/.exec(line.trim());
  if(box) wanted.push({ section, text: box[1].trim() });
  else if(line.trim() && !line.startsWith("#") && !/^(Make this|Include:)/.test(line.trim())) section = line.trim();
});

// The checklist: "## Heading" sections with "- [ ] text..." or "- [x] text..." items.
const found = [];
let heading = null;
list.split("\n").forEach(function(line){
  const h = /^## (.+)$/.exec(line);
  if(h) heading = h[1].trim();
  const box = /^- \[( |x)\] (.+)$/.exec(line);
  if(box) found.push({ section: heading, ticked: box[1] === "x", text: box[2] });
});

let failures = 0;
const sections = [...new Set(wanted.map(function(w){ return w.section; }))];
let lastIndex = -1;
for(const s of sections){
  console.log("## " + s);
  for(const w of wanted.filter(function(x){ return x.section === s; })){
    const i = found.findIndex(function(f){ return f.section === s && (f.text === w.text || f.text.startsWith(w.text + ".") || f.text.startsWith(w.text + " ")); });
    if(i === -1){ failures++; console.log("  MISSING  [ ] " + w.text); continue; }
    if(i < lastIndex){ failures++; console.log("  ORDER    [ ] " + w.text); }
    lastIndex = i;
    console.log("  found    [" + (found[i].ticked ? "x" : " ") + "] " + w.text);
  }
}
const briefTexts = new Set(wanted.map(function(w){ return w.section + "|" + w.text; }));
const added = found.filter(function(f){ return ![...briefTexts].some(function(b){ const [s, t] = b.split("|"); return f.section === s && (f.text === t || f.text.startsWith(t + ".") || f.text.startsWith(t + " ")); }); });
console.log("\nBrief boxes: " + wanted.length + "; found: " + (wanted.length - failures) + "; ticked: " + found.filter(function(f){ return f.ticked; }).length
  + "; added for this app: " + added.length + " (" + added.map(function(f){ return f.section + ": " + f.text.slice(0, 50); }).join(" | ") + ")");
console.log(failures === 0 ? "nothing missing" : failures + " missing or out of order");
process.exit(failures === 0 ? 0 : 1);
