// T-05 review: compare android/ with a fresh `bubblewrap update` of its own twa-manifest.json, to
// show which files are Bubblewrap's output and which were changed by hand. Reusable after any
// later `bubblewrap update` (ANDROID_APPROACH.md, "How the project was generated").
//
//   1. Copy android/twa-manifest.json alone into an empty scratch folder (outside OneDrive).
//   2. In that folder: npx @bubblewrap/cli@1.25.0 update --skipVersionUpgrade
//      (Bubblewrap reads the JDK and SDK folders from %USERPROFILE%\.bubblewrap\config.json.)
//   3. node docs/planning/evidence/T-05-review-regen-diff.mjs android <scratch folder>
//
// Text files are compared with LF endings; build/ and .gradle/ are skipped. Expected (T-05 review,
// 2026-10-02 IST): only .gitattributes, app/release.gradle and keystore.properties.example are
// ours; app/build.gradle differs by the `apply from: 'release.gradle'` line and its comment;
// res/xml/shortcuts.xml lacks Bubblewrap's licence header (the build rewrites it); and
// manifest-checksum.txt differs only if the two twa-manifest.json files differ in line endings.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const [repoDir, regenDir] = process.argv.slice(2);
if (!repoDir || !regenDir) { console.error('usage: T-05-review-regen-diff.mjs <android dir> <regenerated dir>'); process.exit(2); }
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? (['build', '.gradle'].includes(n) ? [] : walk(p)) : [p];
});
const list = (dir) => new Map(walk(dir).map((p) => [relative(dir, p).replace(/\\/g, '/'), p]));
const a = list(repoDir), b = list(regenDir);
const norm = (p) => { const buf = readFileSync(p); return /\.(png|jar)$/.test(p) ? buf : Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n')); };
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 12);
for (const name of [...new Set([...a.keys(), ...b.keys()])].sort()) {
  if (!b.has(name)) { console.log(`ONLY IN REPO   ${name}`); continue; }
  if (!a.has(name)) { console.log(`ONLY IN REGEN  ${name}`); continue; }
  const x = norm(a.get(name)), y = norm(b.get(name));
  if (x.equals(y)) continue;
  console.log(`DIFFERS        ${name} (${sha(x)} vs ${sha(y)})`);
  if (!/\.(png|jar)$/.test(name)) {
    const xl = x.toString().split('\n'), yl = y.toString().split('\n');
    xl.filter((l) => !yl.includes(l)).slice(0, 6).forEach((l) => console.log(`    repo  + ${l}`));
    yl.filter((l) => !xl.includes(l)).slice(0, 6).forEach((l) => console.log(`    regen + ${l}`));
  }
}
console.log(`repo ${a.size} files, regen ${b.size} files`);
