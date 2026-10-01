// Guards the Android app's settings (SF-012, SF-013) without building it: the Trusted Web
// Activity opens this site under its permanent package, asks for nothing it doesn't use, targets
// the API level Google Play requires, matches the web manifest, and its release build is shrunk
// and signed only with the owner's upload key. `bubblewrap update` rewrites app/build.gradle and
// drops our `apply from: 'release.gradle'` line; then Gradle quietly makes an unsigned bundle, so
// the last test catches that. The build itself is checked by docs/planning/evidence/T-05-*.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = function(name){ return readFileSync(new URL("../" + name, import.meta.url), "utf8"); };
const HOST = "splitfamilia.up.railway.app";
const PACKAGE = "com.splitfamilia.app";
// Google Play: new apps and updates must target API 36 from 2026-08-31 (checked 2026-10-01 IST).
const PLAY_TARGET_SDK = 36;

const twa = JSON.parse(read("android/twa-manifest.json"));
const gradle = read("android/app/build.gradle");
const gradleValue = function(name){
  const m = new RegExp("^\\s*" + name + "\\s+\"?([^\"\\s]+)\"?\\s*$", "m").exec(gradle);
  assert.ok(m, name + " is missing from android/app/build.gradle");
  return m[1];
};

test("the Android app opens this site under its permanent package and name (SF-012)", function(){
  assert.equal(twa.packageId, PACKAGE);
  assert.equal(gradleValue("applicationId"), PACKAGE);
  assert.equal(gradleValue("namespace"), PACKAGE);
  assert.equal(twa.host, HOST);
  assert.match(gradle, new RegExp("hostName: '" + HOST.replace(/\./g, "\\.") + "'"));
  assert.equal(twa.name, "SplitFamilia");
  assert.equal(twa.launcherName, "SplitFamilia");
  // The site's Digital Asset Links name the same package, or the app shows an address bar.
  assert.equal(JSON.parse(read(".well-known/assetlinks.json"))[0].target.package_name, PACKAGE);
  // Every path on the host opens in the app (invite links are /?g=… or /index.html?g=…).
  assert.equal(twa.fullScopeUrl, "https://" + HOST + "/");
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(twa.startUrl, "/" + manifest.start_url.replace(/^\.\//, ""));
  assert.equal(twa.webManifestUrl, "https://" + HOST + "/manifest.json");
});

test("the Android app looks like the web app: its colours and icon (SF-012)", function(){
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(twa.themeColor, manifest.theme_color);
  assert.equal(twa.themeColorDark, manifest.theme_color);
  assert.equal(twa.backgroundColor, manifest.background_color);
  // The page is white at the bottom and has no dark theme. White, not Bubblewrap's
  // '#00000000', which its colour class turns into opaque black.
  ["navigationColor", "navigationColorDark", "navigationDividerColor", "navigationDividerColorDark"].forEach(function(k){
    assert.equal(twa[k], "#FFFFFF", k);
  });
  assert.equal(twa.iconUrl, "https://" + HOST + "/icon-512.png");
  assert.equal(twa.maskableIconUrl, "https://" + HOST + "/icon-512.png");
  assert.ok(manifest.icons.some(function(i){ return i.src === "icon-512.png" && i.purpose === "maskable"; }));
  assert.equal(twa.orientation, manifest.orientation);
});

test("the Android app asks for nothing it doesn't use (SF-012)", function(){
  assert.equal(twa.enableNotifications, false);       // no POST_NOTIFICATIONS
  assert.deepEqual(twa.features, {});                 // no location delegation, Play Billing, …
  assert.equal(twa.fallbackType, "customtabs");       // the WebView fallback would add INTERNET
  assert.deepEqual(twa.additionalTrustedOrigins, []);
  assert.deepEqual(twa.shortcuts, []);
  assert.doesNotMatch(read("android/app/src/main/AndroidManifest.xml"), /<uses-permission/);
  const deps = [...gradle.matchAll(/^\s*implementation\s+'([^']+)'/gm)].map(function(m){ return m[1].split(":").slice(0, 2).join(":"); });
  assert.deepEqual(deps, ["com.google.androidbrowserhelper:androidbrowserhelper"]);
});

test("the Android app targets the API level Google Play requires, and its versions agree (SF-012)", function(){
  assert.equal(Number(gradleValue("targetSdkVersion")), PLAY_TARGET_SDK);
  assert.ok(Number(gradleValue("compileSdkVersion")) >= PLAY_TARGET_SDK);
  assert.equal(Number(gradleValue("minSdkVersion")), twa.minSdkVersion);
  // Every Play upload needs a higher versionCode; build.gradle and twa-manifest.json must agree,
  // or the next `bubblewrap update` would quietly change it.
  assert.equal(Number(gradleValue("versionCode")), twa.appVersionCode);
  assert.equal(gradleValue("versionName"), twa.appVersionName);
  assert.equal(twa.appVersion, twa.appVersionName);
});

test("release builds are shrunk and signed only with the owner's upload key (SF-013)", function(){
  const lines = gradle.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
  assert.equal(lines[lines.length - 1], "apply from: 'release.gradle'",
    "android/app/build.gradle must end with apply from: 'release.gradle' (put it back after `bubblewrap update`)");
  const release = read("android/app/release.gradle");
  assert.match(release, /minifyEnabled true/);
  assert.match(release, /shrinkResources true/);
  ["SPLITFAMILIA_UPLOAD_STORE_FILE", "SPLITFAMILIA_UPLOAD_STORE_PASSWORD", "SPLITFAMILIA_UPLOAD_KEY_ALIAS",
    "SPLITFAMILIA_UPLOAD_KEY_PASSWORD"].forEach(function(name){ assert.match(release, new RegExp("'" + name + "'")); });
  assert.match(release, /rootProject\.file\('keystore\.properties'\)/);
  assert.doesNotMatch(release, /signingConfigs\.debug/);
  assert.match(release, /throw new GradleException/);
  // The example holds placeholders only; the real file is git-ignored.
  const example = read("android/keystore.properties.example").split(/\r?\n/).filter(function(l){ return /^\w+=/.test(l); });
  assert.deepEqual(example.map(function(l){ return l.split("=")[0]; }), ["storeFile", "storePassword", "keyAlias", "keyPassword"]);
  example.forEach(function(l){ assert.match(l, /=(<[A-Z_]+>\/?.*|upload)$/, l); });
  const ignored = read(".gitignore").split(/\r?\n/);
  ["keystore.properties", "*.jks", "*.keystore", "*.aab", "*.apk", "local.properties", "build/", ".gradle/"].forEach(function(p){
    assert.ok(ignored.includes(p), ".gitignore lacks " + p);
  });
  // gradlew must keep LF endings, or it won't run from a fresh clone (core.autocrlf=true).
  assert.match(read("android/.gitattributes"), /^gradlew text eol=lf\r?$/m);
});
