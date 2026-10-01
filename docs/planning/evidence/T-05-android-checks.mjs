// T-05 (SF-012, SF-013): checks a built SplitFamilia Android project and its release bundle.
//
//   node docs/planning/evidence/T-05-android-checks.mjs <android project dir> [<app-release.aab>]
//
// Run after `gradlew bundleRelease` in that project. Needs `java` on PATH and BUNDLETOOL set to the
// bundletool jar (for `bundletool dump manifest`). Prints one PASS/FAIL line per check, never a
// local path, and exits 1 if any check fails.
//
// What it checks:
//  M1-M6  the merged release manifest (Gradle's output, not the template): permissions, cleartext,
//         the verified https intent filter for the host;
//  V1-V4  the generated resource values: host, start URL, name, colours;
//  B1-B3  the bundle's own manifest (bundletool): package, versions, SDK levels, permissions;
//  D1-D4  R8: every class the manifest names is defined in the bundle's DEX, and the launcher
//         activity still extends androidbrowserhelper's LauncherActivity (renamed by R8; mapped
//         back through mapping.txt). This stands in for a launch check when no device or
//         emulator is available.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { execFileSync } from "node:child_process";

const projectDir = process.argv[2];
if (!projectDir) { console.error("usage: T-05-android-checks.mjs <android dir> [<aab>]"); process.exit(2); }
const aabPath = process.argv[3] || join(projectDir, "app/build/outputs/bundle/release/app-release.aab");

const HOST = "splitfamilia.up.railway.app";
// The version the bundle should carry: twa-manifest.json's (npm test keeps build.gradle equal to it).
const twa = JSON.parse(readFileSync(join(projectDir, "twa-manifest.json"), "utf8"));
const PACKAGE = "com.splitfamilia.app";
const TARGET_SDK = "36"; // Google Play, new apps and updates from 2026-08-31 (checked 2026-10-01 IST)
const ALLOWED_PERMISSIONS = new Set([
  "android.permission.INTERNET",
  // androidx.core's own signature-level permission, private to this app (protectionLevel signature).
  `${PACKAGE}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`,
]);
const FORBIDDEN = [/POST_NOTIFICATIONS/, /LOCATION/, /BILLING/, /AD_ID/, /READ_PHONE_STATE/, /CAMERA/, /CONTACTS/];

