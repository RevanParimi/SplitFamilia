// T-05 break checks: each breaks one rule tests/android.test.js guards, runs that test file,
// expects it to fail, and restores the file byte for byte (in `finally`).
//
//   node docs/planning/evidence/T-05-break-checks.mjs
//
// It edits files under android/ for a few seconds each; don't build android/ at the same time.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const at = (p) => root + p;

const BREAKS = [
  ["K1", "android/app/build.gradle", "the `apply from: 'release.gradle'` line removed (what `bubblewrap update` does)",
    (s) => s.replace("apply from: 'release.gradle'", "")],
  ["K2", "android/app/build.gradle", "targetSdkVersion lowered to 35",
    (s) => s.replace("targetSdkVersion 36", "targetSdkVersion 35")],
  ["K3", "android/app/build.gradle", "versionCode raised in build.gradle only",
    (s) => s.replace(/versionCode 1\b/, "versionCode 2")],
  ["K4", "android/app/build.gradle", "the package changed",
    (s) => s.replace('applicationId "com.splitfamilia.app"', 'applicationId "com.example.split"')],
  ["K5", "android/twa-manifest.json", "notification delegation switched on",
    (s) => s.replace('"enableNotifications": false', '"enableNotifications": true')],
  ["K6", "android/twa-manifest.json", "the navigation divider left as Bubblewrap's black",
    (s) => s.replace('"navigationDividerColor": "#FFFFFF"', '"navigationDividerColor": "#000000"')],
  ["K7", "android/twa-manifest.json", "the host changed",
    (s) => s.replace('"host": "splitfamilia.up.railway.app"', '"host": "example.org"')],
  ["K8", "android/app/src/main/AndroidManifest.xml", "a location permission added",
    (s) => s.replace("<application", '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>\n    <application')],
  ["K9", "android/app/release.gradle", "release falls back to the debug key",
    (s) => s.replace("signingConfig uploadKey.values ? signingConfigs.upload : null", "signingConfig uploadKey.values ? signingConfigs.upload : signingConfigs.debug")],
  ["K10", "android/app/release.gradle", "resource shrinking switched off",
    (s) => s.replace("shrinkResources true", "shrinkResources false")],
  ["K11", "android/keystore.properties.example", "a real-looking password in the example",
    (s) => s.replace("storePassword=<UPLOAD_KEYSTORE_PASSWORD>", "storePassword=hunter2hunter2")],
  ["K12", "android/.gitattributes", "gradlew's LF rule removed",
    (s) => s.replace("gradlew text eol=lf\n", "")],
  ["K13", "android/app/build.gradle", "a second dependency added",
    (s) => s.replace("implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.6.2'",
      "implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.6.2'\n        implementation 'com.google.android.gms:play-services-ads:23.0.0'")],
];

function runTests() {
  const r = spawnSync(process.execPath, ["--test", "tests/android.test.js"], { cwd: root, encoding: "utf8" });
  const failed = /ℹ fail (\d+)/.exec(r.stdout);
  return { status: r.status, fail: failed ? Number(failed[1]) : -1 };
}

const baseline = runTests();
console.log(`baseline: tests/android.test.js exit ${baseline.status}, ${baseline.fail} failing`);
if (baseline.status !== 0) process.exit(1);

let caught = 0;
for (const [id, file, what, mutate] of BREAKS) {
  const original = readFileSync(at(file));
  const broken = mutate(original.toString("utf8"));
  if (broken === original.toString("utf8")) { console.log(`ERROR ${id}: the mutation didn't apply to ${file}`); continue; }
  try {
    writeFileSync(at(file), broken);
    const r = runTests();
    const ok = r.status !== 0 && r.fail > 0;
    if (ok) caught++;
    console.log(`${ok ? "CAUGHT" : "MISSED"} ${id} ${file}: ${what} (${r.fail} test(s) failed)`);
  } finally {
    writeFileSync(at(file), original);
  }
}
const after = runTests();
console.log(`${caught}/${BREAKS.length} breaks caught; after restoring: exit ${after.status}, ${after.fail} failing`);
process.exit(caught === BREAKS.length && after.status === 0 ? 0 : 1);