let failures = 0;
function check(id, ok, what, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${what}${detail ? ` (${detail})` : ""}`);
}

// ---- The merged release manifest -------------------------------------------------------------
const mergedPath = join(projectDir, "app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml");
const merged = readFileSync(mergedPath, "utf8");
const usesPermissions = [...merged.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1]);
const declaredPermissions = [...merged.matchAll(/<permission\s[^>]*android:name="([^"]+)"[^>]*android:protectionLevel="([^"]+)"/g)];
check("M1", usesPermissions.every((p) => ALLOWED_PERMISSIONS.has(p)),
  "merged release manifest requests only INTERNET or the app-private androidx permission",
  `uses-permission: ${usesPermissions.join(", ") || "none"}`);
check("M2", usesPermissions.every((p) => !FORBIDDEN.some((re) => re.test(p))),
  "no notification, location, billing, advertising-ID, phone, camera or contacts permission");
check("M3", declaredPermissions.every((m) => m[2] === "signature" && m[1].startsWith(PACKAGE + ".")),
  "every permission the app declares is its own and signature-level",
  declaredPermissions.map((m) => `${m[1].slice(PACKAGE.length + 1)}=${m[2]}`).join(", "));
check("M4", !/usesCleartextTraffic="true"/.test(merged) && !/networkSecurityConfig/.test(merged),
  "cleartext traffic not allowed (no usesCleartextTraffic=\"true\", no network security config; targetSdk 36 defaults to off)");
const viewFilter = merged.match(/<intent-filter android:autoVerify="true"\s*>([\s\S]*?)<\/intent-filter>/);
check("M5", !!viewFilter && /android.intent.action.VIEW/.test(viewFilter[1]) && /BROWSABLE/.test(viewFilter[1])
  && /android:scheme="https"/.test(viewFilter[1]) && /android:host="@string\/hostName"/.test(viewFilter[1])
  && !/pathPrefix|pathPattern/.test(viewFilter[1]),
  "a verified (autoVerify) VIEW filter for https on the host, every path, so invite links open the app");
check("M6", !/DelegationService"[\s\S]{0,80}android:enabled="true"/.test(merged) && /android:enabled="@bool\/enableNotification"/.test(merged),
  "the notification delegation service is switched by enableNotification (false below)");

// ---- Generated resource values ---------------------------------------------------------------
const resValues = readFileSync(join(projectDir, "app/build/generated/res/resValues/release/values/gradleResValues.xml"), "utf8");
const res = (type, name) => (resValues.match(new RegExp(`<${type} name="${name}"[^>]*>([^<]*)</${type}>`)) || [])[1];
check("V1", res("string", "hostName") === HOST, "host is the Railway domain (D-10)", res("string", "hostName"));
check("V2", res("string", "launchUrl") === `https://${HOST}/index.html`, "start URL is the page's start_url", res("string", "launchUrl"));
check("V3", res("string", "appName") === "SplitFamilia" && res("string", "launcherName") === "SplitFamilia",
  "app and launcher name SplitFamilia (D-2)");
const colours = ["colorPrimary", "colorPrimaryDark", "navigationColor", "navigationColorDark",
  "navigationDividerColor", "navigationDividerColorDark", "backgroundColor"].map((n) => `${n}=${res("color", n)}`);
check("V4", res("color", "colorPrimary") === "#4F46E5" && res("color", "backgroundColor") === "#FFFFFF"
  && res("color", "navigationColor") === "#FFFFFF" && res("bool", "enableNotification") === "false",
  "status bar #4F46E5 and splash #FFFFFF (manifest.json), navigation bar #FFFFFF, notifications off", colours.join(", "));

// ---- The bundle's manifest, as Play will read it ---------------------------------------------
if (!process.env.BUNDLETOOL) throw new Error("set BUNDLETOOL to the bundletool jar");
const dumped = execFileSync("java", ["-jar", process.env.BUNDLETOOL, "dump", "manifest", `--bundle=${aabPath}`],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const attr = (name) => (dumped.match(new RegExp(`${name}="([^"]+)"`)) || [])[1];
check("B1", attr("package") === PACKAGE && attr("android:versionCode") === String(twa.appVersionCode)
  && attr("android:versionName") === twa.appVersionName,
  `bundle: package com.splitfamilia.app (D-1), versionCode ${twa.appVersionCode} and versionName ${twa.appVersionName} (twa-manifest.json)`,
  `${attr("package")}, ${attr("android:versionCode")}, ${attr("android:versionName")}`);
check("B2", attr("android:targetSdkVersion") === TARGET_SDK && Number(attr("android:compileSdkVersion")) >= Number(TARGET_SDK)
  && attr("android:minSdkVersion") === "21",
  "bundle: targetSdk 36 (Play's requirement), compileSdk >= targetSdk, minSdk 21 (Bubblewrap's default)",
  `target ${attr("android:targetSdkVersion")}, compile ${attr("android:compileSdkVersion")}, min ${attr("android:minSdkVersion")}`);
const bundlePermissions = [...dumped.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1]);
check("B3", bundlePermissions.every((p) => ALLOWED_PERMISSIONS.has(p)), "bundle: the same permissions as the merged manifest",
  bundlePermissions.join(", ") || "none");

// ---- R8: the classes the manifest names survive shrinking -------------------------------------
function zipEntries(buffer) {
  const entries = new Map();
  let eocd = buffer.length - 22;
  while (eocd >= 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip file");
  let at = buffer.readUInt32LE(eocd + 16);
  const count = buffer.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = buffer.readUInt16LE(at + 10), size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28), extra = buffer.readUInt16LE(at + 30), comment = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLength);
    entries.set(name, () => {
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + size);
      return method === 0 ? data : inflateRawSync(data);
    });
    at += 46 + nameLength + extra + comment;
  }
  return entries;
}
function uleb(buffer, at) {
  let result = 0, shift = 0, byte;
  do { byte = buffer[at++]; result |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
  return [result, at];
}
function dexClasses(dex) {
  const string = (i) => {
    const [, at] = uleb(dex, dex.readUInt32LE(dex.readUInt32LE(0x3c) + 4 * i));
    return dex.toString("latin1", at, dex.indexOf(0, at)); // class names here are ASCII
  };
  const type = (i) => string(dex.readUInt32LE(dex.readUInt32LE(0x44) + 4 * i));
  const toName = (descriptor) => descriptor.slice(1, -1).replace(/\//g, ".");
  const classes = new Map();
  const count = dex.readUInt32LE(0x60), offset = dex.readUInt32LE(0x64);
  for (let i = 0; i < count; i++) {
    const at = offset + 32 * i;
    const superIndex = dex.readUInt32LE(at + 8);
    classes.set(toName(type(dex.readUInt32LE(at))), superIndex === 0xffffffff ? null : toName(type(superIndex)));
  }
  return classes;
}
const entries = zipEntries(readFileSync(aabPath));
const dexNames = [...entries.keys()].filter((n) => /^base\/dex\/classes\d*\.dex$/.test(n));
const defined = new Map();
for (const name of dexNames) for (const [k, v] of dexClasses(entries.get(name)())) defined.set(k, v);
const componentClasses = [...new Set([...merged.matchAll(/<(application|activity|service|provider|receiver)\b[^>]*?android:name="([^"]+)"/g)].map((m) => m[2]))];
const missing = componentClasses.filter((c) => !defined.has(c));
check("D1", dexNames.length > 0 && defined.size > 0, "the bundle's DEX parsed", `${dexNames.join(", ")}: ${defined.size} classes`);
check("D2", missing.length === 0, `R8 kept all ${componentClasses.length} classes the manifest names`,
  missing.length ? `missing: ${missing.join(", ")}` : componentClasses.join(", "));
// R8 renames library classes that nothing names from outside (normal); mapping.txt maps them back.
const mappingPath = join(projectDir, "app/build/outputs/mapping/release/mapping.txt");
check("D3", existsSync(mappingPath), "R8 ran (mapping.txt written)");
const original = new Map();
for (const m of (existsSync(mappingPath) ? readFileSync(mappingPath, "utf8") : "").matchAll(/^(\S+) -> (\S+):$/gm)) original.set(m[2], m[1]);
const keptAs = (name) => [...original].find(([, o]) => o === name)?.[0];
const launcherSuper = defined.get(`${PACKAGE}.LauncherActivity`);
const twaLauncher = keptAs("com.google.androidbrowserhelper.trusted.TwaLauncher");
check("D4", original.get(launcherSuper) === "com.google.androidbrowserhelper.trusted.LauncherActivity"
  && defined.has(launcherSuper) && !!twaLauncher && defined.has(twaLauncher),
  "LauncherActivity still extends androidbrowserhelper's LauncherActivity, and it and TwaLauncher are in the DEX",
  `super ${launcherSuper} = ${original.get(launcherSuper)}; TwaLauncher kept as ${twaLauncher}`);

console.log(failures ? `${failures} check(s) failed` : "all checks passed");
process.exit(failures ? 1 : 0);
